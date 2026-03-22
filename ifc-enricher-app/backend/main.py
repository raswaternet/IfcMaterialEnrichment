from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from routers import bsdd, enrich, files, report
from services.bsdd_service import BsddService
from services.ifc_service import IfcService

UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "/app/uploads")

ifc_service = IfcService(UPLOAD_DIR)
bsdd_service = BsddService()

app = FastAPI(title="IFC Material Enrichment API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(files.router)
app.include_router(bsdd.router)
app.include_router(enrich.router)
app.include_router(report.router)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.get("/api/health")
def healthcheck():
    return {"ok": True}


@app.on_event("shutdown")
async def shutdown_event():
    await bsdd_service.close()
