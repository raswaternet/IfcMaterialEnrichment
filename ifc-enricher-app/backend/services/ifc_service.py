from __future__ import annotations

import shutil
import uuid
from pathlib import Path
from typing import Any

import ifcopenshell
import ifcopenshell.api
import ifcopenshell.util.element

from models.schemas import MaterialAssignment


class IfcService:
    def __init__(self, upload_dir: str) -> None:
        self.upload_dir = Path(upload_dir)
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    def create_file_record(self, source_path: Path, original_name: str) -> str:
        file_id = str(uuid.uuid4())
        destination = self.upload_dir / file_id / original_name
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source_path, destination)
        return file_id

    def save_upload_bytes(self, filename: str, data: bytes) -> str:
        file_id = str(uuid.uuid4())
        destination = self._path_for(file_id, filename)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
        return file_id

    def _path_for(self, file_id: str, filename: str | None = None) -> Path:
        folder = self.upload_dir / file_id
        if filename:
            return folder / filename
        matches = list(folder.glob("*.ifc"))
        if not matches:
            raise FileNotFoundError(f"No IFC file found for {file_id}")
        return matches[0]

    def get_model(self, file_id: str):
        path = self._path_for(file_id)
        return ifcopenshell.open(path.as_posix()), path

    def summarize_model(self, file_id: str) -> dict[str, Any]:
        model, path = self.get_model(file_id)
        products = [p for p in model.by_type("IfcProduct") if getattr(p, "Representation", None)]
        element_types = sorted({p.is_a() for p in products})
        return {
            "fileId": file_id,
            "fileName": path.name,
            "schema": model.schema,
            "elementCount": len(products),
            "elementTypes": element_types,
        }

    def list_elements(self, file_id: str, ifc_type: str | None = None) -> list[dict[str, Any]]:
        model, _ = self.get_model(file_id)
        products = [p for p in model.by_type(ifc_type or "IfcProduct") if getattr(p, "Representation", None)]
        results = []
        for element in products:
            material = ifcopenshell.util.element.get_material(element)
            results.append({
                "expressId": element.id(),
                "globalId": getattr(element, "GlobalId", None),
                "name": getattr(element, "Name", None),
                "ifcType": element.is_a(),
                "hasGeometry": getattr(element, "Representation", None) is not None,
                "hasMaterial": material is not None,
            })
        return results

    def get_element_detail(self, file_id: str, express_id: int) -> dict[str, Any]:
        model, _ = self.get_model(file_id)
        element = model.by_id(express_id)
        if element is None:
            raise KeyError(express_id)
        material = ifcopenshell.util.element.get_material(element)
        psets = ifcopenshell.util.element.get_psets(element)
        qtos = ifcopenshell.util.element.get_psets(element, qtos_only=True)
        return {
            "expressId": element.id(),
            "globalId": getattr(element, "GlobalId", None),
            "name": getattr(element, "Name", None),
            "ifcType": element.is_a(),
            "properties": psets,
            "quantities": qtos,
            "material": self._serialize_material(material),
        }

    def enrich(self, file_id: str, assignments: list[MaterialAssignment]) -> dict[str, Any]:
        model, path = self.get_model(file_id)
        created_materials: dict[str, Any] = {}
        enriched_elements: set[int] = set()
        for assignment in assignments:
            key = assignment.materialName.strip().lower()
            material = created_materials.get(key)
            if material is None:
                material = ifcopenshell.api.run(
                    "material.add_material",
                    model,
                    name=assignment.materialName,
                    category=assignment.materialCategory,
                    description=assignment.materialDescription,
                )
                if assignment.properties:
                    pset = ifcopenshell.api.run(
                        "pset.add_pset",
                        model,
                        product=material,
                        name="Pset_MaterialCommon",
                    )
                    ifcopenshell.api.run(
                        "pset.edit_pset",
                        model,
                        pset=pset,
                        properties={name: value.value for name, value in assignment.properties.items()},
                    )
                created_materials[key] = material
            for express_id in assignment.elementExpressIds:
                element = model.by_id(express_id)
                if element is None:
                    continue
                ifcopenshell.api.run(
                    "material.assign_material",
                    model,
                    products=[element],
                    material=material,
                )
                enriched_elements.add(express_id)
        enriched_id = str(uuid.uuid4())
        output_path = self._path_for(enriched_id, path.stem + "_enriched.ifc")
        output_path.parent.mkdir(parents=True, exist_ok=True)
        model.write(output_path.as_posix())
        return {
            "enrichedFileId": enriched_id,
            "summary": {
                "materialsAdded": len(created_materials),
                "elementsEnriched": len(enriched_elements),
            },
        }

    def generate_report(self, file_id: str) -> dict[str, Any]:
        model, _ = self.get_model(file_id)
        products = [p for p in model.by_type("IfcProduct") if getattr(p, "Representation", None)]
        materials: dict[str, dict[str, Any]] = {}
        unenriched: list[dict[str, Any]] = []
        enriched_count = 0
        for element in products:
            material = ifcopenshell.util.element.get_material(element)
            volume = self._extract_volume(element)
            if material is None:
                unenriched.append({
                    "expressId": element.id(),
                    "globalId": getattr(element, "GlobalId", None),
                    "name": getattr(element, "Name", None),
                    "ifcType": element.is_a(),
                })
                continue
            enriched_count += 1
            mat_name = getattr(material, "Name", None) or "Unnamed material"
            entry = materials.setdefault(mat_name, {
                "name": mat_name,
                "category": getattr(material, "Category", None),
                "elementCount": 0,
                "elementTypes": set(),
                "totalVolume": 0.0,
                "estimatedMass": None,
                "co2Estimate": None,
            })
            entry["elementCount"] += 1
            entry["elementTypes"].add(element.is_a())
            entry["totalVolume"] += float(volume or 0)
        result_materials = []
        for entry in materials.values():
            entry["elementTypes"] = sorted(entry["elementTypes"])
            result_materials.append(entry)
        total_elements = len(products)
        return {
            "totalElements": total_elements,
            "enrichedElements": enriched_count,
            "completeness": (enriched_count / total_elements) if total_elements else 0,
            "materials": sorted(result_materials, key=lambda item: item["elementCount"], reverse=True),
            "unenrichedElements": unenriched,
        }

    def raw_file_path(self, file_id: str) -> Path:
        return self._path_for(file_id)

    def _serialize_material(self, material: Any) -> dict[str, Any] | None:
        if material is None:
            return None
        return {
            "id": material.id(),
            "name": getattr(material, "Name", None),
            "category": getattr(material, "Category", None),
        }

    def _extract_volume(self, element: Any) -> float | None:
        qtos = ifcopenshell.util.element.get_psets(element, qtos_only=True)
        for qto_props in qtos.values():
            for prop_name in ("NetVolume", "GrossVolume", "Volume"):
                if prop_name in qto_props:
                    value = qto_props[prop_name]
                    if isinstance(value, (int, float)):
                        return float(value)
        return None
