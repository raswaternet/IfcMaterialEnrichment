from __future__ import annotations

from fastapi import APIRouter, Depends

from models.schemas import EnrichRequest
from services.ifc_service import IfcService

router = APIRouter(prefix="/api/files", tags=["enrich"])


def get_ifc_service() -> IfcService:
    from main import ifc_service

    return ifc_service


@router.post("/{file_id}/enrich")
def enrich_file(file_id: str, payload: EnrichRequest, service: IfcService = Depends(get_ifc_service)):
    return service.enrich(file_id, payload.assignments)
