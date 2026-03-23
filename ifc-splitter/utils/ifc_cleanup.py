"""Utility functions for safe IFC entity removal."""


def get_referencing_entities(ifc, entity):
    """Find all entities that reference the given entity."""
    refs = []
    for other in ifc:
        for attr in other:
            if attr is entity:
                refs.append(other)
            elif isinstance(attr, (list, tuple)):
                if entity in attr:
                    refs.append(other)
    return refs


def safe_remove(ifc, entity, force=False):
    """
    Safely remove an entity from an IFC file.

    Args:
        ifc: The ifcopenshell file
        entity: The entity to remove
        force: If True, also remove referencing entities (dangerous!)

    Returns:
        True if removed, False if couldn't remove
    """
    try:
        ifc.remove(entity)
        return True
    except RuntimeError as e:
        if "still referenced" in str(e).lower() and force:
            # Find and remove references first
            refs = get_referencing_entities(ifc, entity)
            for ref in refs:
                safe_remove(ifc, ref, force=True)
            # Try again
            try:
                ifc.remove(entity)
                return True
            except RuntimeError:
                return False
        return False


def remove_orphaned_entities(ifc, entity_types):
    """Remove entities of given types that are no longer referenced."""
    removed = 0
    for etype in entity_types:
        for entity in ifc.by_type(etype):
            refs = get_referencing_entities(ifc, entity)
            if not refs:
                if safe_remove(ifc, entity):
                    removed += 1
    return removed
