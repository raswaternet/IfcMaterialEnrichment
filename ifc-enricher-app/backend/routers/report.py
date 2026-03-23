from __future__ import annotations

from fastapi import APIRouter, Depends

from services.ifc_service import IfcService

router = APIRouter(prefix="/api/files", tags=["report"])


def get_ifc_service() -> IfcService:
    from main import ifc_service

    return ifc_service


@router.get("/{file_id}/report")
def get_report(file_id: str, service: IfcService = Depends(get_ifc_service)):
    return service.generate_report(file_id)
