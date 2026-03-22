from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from services.bsdd_service import BsddService

router = APIRouter(prefix="/api/bsdd", tags=["bsdd"])


def get_bsdd_service() -> BsddService:
    from main import bsdd_service

    return bsdd_service


@router.get("/dictionaries")
async def get_dictionaries(service: BsddService = Depends(get_bsdd_service)):
    return await service.get_dictionaries()


@router.get("/search")
async def search_classes(
    q: str = Query(...),
    dictionary: str | None = Query(default=None),
    lang: str = Query(default="EN"),
    limit: int = Query(default=20),
    service: BsddService = Depends(get_bsdd_service),
):
    return await service.search_classes(q, dictionary, lang, limit)


@router.get("/class")
async def get_class(uri: str, lang: str = "EN", service: BsddService = Depends(get_bsdd_service)):
    return await service.get_class(uri, lang)
