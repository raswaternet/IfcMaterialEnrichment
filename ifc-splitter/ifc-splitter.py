import os
import subprocess
import json
import ifcopenshell

# === PATH SETUP ===

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)

MODELS_DIR = os.path.join(PROJECT_ROOT, "ifc-viewer", "public", "models")
SOURCE_DIR = os.path.join(MODELS_DIR, "source-models")

GEOM_IFC_DIR = os.path.join(MODELS_DIR, "model-geometry", "ifc")
FRAG_DIR = os.path.join(MODELS_DIR, "model-geometry", "fragments")
PROP_JSON_DIR = os.path.join(MODELS_DIR, "model-properties", "json")

IFC2FRAG_DIR = os.path.join(PROJECT_ROOT, "ifc2frag")
CLI_PATH = os.path.join(IFC2FRAG_DIR, "cli.js")

# Create output folders
os.makedirs(GEOM_IFC_DIR, exist_ok=True)
os.makedirs(FRAG_DIR, exist_ok=True)
os.makedirs(PROP_JSON_DIR, exist_ok=True)

# === FUNCTIONS ===

def create_geometry_ifc(src_ifc, output_path):
    dst = ifcopenshell.file(schema=src_ifc.schema)
    mapping = {}

    def copy(entity):
        if entity.id() in mapping:
            return mapping[entity.id()]
        new = dst.add(entity)
        mapping[entity.id()] = new
        return new

    # Copy spatial structure
    for cls in ["IfcProject", "IfcSite", "IfcBuilding", "IfcBuildingStorey"]:
        for el in src_ifc.by_type(cls):
            copy(el)

    # Copy products (geometry intact)
    for el in src_ifc.by_type("IfcProduct"):
        copy(el)

    # Copy representations
    for el in src_ifc.by_type("IfcRepresentation"):
        copy(el)
    for el in src_ifc.by_type("IfcGeometricRepresentationItem"):
        copy(el)

    # Skip property relations intentionally

    dst.write(output_path)


def extract_properties_json(ifc, output_path):
    data = {"elements": {}}

    for el in ifc.by_type("IfcProduct"):
        guid = el.GlobalId

        element_data = {
            "type": el.is_a(),
            "properties": {}
        }

        if hasattr(el, "IsDefinedBy"):
            for rel in el.IsDefinedBy:
                if rel.is_a("IfcRelDefinesByProperties"):
                    pset = rel.RelatingPropertyDefinition

                    if pset.is_a("IfcPropertySet"):
                        pset_name = pset.Name
                        element_data["properties"][pset_name] = {}

                        for prop in pset.HasProperties:
                            if prop.is_a("IfcPropertySingleValue"):
                                val = prop.NominalValue
                                val = val.wrappedValue if val else None

                                element_data["properties"][pset_name][prop.Name] = val

        if element_data["properties"]:
            data["elements"][guid] = element_data

    with open(output_path, "w") as f:
        json.dump(data, f, indent=2)


def run_fragmentation(input_ifc, output_frag):
    try:
        result = subprocess.run(
            ["node", CLI_PATH, input_ifc, output_frag],
            cwd=IFC2FRAG_DIR,
            capture_output=True,
            text=True
        )

        return result.returncode == 0, result.stdout, result.stderr
    except Exception as e:
        return False, "", str(e)


# === MAIN ===

if not os.path.exists(SOURCE_DIR):
    print(f"❌ Source folder not found: {SOURCE_DIR}")
    exit(1)

if not os.path.exists(CLI_PATH):
    print(f"❌ cli.js not found: {CLI_PATH}")
    exit(1)

files = [f for f in os.listdir(SOURCE_DIR) if f.endswith(".ifc")]

if not files:
    print("⚠️ No IFC files found.")
    exit(0)

print(f"🚀 Found {len(files)} IFC file(s)")

success = 0
fail = 0

for file in files:
    name = os.path.splitext(file)[0]
    input_path = os.path.join(SOURCE_DIR, file)

    geom_ifc_path = os.path.join(GEOM_IFC_DIR, f"{name}.ifc")
    prop_json_path = os.path.join(PROP_JSON_DIR, f"{name}.json")
    frag_path = os.path.join(FRAG_DIR, f"{name}.frag")

    print(f"\n🔹 Processing: {file}")

    try:
        ifc = ifcopenshell.open(input_path)

        # 1. Geometry IFC
        print("  → Creating geometry IFC...")
        create_geometry_ifc(ifc, geom_ifc_path)

        # 2. Properties JSON
        print("  → Extracting properties...")
        extract_properties_json(ifc, prop_json_path)

        # 3. Fragmentation
        print("  → Running fragmentation...")
        ok, out, err = run_fragmentation(geom_ifc_path, frag_path)

        if ok:
            print("  ✅ Success")
            success += 1
        else:
            print("  ❌ Fragmentation failed")
            print(err)
            fail += 1

    except Exception as e:
        print(f"  ❌ Error: {e}")
        fail += 1

# === SUMMARY ===

print("\n=== DONE ===")
print(f"✅ Success: {success}")
print(f"❌ Failed: {fail}")