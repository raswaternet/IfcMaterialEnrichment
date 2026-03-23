"""RDF namespace definitions for IFCX linked data conversion."""

from rdflib import Namespace, RDF, RDFS, OWL, XSD

# === IFCX Schema Namespaces (official bSI) ===
# bsi::ifc:: core types
IFC = Namespace("https://standards.buildingsmart.org/ifc/core/ifc@v5a.ifcx#")
# bsi::ifc::prop:: properties
IFC_PROP = Namespace("https://standards.buildingsmart.org/ifc/core/prop@v5a.ifcx#")
# bsi::ifc-mat:: material properties
IFC_MAT = Namespace("https://standards.buildingsmart.org/ifc/ifc-mat/ifc-mat@v1.0.0.ifcx#")

# === Instance namespace (project-specific) ===
IFCX_INST = Namespace("https://raswaternet.github.io/IfcMaterialEnrichment/")

# === bSDD namespaces (for semantic linking) ===
BSDD = Namespace("https://identifier.buildingsmart.org/uri/buildingsmart/ifc/4.3/")
BSDD_PROP = Namespace("https://identifier.buildingsmart.org/uri/buildingsmart/ifc/4.3/prop/")
BSDD_CLASS = Namespace("https://identifier.buildingsmart.org/uri/buildingsmart/ifc/4.3/class/")

# Dublin Core for composition relations
DCTERMS = Namespace("http://purl.org/dc/terms/")

# All namespace bindings for serialization
NAMESPACE_BINDINGS = {
    "rdf": RDF,
    "rdfs": RDFS,
    "owl": OWL,
    "xsd": XSD,
    "ifc": IFC,
    "ifc-prop": IFC_PROP,
    "ifc-mat": IFC_MAT,
    "inst": IFCX_INST,
    "bsdd": BSDD,
    "bsdd-prop": BSDD_PROP,
    "bsdd-class": BSDD_CLASS,
    "dcterms": DCTERMS,
}


def bind_namespaces(graph):
    """Bind all namespaces to a graph for clean serialization."""
    for prefix, ns in NAMESPACE_BINDINGS.items():
        graph.bind(prefix, ns)
    return graph
