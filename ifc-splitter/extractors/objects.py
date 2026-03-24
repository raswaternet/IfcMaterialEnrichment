"""Physical objects extractor - converts IFC building elements to RDF with materials and measurements."""

from rdflib import Graph, Literal, URIRef, BNode
from rdflib.namespace import RDF, RDFS, XSD

from .base import ConceptExtractor
from rdf import IFC, IFC_MAT, IFC_PROP, IFC_PRESENTATION
from utils import guid_to_uuid


class PhysicalObjectExtractor(ConceptExtractor):
    """
    Extracts physical building objects, their measurements, and material associations from IFC.

    Focuses on:
    - Building structural elements (walls, windows, doors, slabs, roofs, beams, columns, etc.)
    - Additional structural elements (chimneys, footings, shading devices)
    - Stairs and rail elements (stairs, flights, railings, openings, coverings)
    - Generic building element proxies (catch-all for custom/unclassified elements)
    - HVAC/Mechanical systems (pipes, ducts, valves, pumps, fans, tanks, air terminals, 
      boilers, chillers, compressors, coils, cooled beams, unitary equipment)
    - Electrical systems (cable segments, carriers, appliances, protective devices, 
      distribution boards)
    - Plumbing and sanitary elements (terminals, waste outlets, stack terminals)
    - Fire safety systems (sprinkler heads and fire suppression terminals)
    - Equipment and fixtures (furniture, lighting, fasteners, transport elements)
    - Their physical properties (volume, height, width, area, external orientation, etc.)
    - Material associations with calculated fractions
    - Material property definitions (when available)

    Excludes:
    - Geometric data (stored separately in IFC)
    - Internal relationships and spatial structure
    - Type definitions and abstract element classes
    """

    name = "objects-and-materials"

    # Physical object types to extract
    entity_types = [
        # Primary building structural elements
        "IfcWall",
        "IfcWindow",
        "IfcDoor",
        "IfcSlab",
        "IfcRoof",
        "IfcBeam",
        "IfcColumn",
        "IfcCurtainWall",
        "IfcStair",
        "IfcStairFlight",
        "IfcPlate",
        "IfcMember",
        "IfcRailing",
        "IfcCovering",
        # Additional building structure elements
        "IfcChimney",
        "IfcFooting",
        "IfcShadingDevice",
        # Generic/proxy elements
        "IfcBuildingElementProxy",
        # MEP/Systems - Piping and ducts
        "IfcPipeSegment",
        "IfcPipeFitting",
        "IfcDuctFitting",
        # MEP/Systems - HVAC equipment
        "IfcValve",
        "IfcPump",
        "IfcFan",
        "IfcFlowMeter",
        "IfcTank",
        "IfcAirTerminal",
        "IfcBoiler",
        "IfcChiller",
        "IfcCompressor",
        "IfcCoil",
        "IfcCooledBeam",
        "IfcUnitaryEquipment",
        # MEP/Systems - Electrical
        "IfcCableSegment",
        "IfcCableCarrierSegment",
        "IfcCableCarrierFitting",
        "IfcElectricAppliance",
        "IfcProtectiveDevice",
        "IfcElectricDistributionBoard",
        # MEP/Systems - Plumbing and sanitary
        "IfcSanitaryTerminal",
        "IfcWasteTerminal",
        "IfcStackTerminal",
        # MEP/Systems - Fire safety
        "IfcFireSuppressionTerminal",
        # Equipment and fixtures
        "IfcFurniture",
        "IfcLightFixture",
        "IfcMechanicalFastener",
        "IfcTransportElement",
        # Product types (for property inheritance)
        "IfcWallType",
        "IfcWindowType",
        "IfcDoorType",
        "IfcSlabType",
        "IfcRoofType",
        "IfcBeamType",
        "IfcColumnType",
        "IfcStairType",
        "IfcStairFlightType",
        "IfcRailingType",
        "IfcBuildingElementProxyType",
        "IfcChimneyType",
        "IfcFootingType",
        "IfcShadingDeviceType",
        "IfcPipeSegmentType",
        "IfcPipeFittingType",
        "IfcDuctFittingType",
        "IfcValveType",
        "IfcPumpType",
        "IfcFanType",
        "IfcFlowMeterType",
        "IfcTankType",
        "IfcAirTerminalType",
        "IfcBoilerType",
        "IfcChillerType",
        "IfcCompressorType",
        "IfcCoilType",
        "IfcCooledBeamType",
        "IfcUnitaryEquipmentType",
        "IfcCableSegmentType",
        "IfcCableCarrierSegmentType",
        "IfcCableCarrierFittingType",
        "IfcElectricApplianceType",
        "IfcProtectiveDeviceType",
        "IfcElectricDistributionBoardType",
        "IfcSanitaryTerminalType",
        "IfcWasteTerminalType",
        "IfcStackTerminalType",
        "IfcFireSuppressionTerminalType",
        "IfcFurnitureType",
        "IfcLightFixtureType",
        "IfcMechanicalFastenerType",
        "IfcTransportElementType",
        # Material definitions (to be converted separately)
        "IfcMaterial",
        "IfcMaterialLayerSet",
        "IfcMaterialConstituentSet",
    ]

    # Relationships to process
    relation_types = [
        "IfcRelAssociatesMaterial",
        "IfcRelDefinesByProperties",
    ]

    def __init__(self, ifc, model_slug: str):
        super().__init__(ifc, model_slug)
        # Track material fractions for each element
        self.element_materials = {}
        # Track material properties
        self.material_properties = {}
        # Track element volumes for fraction calculation
        self.element_volumes = {}

    def _convert_to_rdf(self):
        """Convert physical objects and their materials to RDF."""
        # First pass: extract all measurements to populate element_volumes
        self._extract_all_measurements()
        
        # Second pass: process material associations (needs volumes for fractions)
        self._process_material_associations()

        # Third pass: convert physical objects
        self._convert_physical_objects()

        # Fourth pass: convert material definitions with properties
        self._convert_material_definitions()

    def _extract_all_measurements(self):
        """Extract all measurement data from elements to populate element_volumes."""
        physical_element_types = {
            "IfcWall", "IfcWindow", "IfcDoor", "IfcSlab", "IfcRoof",
            "IfcBeam", "IfcColumn", "IfcCurtainWall", "IfcStair", "IfcStairFlight",
            "IfcPlate", "IfcMember", "IfcRailing", "IfcOpeningElement", "IfcCovering",
            "IfcChimney", "IfcFooting", "IfcShadingDevice",
            "IfcBuildingElementProxy",
            "IfcPipeSegment", "IfcPipeFitting", "IfcDuctFitting",
            "IfcValve", "IfcPump", "IfcFan", "IfcFlowMeter", "IfcTank",
            "IfcAirTerminal", "IfcBoiler", "IfcChiller", "IfcCompressor",
            "IfcCoil", "IfcCooledBeam", "IfcUnitaryEquipment",
            "IfcCableSegment", "IfcCableCarrierSegment", "IfcCableCarrierFitting",
            "IfcElectricAppliance", "IfcProtectiveDevice", "IfcElectricDistributionBoard",
            "IfcSanitaryTerminal", "IfcWasteTerminal", "IfcStackTerminal",
            "IfcFireSuppressionTerminal",
            "IfcFurniture", "IfcLightFixture", "IfcMechanicalFastener", "IfcTransportElement"
        }
        
        for element in self._extracted_entities:
            if element.is_a() in physical_element_types:
                # Extract volume (but don't add to graph yet)
                if hasattr(element, "IsDefinedBy"):
                    for rel in element.IsDefinedBy:
                        if rel.is_a("IfcRelDefinesByProperties"):
                            pdef = rel.RelatingPropertyDefinition
                            if pdef.is_a("IfcElementQuantity"):
                                for qty in pdef.Quantities or []:
                                    qty_name = qty.Name if hasattr(qty, "Name") else None
                                    qty_value = qty.Value if hasattr(qty, "Value") else None
                                    if qty_value and qty_name in ["NetVolume", "GrossVolume"]:
                                        elem_id = element.GlobalId if hasattr(element, "GlobalId") else element.id()
                                        if elem_id not in self.element_volumes:
                                            self.element_volumes[elem_id] = float(qty_value)

    def _process_material_associations(self):
        """Process IfcRelAssociatesMaterial to collect material info."""
        for rel in self._extracted_relations:
            if rel.is_a("IfcRelAssociatesMaterial"):
                self._analyze_material_association(rel)

    def _analyze_material_association(self, rel):
        """Analyze a material association and calculate fractions."""
        material_select = rel.RelatingMaterial

        for element in rel.RelatedObjects:
            elem_id = element.GlobalId if hasattr(element, "GlobalId") else element.id()

            if not elem_id in self.element_materials:
                self.element_materials[elem_id] = []

            # Determine material type and extract info
            if material_select.is_a("IfcMaterial"):
                self.element_materials[elem_id].append({
                    "type": "simple",
                    "material": material_select,
                    "fraction": 1.0,
                })
            elif material_select.is_a("IfcMaterialLayerSet"):
                self._process_layer_set(elem_id, material_select, element)
            elif material_select.is_a("IfcMaterialLayerSetUsage"):
                self._process_layer_set(elem_id, material_select.ForLayerSet, element)
            elif material_select.is_a("IfcMaterialConstituentSet"):
                self._process_constituent_set(elem_id, material_select)
            elif material_select.is_a("IfcMaterialProfileSet"):
                self._process_profile_set(elem_id, material_select)
            elif material_select.is_a("IfcMaterialProfileSetUsage"):
                self._process_profile_set(elem_id, material_select.ForProfileSet)

    def _process_layer_set(self, elem_id, layer_set, element):
        """Process a material layer set and calculate layer fractions."""
        if not layer_set.MaterialLayers:
            return

        # Calculate total thickness
        total_thickness = sum(
            layer.LayerThickness or 0
            for layer in layer_set.MaterialLayers
        )

        if total_thickness <= 0:
            return

        # Assign fractions based on layer thickness
        for layer in layer_set.MaterialLayers:
            thickness = layer.LayerThickness or 0
            fraction = (thickness / total_thickness) if total_thickness > 0 else 0

            if layer.Material:
                self.element_materials[elem_id].append({
                    "type": "layer",
                    "material": layer.Material,
                    "fraction": fraction,
                    "thickness": thickness,
                })

    def _process_constituent_set(self, elem_id, constituent_set):
        """Process a material constituent set (composite materials)."""
        if not constituent_set.MaterialConstituents:
            return

        # Check if any constituents have explicit fractions
        constituents_with_fractions = [
            c for c in constituent_set.MaterialConstituents
            if c.Material and hasattr(c, 'Fraction') and c.Fraction
        ]
        
        constituents_without_fractions = [
            c for c in constituent_set.MaterialConstituents
            if c.Material and (not hasattr(c, 'Fraction') or not c.Fraction)
        ]

        # Add constituents with explicit fractions
        for constituent in constituents_with_fractions:
            self.element_materials[elem_id].append({
                "type": "constituent",
                "material": constituent.Material,
                "fraction": constituent.Fraction or 0.0,
            })

        # For constituents without fractions, distribute equally among them
        if constituents_without_fractions:
            equal_fraction = 1.0 / len(constituents_without_fractions)
            for constituent in constituents_without_fractions:
                self.element_materials[elem_id].append({
                    "type": "constituent",
                    "material": constituent.Material,
                    "fraction": equal_fraction,
                })

    def _process_profile_set(self, elem_id, profile_set):
        """Process a material profile set."""
        if not profile_set.MaterialProfiles:
            return

        # For profile-based materials, use fractions if available
        # Otherwise assume equal distribution
        count = len(profile_set.MaterialProfiles)
        for profile in profile_set.MaterialProfiles:
            if profile.Material:
                fraction = profile.Fraction or (1.0 / count)
                self.element_materials[elem_id].append({
                    "type": "profile",
                    "material": profile.Material,
                    "fraction": fraction,
                })

    def _convert_physical_objects(self):
        """Convert IFC physical objects to RDF instances."""
        # Physical element types (instances, not types)
        physical_element_types = {
            # Building structure
            "IfcWall", "IfcWindow", "IfcDoor", "IfcSlab", "IfcRoof",
            "IfcBeam", "IfcColumn", "IfcCurtainWall", "IfcStair", "IfcStairFlight",
            "IfcPlate", "IfcMember", "IfcRailing", "IfcOpeningElement", "IfcCovering",
            "IfcChimney", "IfcFooting", "IfcShadingDevice",
            # Generic/proxy
            "IfcBuildingElementProxy",
            # Mechanical - Piping/Ducts
            "IfcPipeSegment", "IfcPipeFitting", "IfcDuctFitting",
            # Mechanical - HVAC
            "IfcValve", "IfcPump", "IfcFan", "IfcFlowMeter", "IfcTank",
            "IfcAirTerminal", "IfcBoiler", "IfcChiller", "IfcCompressor",
            "IfcCoil", "IfcCooledBeam", "IfcUnitaryEquipment",
            # Electrical
            "IfcCableSegment", "IfcCableCarrierSegment", "IfcCableCarrierFitting",
            "IfcElectricAppliance", "IfcProtectiveDevice", "IfcElectricDistributionBoard",
            # Plumbing/Sanitary
            "IfcSanitaryTerminal", "IfcWasteTerminal", "IfcStackTerminal",
            # Fire Safety
            "IfcFireSuppressionTerminal",
            # Equipment/Fixtures
            "IfcFurniture", "IfcLightFixture", "IfcMechanicalFastener", "IfcTransportElement"
        }

        # Get all physical objects (exclude types and material definitions)
        physical_entities = [
            e for e in self._extracted_entities
            if e.is_a() in physical_element_types
        ]

        for element in physical_entities:
            self._convert_element(element)

    def _convert_element(self, element):
        """Convert a physical building element to RDF."""
        elem_iri = self._element_iri(element)
        element_type = element.is_a()

        # Type assertion
        self.graph.add((elem_iri, RDF.type, IFC[element_type]))

        # Name
        if hasattr(element, "Name") and element.Name:
            self.graph.add((elem_iri, IFC_PROP["name"], Literal(element.Name)))

        # Physical properties - only include measurements, exclude geometry details
        self._add_element_measurements(elem_iri, element)

        # Material associations with fractions
        self._add_element_materials(elem_iri, element)

    def _add_element_measurements(self, elem_iri, element):
        """Add measurement properties to an element via ElementQuantity."""
        volume = None
        
        if hasattr(element, "IsDefinedBy"):
            for rel in element.IsDefinedBy:
                if rel.is_a("IfcRelDefinesByProperties"):
                    pdef = rel.RelatingPropertyDefinition
                    
                    # Check if it's an ElementQuantity
                    if pdef.is_a("IfcElementQuantity"):
                        quantities = pdef.Quantities if hasattr(pdef, "Quantities") else None
                        if not quantities:
                            continue
                        
                        for qty in quantities:
                            try:
                                qty_name = qty.Name
                                qty_type = qty.is_a()
                                qty_value = None
                                
                                # Extract value based on quantity type
                                if qty_type == "IfcQuantityVolume":
                                    qty_value = qty.VolumeValue if hasattr(qty, "VolumeValue") else None
                                elif qty_type == "IfcQuantityLength":
                                    qty_value = qty.LengthValue if hasattr(qty, "LengthValue") else None
                                elif qty_type == "IfcQuantityArea":
                                    qty_value = qty.AreaValue if hasattr(qty, "AreaValue") else None
                                elif qty_type == "IfcQuantityCount":
                                    qty_value = qty.CountValue if hasattr(qty, "CountValue") else None
                                elif qty_type == "IfcQuantityWeight":
                                    qty_value = qty.WeightValue if hasattr(qty, "WeightValue") else None
                                elif qty_type == "IfcQuantityTime":
                                    qty_value = qty.TimeValue if hasattr(qty, "TimeValue") else None
                                
                                if qty_value is None or qty_name is None:
                                    continue
                                
                                # Prefer NetVolume, fallback to GrossVolume
                                if qty_type == "IfcQuantityVolume":
                                    if qty_name == "NetVolume":
                                        volume = qty_value
                                    elif qty_name == "GrossVolume" and volume is None:
                                        volume = qty_value
                                
                                # Extract Height
                                elif qty_type == "IfcQuantityLength" and qty_name == "Height":
                                    self.graph.add((
                                        elem_iri,
                                        IFC_PROP["Height"],
                                        Literal(float(qty_value), datatype=XSD.double)
                                    ))
                                
                                # Extract Width
                                elif qty_type == "IfcQuantityLength" and qty_name == "Width":
                                    self.graph.add((
                                        elem_iri,
                                        IFC_PROP["Width"],
                                        Literal(float(qty_value), datatype=XSD.double)
                                    ))
                                
                                # Extract Length
                                elif qty_type == "IfcQuantityLength" and qty_name == "Length":
                                    self.graph.add((
                                        elem_iri,
                                        IFC_PROP["Length"],
                                        Literal(float(qty_value), datatype=XSD.double)
                                    ))
                                
                                # Extract Area properties
                                elif qty_type == "IfcQuantityArea" and qty_name in ["GrossFootprintArea", "GrossSideArea", "NetSideArea"]:
                                    self.graph.add((
                                        elem_iri,
                                        IFC_PROP["Area"],
                                        Literal(float(qty_value), datatype=XSD.double)
                                    ))
                            except (TypeError, AttributeError):
                                # Skip if we can't access the quantity
                                continue
        
        # Add volume if found
        if volume is not None:
            self.graph.add((
                elem_iri,
                IFC_PROP["Volume"],
                Literal(float(volume), datatype=XSD.double)
            ))
            # Store volume for fraction calculation
            elem_id = element.GlobalId if hasattr(element, "GlobalId") else element.id()
            self.element_volumes[elem_id] = float(volume)
        
        # IsExternal (for elements that have it)
        if hasattr(element, "IsExternal") and element.IsExternal is not None:
            self.graph.add((
                elem_iri,
                IFC_PROP["IsExternal"],
                Literal(bool(element.IsExternal), datatype=XSD.boolean)
            ))

    def _extract_property_value(self, element, prop_name: str):
        """Extract a property value from an IFC element."""
        try:
            if hasattr(element, prop_name):
                value = getattr(element, prop_name)
                if value is not None:
                    return value
        except:
            pass

        # Try to get from property sets (IfcPropertySet)
        if hasattr(element, "IsDefinedBy"):
            for rel in element.IsDefinedBy:
                if rel.is_a("IfcRelDefinesByProperties"):
                    prop_set = rel.RelatingPropertyDefinition
                    if prop_set.is_a("IfcPropertySet"):
                        for prop in prop_set.HasProperties or []:
                            if hasattr(prop, "Name") and prop.Name == prop_name:
                                if hasattr(prop, "NominalValue"):
                                    return prop.NominalValue.wrappedValue
        return None

    def _add_element_materials(self, elem_iri, element):
        """Add material associations to an element."""
        elem_id = element.GlobalId if hasattr(element, "GlobalId") else element.id()

        materials_list = self.element_materials.get(elem_id, [])

        if not materials_list:
            return

        # If single material without explicit fraction (or fraction = 1.0), use direct reference
        if len(materials_list) == 1 and materials_list[0].get("fraction", 1.0) == 1.0:
            material = materials_list[0]["material"]
            if material:
                mat_iri = self._material_iri(material)
                if mat_iri:
                    self.graph.add((elem_iri, IFC["material"], mat_iri))
        else:
            # Multiple materials or explicit fractions: use blank nodes
            for mat_info in materials_list:
                material = mat_info["material"]
                fraction = mat_info.get("fraction", 1.0)

                if not material:
                    continue

                # Create a blank node for the material occurrence with fraction
                mat_node = BNode()
                mat_iri = self._material_iri(material)

                if mat_iri:
                    # Use material IRI as the type (e.g., midas-materials:WOOD)
                    self.graph.add((mat_node, RDF.type, mat_iri))

                    # Add fraction
                    if fraction and fraction > 0:
                        self.graph.add((
                            mat_node,
                            IFC_PROP["Fraction"],
                            Literal(float(fraction), datatype=XSD.double)
                        ))

                    # Link from element to material occurrence
                    self.graph.add((elem_iri, IFC["material"], mat_node))

    def _convert_material_definitions(self):
        """Convert material definitions with their properties."""
        # Get all material entities
        material_entities = [
            e for e in self._extracted_entities
            if e.is_a() in ["IfcMaterial", "IfcMaterialLayerSet", "IfcMaterialConstituentSet"]
        ]

        # Deduplicate by object id
        seen = set()
        for material in material_entities:
            mat_id = material.id()
            if mat_id not in seen:
                seen.add(mat_id)
                self._convert_material(material)

    def _convert_material(self, material):
        """Convert a material definition to RDF with properties."""
        mat_iri = self._material_iri(material)
        mat_type = material.is_a()

        self.graph.add((mat_iri, RDF.type, IFC[mat_type]))

        # Name
        if hasattr(material, "Name") and material.Name:
            self.graph.add((mat_iri, IFC_PROP["name"], Literal(material.Name)))

        # Description
        if hasattr(material, "Description") and material.Description:
            self.graph.add((mat_iri, RDFS.comment, Literal(material.Description)))

        # Category
        if hasattr(material, "Category") and material.Category:
            self.graph.add((mat_iri, IFC_PROP["category"], Literal(material.Category)))

        # Layer set specific properties
        if mat_type == "IfcMaterialLayerSet":
            if hasattr(material, "LayerSetName") and material.LayerSetName:
                self.graph.add((mat_iri, IFC_PROP["layerSetName"], Literal(material.LayerSetName)))

        # Note: Additional material properties (color, strength, etc.) can be added in enrichment phase

    def _element_iri(self, element) -> URIRef:
        """Generate IRI for an IFC element using its UUID."""
        if hasattr(element, "GlobalId") and element.GlobalId:
            uuid = guid_to_uuid(element.GlobalId)
            return self.inst_ns[uuid]
        return self.inst_ns[f"entity_{element.id()}"]

    def _material_iri(self, material) -> URIRef:
        """Generate IRI for a material."""
        if not material:
            return None

        # Use name-based IRI (materials don't have GlobalId)
        name = None
        if hasattr(material, "Name"):
            name = material.Name

        if name:
            safe_name = self._sanitize_for_uri(name)
        else:
            safe_name = f"material_{material.id()}"

        return self.inst_ns[f"material/{safe_name}"]

    def _sanitize_for_uri(self, name: str) -> str:
        """Sanitize a string to be safe for use in a URI."""
        import re
        from urllib.parse import quote

        safe = re.sub(r'[<>"\'\{\}\|\\\^`\[\]]', '', name)
        safe = safe.replace(" ", "_").replace("/", "_")
        safe = quote(safe, safe='_-')
        return safe if safe else "unnamed"
