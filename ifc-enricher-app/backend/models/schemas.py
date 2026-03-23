from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class PropertyValue(BaseModel):
    value: Any
    unit: str | None = None


class MaterialAssignment(BaseModel):
    elementExpressIds: list[int] = Field(default_factory=list)
    materialName: str
    materialCategory: str | None = None
    materialDescription: str | None = None
    bsddClassUri: str | None = None
    properties: dict[str, PropertyValue] = Field(default_factory=dict)


class EnrichRequest(BaseModel):
    assignments: list[MaterialAssignment] = Field(default_factory=list)


class UploadResponse(BaseModel):
    fileId: str
    fileName: str
    schema: str | None = None
    elementCount: int
    elementTypes: list[str] = Field(default_factory=list)


class ElementListItem(BaseModel):
    expressId: int
    globalId: str | None = None
    name: str | None = None
    ifcType: str
    hasGeometry: bool = False
    hasMaterial: bool = False


class ElementDetail(BaseModel):
    expressId: int
    globalId: str | None = None
    name: str | None = None
    ifcType: str
    properties: dict[str, Any] = Field(default_factory=dict)
    quantities: dict[str, Any] = Field(default_factory=dict)
    material: dict[str, Any] | None = None


class BsddClassSummary(BaseModel):
    uri: str | None = None
    name: str | None = None
    dictionaryName: str | None = None
    description: str | None = None


class BsddSearchResponse(BaseModel):
    classes: list[BsddClassSummary] = Field(default_factory=list)
    totalCount: int = 0
