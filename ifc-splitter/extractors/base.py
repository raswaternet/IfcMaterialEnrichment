"""Base class for concept extractors."""

from abc import ABC, abstractmethod
from rdflib import Graph, Namespace
import ifcopenshell

from rdf import bind_namespaces, NAMESPACE_BINDINGS

# Base URL for all instances
BASE_URL = "https://raswaternet.github.io/IfcMaterialEnrichment/"


class ConceptExtractor(ABC):
    """
    Abstract base for extracting a semantic concept from IFC to RDF.

    Each extractor:
    1. Queries specific entity types from the IFC model
    2. Converts them to RDF triples
    3. Removes the entities from the model
    4. Returns the resulting graph
    """

    name: str = "base"

    # Entity types to extract (e.g., ["IfcMaterial", "IfcMaterialLayer"])
    entity_types: list[str] = []

    # Relationship types that connect these entities (e.g., ["IfcRelAssociatesMaterial"])
    relation_types: list[str] = []

    def __init__(self, ifc: ifcopenshell.file, model_slug: str):
        self.ifc = ifc
        self.model_slug = model_slug
        self.graph = Graph()

        # Create model-scoped instance namespace with data.ttl# fragment
        self.inst_ns = Namespace(f"{BASE_URL}models/{model_slug}/data.ttl#")

        # Bind standard namespaces plus model-specific instance namespace
        bind_namespaces(self.graph)
        self.graph.bind("inst", self.inst_ns)

        self._extracted_entities = []
        self._extracted_relations = []

    def extract(self) -> Graph:
        """Main extraction pipeline."""
        # Collect entities and relations
        self._collect_entities()
        self._collect_relations()

        # Convert to RDF
        self._convert_to_rdf()

        # Remove from IFC model
        self._remove_from_model()

        return self.graph

    def _collect_entities(self):
        """Collect all entities of the specified types, handling schema differences."""
        for etype in self.entity_types:
            try:
                # Only query if this entity type exists in the schema
                self._extracted_entities.extend(self.ifc.by_type(etype))
            except RuntimeError:
                # Entity type doesn't exist in this IFC schema version
                pass

    def _collect_relations(self):
        """Collect all relationships of the specified types."""
        for rtype in self.relation_types:
            self._extracted_relations.extend(self.ifc.by_type(rtype))

    @abstractmethod
    def _convert_to_rdf(self):
        """Convert collected entities to RDF triples. Override in subclass."""
        pass

    def _remove_from_model(self):
        """Remove extracted entities from the IFC model."""
        # Remove relations first (they reference the entities)
        for rel in self._extracted_relations:
            try:
                self.ifc.remove(rel)
            except RuntimeError:
                pass  # Already removed or has dependencies

        # Remove entities
        for entity in self._extracted_entities:
            try:
                # Only remove if not referenced elsewhere
                self.ifc.remove(entity)
            except RuntimeError:
                pass  # Has remaining references

    def save_rdf(self, output_path: str, format: str = "turtle"):
        """Save the extracted graph to a file."""
        self.graph.serialize(destination=output_path, format=format)

    @property
    def stats(self) -> dict:
        """Return extraction statistics."""
        return {
            "name": self.name,
            "entities_extracted": len(self._extracted_entities),
            "relations_extracted": len(self._extracted_relations),
            "triples_generated": len(self.graph),
        }
