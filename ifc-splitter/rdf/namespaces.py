"""RDF namespace definitions for IFCX linked data conversion."""

from rdflib import Namespace, RDF, RDFS, OWL, XSD

# === IFCX Schema Namespaces (official bSI) ===
# bsi::ifc:: core types
IFC = Namespace("https://standards.buildingsmart.org/ifc/core/ifc@v5a.ifcx#")
# bsi::ifc::prop:: properties
IFC_PROP = Namespace("https://standards.buildingsmart.org/ifc/core/prop@v5a.ifcx#")
# bsi::ifc-mat:: material properties
IFC_MAT = Namespace("https://standards.buildingsmart.org/ifc/ifc-mat/ifc-mat@v1.0.0.ifcx#")
# ifc-presentation (with placeholder URI)
IFC_PRESENTATION = Namespace("https://data.example.org/ifc-presentation#")

# === Instance namespace (project-specific) ===
# IFCX_INST = Namespace("https://raswaternet.github.io/IfcMaterialEnrichment/")

# === bSDD namespaces (for semantic linking) ===
BSDD = Namespace("https://identifier.buildingsmart.org/uri/buildingsmart/ifc/4.3/")
BSDD_PROP = Namespace("https://identifier.buildingsmart.org/uri/buildingsmart/ifc/4.3/prop/")
BSDD_CLASS = Namespace("https://identifier.buildingsmart.org/uri/buildingsmart/ifc/4.3/class/")

# Midas Materials (for hello-wall.ifc)
MIDAS = Namespace("https://identifier.buildingsmart.org/uri/fish/midas-materials/26/class/")

# Naa.KT materials
NAAKT = Namespace("https://identifier.buildingsmart.org/uri/nkt/naakt/2.4/class/")

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
    "ifc-presentation": IFC_PRESENTATION,
    # "inst": IFCX_INST,
    "bsdd": BSDD,
    "bsdd-prop": BSDD_PROP,
    "bsdd-class": BSDD_CLASS,
    "dcterms": DCTERMS,
    "midas-materials": MIDAS,
    "naakt": NAAKT,
}


def bind_namespaces(graph):
    """Bind all namespaces to a graph for clean serialization."""
    for prefix, ns in NAMESPACE_BINDINGS.items():
        graph.bind(prefix, ns)
    return graph
