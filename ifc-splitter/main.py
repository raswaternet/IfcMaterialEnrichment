"""
IFC Splitter - Progressive IFC to Linked Data Converter

Extracts semantic data from IFC to a single RDF/Turtle file:
- Materials, properties, classifications, types → data.ttl

The remaining IFC contains only geometry + spatial structure.
Output is organized per-model for GitHub Pages serving.
"""

import os
import sys
import shutil
import subprocess
import argparse
import re
import ifcopenshell
from rdflib import Graph

from extractors import MaterialExtractor
from rdf import bind_namespaces

# Future extractors to import:
# from extractors import TypeExtractor, PropertyExtractor, ClassificationExtractor

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
DEFAULT_MODELS_DIR = os.path.join(PROJECT_ROOT, "models")
IFC2FRAG_DIR = os.path.join(PROJECT_ROOT, "ifc2frag")


def slugify(name: str) -> str:
    """Convert a filename to a URL-safe slug."""
    # Remove file extension
    name = os.path.splitext(name)[0]
    # Replace spaces and special chars with hyphens
    name = re.sub(r'[^\w\-]', '-', name)
    # Collapse multiple hyphens
    name = re.sub(r'-+', '-', name)
    # Lowercase and strip
    return name.lower().strip('-')


def main():
    parser = argparse.ArgumentParser(
        description="Split IFC into Linked Data (RDF/Turtle) and geometry"
    )
    parser.add_argument("input", help="Input IFC file")
    parser.add_argument(
        "-o", "--output-dir",
        help=f"Output directory (default: {DEFAULT_MODELS_DIR}/{{model-slug}}/)"
    )
    parser.add_argument(
        "-n", "--name",
        help="Model name/slug (default: derived from filename)"
    )
    parser.add_argument(
        "--no-ifc",
        action="store_true",
        help="Skip saving the stripped IFC file"
    )
    parser.add_argument(
        "--no-frag",
        action="store_true",
        help="Skip generating fragments file"
    )
    args = parser.parse_args()

    # Validate input
    if not os.path.exists(args.input):
        print(f"Error: Input file not found: {args.input}")
        sys.exit(1)

    # Determine model name/slug
    original_name = os.path.basename(args.input)
    model_slug = args.name or slugify(original_name)

    # Determine output directory
    if args.output_dir:
        output_dir = args.output_dir
    else:
        output_dir = os.path.join(DEFAULT_MODELS_DIR, model_slug)

    # Create output directory
    os.makedirs(output_dir, exist_ok=True)

    # Copy source IFC to output folder
    source_dest = os.path.join(output_dir, "source.ifc")
    shutil.copy2(args.input, source_dest)

    print(f"Loading IFC: {args.input}")
    print(f"Model slug: {model_slug}")
    print(f"Output dir: {output_dir}")

    ifc = ifcopenshell.open(args.input)
    initial_count = len(list(ifc))
    print(f"  Schema: {ifc.schema}")
    print(f"  Entities: {initial_count}")

    # === EXTRACTION PIPELINE ===

    # Combined graph for all semantic data
    combined_graph = Graph()
    bind_namespaces(combined_graph)

    extractors = [
        MaterialExtractor(ifc, model_slug),
        # TypeExtractor(ifc, model_slug),
        # PropertyExtractor(ifc, model_slug),
        # ClassificationExtractor(ifc, model_slug),
    ]

    total_entities = 0
    total_relations = 0
    total_triples = 0

    for extractor in extractors:
        print(f"\nExtracting: {extractor.name}")

        graph = extractor.extract()

        # Merge into combined graph
        for triple in graph:
            combined_graph.add(triple)

        stats = extractor.stats
        total_entities += stats['entities_extracted']
        total_relations += stats['relations_extracted']
        total_triples += stats['triples_generated']

        print(f"  Entities: {stats['entities_extracted']}")
        print(f"  Relations: {stats['relations_extracted']}")
        print(f"  Triples: {stats['triples_generated']}")

    # Save combined RDF
    data_path = os.path.join(output_dir, "data.ttl")
    combined_graph.bind("inst", f"https://raswaternet.github.io/IfcMaterialEnrichment/models/{model_slug}/data.ttl#")
    combined_graph.serialize(destination=data_path, format="turtle")
    print(f"\nSemantic data saved: {data_path}")
    print(f"  Total triples: {len(combined_graph)}")

    # Save stripped IFC (always, unless --no-ifc)
    stripped_path = None
    if not args.no_ifc:
        stripped_path = os.path.join(output_dir, "geometry.ifc")
        ifc.write(stripped_path)
        final_count = len(list(ifc))
        removed_count = initial_count - final_count
        print(f"\nStripped IFC saved: {stripped_path}")
        print(f"  Remaining entities: {final_count}")
        print(f"  Removed: {removed_count} entities")

    # Generate fragments file using ifc2frag
    if not args.no_frag and stripped_path:
        frag_path = os.path.join(output_dir, "geometry.frag")
        print(f"\nGenerating fragments...")

        result = subprocess.run(
            ["node", "cli.js", stripped_path, frag_path],
            cwd=IFC2FRAG_DIR,
            capture_output=True,
            text=True
        )

        if result.returncode == 0:
            print(f"  Fragments saved: {frag_path}")
        else:
            print(f"  Warning: Fragment generation failed")
            print(f"  {result.stderr}")

    # Summary
    print(f"\n=== Output ===")
    print(f"  {output_dir}/")
    for f in sorted(os.listdir(output_dir)):
        fpath = os.path.join(output_dir, f)
        size = os.path.getsize(fpath)
        print(f"    {f} ({size // 1024}KB)")

    print("\nDone.")


if __name__ == "__main__":
    main()
