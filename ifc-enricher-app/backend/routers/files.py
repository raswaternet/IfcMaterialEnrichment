from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse

from services.ifc_service import IfcService

router = APIRouter(prefix="/api", tags=["files"])


def get_ifc_service() -> IfcService:
    from main import ifc_service

    return ifc_service


@router.post("/upload")
async def upload_file(file: UploadFile = File(...), service: IfcService = Depends(get_ifc_service)):
    if not file.filename or not file.filename.lower().endswith(".ifc"):
        raise HTTPException(status_code=400, detail="Only .ifc files are accepted")
    data = await file.read()
    file_id = service.save_upload_bytes(file.filename, data)
    return service.summarize_model(file_id)


@router.get("/files/{file_id}/raw")
def get_raw_file(file_id: str, service: IfcService = Depends(get_ifc_service)):
    path = service.raw_file_path(file_id)
    return FileResponse(path, media_type="application/octet-stream", filename=path.name)


@router.get("/files/{file_id}/elements")
def list_elements(file_id: str, type: str | None = Query(default=None), service: IfcService = Depends(get_ifc_service)):
    return service.list_elements(file_id, type)


@router.get("/files/{file_id}/elements/{express_id}")
def get_element(file_id: str, express_id: int, service: IfcService = Depends(get_ifc_service)):
    try:
        return service.get_element_detail(file_id, express_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Element not found") from exc


@router.get("/files/{file_id}/download")
def download_file(file_id: str, service: IfcService = Depends(get_ifc_service)):
    path = service.raw_file_path(file_id)
    return FileResponse(path, media_type="application/octet-stream", filename=Path(path).name)
