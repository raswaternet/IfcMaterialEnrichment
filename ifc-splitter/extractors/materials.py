"""Material concept extractor - converts IFC materials to RDF."""

from rdflib import Graph, Literal, URIRef, BNode
from rdflib.namespace import RDF, RDFS, XSD

from .base import ConceptExtractor
from rdf import IFC, IFC_MAT, IFC_PROP
from utils import guid_to_uuid


class MaterialExtractor(ConceptExtractor):
    """
    Extracts material definitions and associations from IFC.

    Handles:
    - IfcMaterial (single materials)
    - IfcMaterialLayer / IfcMaterialLayerSet (layered constructions)
    - IfcMaterialConstituent / IfcMaterialConstituentSet
    - IfcMaterialProfile / IfcMaterialProfileSet
    - IfcRelAssociatesMaterial (element-to-material links)
    """

    name = "materials"

    entity_types = [
        "IfcMaterial",
        "IfcMaterialLayer",
        "IfcMaterialLayerSet",
        "IfcMaterialLayerSetUsage",
        "IfcMaterialConstituent",
        "IfcMaterialConstituentSet",
        "IfcMaterialProfile",
        "IfcMaterialProfileSet",
        "IfcMaterialProfileSetUsage",
    ]

    relation_types = [
        "IfcRelAssociatesMaterial",
    ]

    def _convert_to_rdf(self):
        """Convert materials and associations to RDF triples."""
        # Process material definitions
        for entity in self._extracted_entities:
            self._convert_material_entity(entity)

        # Process material-to-element associations
        for rel in self._extracted_relations:
            self._convert_material_association(rel)

    def _convert_material_entity(self, entity):
        """Convert a material entity to RDF."""
        entity_type = entity.is_a()

        if entity_type == "IfcMaterial":
            self._convert_simple_material(entity)
        elif entity_type == "IfcMaterialLayerSet":
            self._convert_layer_set(entity)
        elif entity_type == "IfcMaterialLayer":
            self._convert_layer(entity)
        elif entity_type == "IfcMaterialConstituentSet":
            self._convert_constituent_set(entity)
        elif entity_type == "IfcMaterialConstituent":
            self._convert_constituent(entity)
        # Skip Usage entities - they're just references

    def _convert_simple_material(self, material):
        """Convert IfcMaterial to RDF."""
        mat_iri = self._material_iri(material)

        # Type assertion (using IFCX schema namespace)
        self.graph.add((mat_iri, RDF.type, IFC["IfcMaterial"]))

        # Name
        if material.Name:
            self.graph.add((mat_iri, IFC_PROP["name"], Literal(material.Name)))

            # Attempt bSDD class link based on name (placeholder for API lookup)
            bsdd_class = self._lookup_bsdd_material(material.Name)
            if bsdd_class:
                self.graph.add((mat_iri, IFC_MAT["bsddClass"], bsdd_class))

        # Description (IFC4+)
        if hasattr(material, "Description") and material.Description:
            self.graph.add((mat_iri, RDFS.comment, Literal(material.Description)))
            self.graph.add((mat_iri, IFC_PROP["description"], Literal(material.Description)))

        # Category (IFC4+)
        if hasattr(material, "Category") and material.Category:
            self.graph.add((mat_iri, IFC_PROP["category"], Literal(material.Category)))

    def _convert_layer_set(self, layer_set):
        """Convert IfcMaterialLayerSet to RDF."""
        set_iri = self._layer_set_iri(layer_set)

        self.graph.add((set_iri, RDF.type, IFC["IfcMaterialLayerSet"]))

        if layer_set.LayerSetName:
            self.graph.add((set_iri, IFC_PROP["layerSetName"], Literal(layer_set.LayerSetName)))

        # Link to layers
        if layer_set.MaterialLayers:
            for i, layer in enumerate(layer_set.MaterialLayers):
                layer_iri = self._layer_iri(layer)
                self.graph.add((set_iri, IFC_MAT["hasLayer"], layer_iri))
                self.graph.add((layer_iri, IFC_MAT["layerIndex"], Literal(i, datatype=XSD.integer)))

    def _convert_layer(self, layer):
        """Convert IfcMaterialLayer to RDF."""
        layer_iri = self._layer_iri(layer)

        self.graph.add((layer_iri, RDF.type, IFC["IfcMaterialLayer"]))

        # Thickness
        if layer.LayerThickness:
            self.graph.add((
                layer_iri,
                IFC_MAT["thickness"],
                Literal(layer.LayerThickness, datatype=XSD.double)
            ))

        # Link to material
        if layer.Material:
            mat_iri = self._material_iri(layer.Material)
            self.graph.add((layer_iri, IFC_MAT["hasMaterial"], mat_iri))

        # Name (IFC4+)
        if hasattr(layer, "Name") and layer.Name:
            self.graph.add((layer_iri, IFC_PROP["name"], Literal(layer.Name)))

    def _convert_constituent_set(self, constituent_set):
        """Convert IfcMaterialConstituentSet to RDF."""
        set_iri = self._constituent_set_iri(constituent_set)

        self.graph.add((set_iri, RDF.type, IFC["IfcMaterialConstituentSet"]))

        if constituent_set.Name:
            self.graph.add((set_iri, IFC_PROP["name"], Literal(constituent_set.Name)))

        if constituent_set.MaterialConstituents:
            for constituent in constituent_set.MaterialConstituents:
                const_iri = self._constituent_iri(constituent)
                self.graph.add((set_iri, IFC_MAT["hasConstituent"], const_iri))

    def _convert_constituent(self, constituent):
        """Convert IfcMaterialConstituent to RDF."""
        const_iri = self._constituent_iri(constituent)

        self.graph.add((const_iri, RDF.type, IFC["IfcMaterialConstituent"]))

        if constituent.Name:
            self.graph.add((const_iri, IFC_PROP["name"], Literal(constituent.Name)))

        if constituent.Material:
            mat_iri = self._material_iri(constituent.Material)
            self.graph.add((const_iri, IFC_MAT["hasMaterial"], mat_iri))

        if constituent.Fraction:
            self.graph.add((
                const_iri,
                IFC_MAT["fraction"],
                Literal(constituent.Fraction, datatype=XSD.double)
            ))

    def _convert_material_association(self, rel):
        """Convert IfcRelAssociatesMaterial to RDF triples linking elements to materials."""
        material_select = rel.RelatingMaterial

        # Determine the material IRI based on type
        if material_select.is_a("IfcMaterial"):
            mat_iri = self._material_iri(material_select)
        elif material_select.is_a("IfcMaterialLayerSet"):
            mat_iri = self._layer_set_iri(material_select)
        elif material_select.is_a("IfcMaterialLayerSetUsage"):
            mat_iri = self._layer_set_iri(material_select.ForLayerSet)
        elif material_select.is_a("IfcMaterialConstituentSet"):
            mat_iri = self._constituent_set_iri(material_select)
        elif material_select.is_a("IfcMaterialProfileSet"):
            mat_iri = self._profile_set_iri(material_select)
        elif material_select.is_a("IfcMaterialProfileSetUsage"):
            mat_iri = self._profile_set_iri(material_select.ForProfileSet)
        else:
            return  # Unknown material type

        # Link each related element to the material
        for element in rel.RelatedObjects:
            elem_iri = self._element_iri(element)
            self.graph.add((elem_iri, IFC_MAT["hasMaterial"], mat_iri))

    # --- IRI generation helpers ---

    def _element_iri(self, element) -> URIRef:
        """Generate IRI for an IFC element using its UUID."""
        if hasattr(element, "GlobalId") and element.GlobalId:
            uuid = guid_to_uuid(element.GlobalId)
            return self.inst_ns[uuid]
        return self.inst_ns[f"entity_{element.id()}"]

    def _sanitize_for_uri(self, name: str) -> str:
        """Sanitize a string to be safe for use in a URI."""
        import re
        from urllib.parse import quote
        # Remove angle brackets and other problematic characters
        safe = re.sub(r'[<>"\'\{\}\|\\\^`\[\]]', '', name)
        # Replace spaces and slashes with underscores
        safe = safe.replace(" ", "_").replace("/", "_")
        # URL-encode any remaining special characters
        safe = quote(safe, safe='_-')
        return safe if safe else "unnamed"

    def _material_iri(self, material) -> URIRef:
        """Generate IRI for IfcMaterial."""
        # Use name-based IRI (materials don't have GlobalId)
        name = material.Name or f"material_{material.id()}"
        safe_name = self._sanitize_for_uri(name)
        return self.inst_ns[f"material/{safe_name}"]

    def _layer_set_iri(self, layer_set) -> URIRef:
        """Generate IRI for IfcMaterialLayerSet."""
        name = layer_set.LayerSetName or f"layerset_{layer_set.id()}"
        safe_name = self._sanitize_for_uri(name)
        return self.inst_ns[f"layerset/{safe_name}"]

    def _layer_iri(self, layer) -> URIRef:
        """Generate IRI for IfcMaterialLayer."""
        return self.inst_ns[f"layer/{layer.id()}"]

    def _constituent_set_iri(self, constituent_set) -> URIRef:
        """Generate IRI for IfcMaterialConstituentSet."""
        name = constituent_set.Name or f"constituentset_{constituent_set.id()}"
        safe_name = self._sanitize_for_uri(name)
        return self.inst_ns[f"constituentset/{safe_name}"]

    def _constituent_iri(self, constituent) -> URIRef:
        """Generate IRI for IfcMaterialConstituent."""
        return self.inst_ns[f"constituent/{constituent.id()}"]

    def _profile_set_iri(self, profile_set) -> URIRef:
        """Generate IRI for IfcMaterialProfileSet."""
        name = getattr(profile_set, "Name", None) or f"profileset_{profile_set.id()}"
        safe_name = self._sanitize_for_uri(name)
        return self.inst_ns[f"profileset/{safe_name}"]

    # --- bSDD integration placeholder ---

    def _lookup_bsdd_material(self, material_name: str) -> URIRef | None:
        """
        Lookup material in bSDD and return class URI.

        TODO: Implement actual bSDD API call.
        For now, returns None (no linking).
        """
        # Placeholder for bSDD API integration
        # e.g., query https://api.bsdd.buildingsmart.org/api/SearchInDictionary/v1
        return None
