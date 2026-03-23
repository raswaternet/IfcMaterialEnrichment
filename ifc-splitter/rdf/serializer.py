"""RDF serialization utilities."""

from pathlib import Path
from rdflib import Graph
from .namespaces import bind_namespaces


def save_graph(graph: Graph, output_path: Path, format: str = "turtle") -> None:
    """Save an RDF graph to file with proper namespace bindings."""
    bind_namespaces(graph)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    graph.serialize(destination=str(output_path), format=format)
    print(f"  Saved: {output_path} ({len(graph)} triples)")


def merge_graphs(*graphs: Graph) -> Graph:
    """Merge multiple graphs into one."""
    merged = Graph()
    bind_namespaces(merged)
    for g in graphs:
        for triple in g:
            merged.add(triple)
    return merged
