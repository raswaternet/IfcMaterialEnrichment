"""IFC GlobalId ↔ UUID conversion utilities."""

import ifcopenshell.guid


def guid_to_uuid(global_id: str) -> str:
    """
    Convert IFC GlobalId (22-char base64) to standard UUID format.

    Args:
        global_id: IFC GlobalId string (e.g., "0YvctS3H8Hm00x3$2o_GU2")

    Returns:
        UUID string with dashes (e.g., "22e66ddc-0d12-11c0-003b-0f2f90000782")
    """
    hex_uuid = ifcopenshell.guid.expand(global_id)
    return f"{hex_uuid[:8]}-{hex_uuid[8:12]}-{hex_uuid[12:16]}-{hex_uuid[16:20]}-{hex_uuid[20:]}"


def uuid_to_guid(uuid: str) -> str:
    """
    Convert UUID to IFC GlobalId (22-char base64).

    Args:
        uuid: UUID string with or without dashes

    Returns:
        IFC GlobalId string (22 characters)
    """
    hex_uuid = uuid.replace("-", "")
    return ifcopenshell.guid.compress(hex_uuid)


def make_instance_iri(global_id: str, base: str = "https://raswaternet.github.io/IfcMaterialEnrichment/") -> str:
    """
    Create a full IRI for an IFC element.

    Args:
        global_id: IFC GlobalId
        base: Base namespace for instances

    Returns:
        Full IRI string
    """
    return f"{base}{guid_to_uuid(global_id)}"
