from __future__ import annotations

import httpx

BSDD_BASE_URL = "https://api.bsdd.buildingsmart.org"


class BsddService:
    def __init__(self) -> None:
        self._client = httpx.AsyncClient(base_url=BSDD_BASE_URL, timeout=30.0)

    async def close(self) -> None:
        await self._client.aclose()

    async def get_dictionaries(self, limit: int = 100) -> dict:
        response = await self._client.get("/api/Dictionary/v1", params={"Limit": limit})
        response.raise_for_status()
        return response.json()

    async def search_classes(self, query: str, dictionary: str | None, lang: str = "EN", limit: int = 20) -> dict:
        params = {
            "SearchText": query,
            "LanguageCode": lang,
            "Limit": limit,
        }
        if dictionary:
            params["DictionaryUris"] = dictionary
        response = await self._client.get("/api/Class/search/v1", params=params)
        response.raise_for_status()
        return response.json()

    async def get_class(self, uri: str, lang: str = "EN") -> dict:
        response = await self._client.get(
            "/api/Class/v1",
            params={
                "uri": uri,
                "LanguageCode": lang,
                "IncludeClassProperties": True,
            },
        )
        response.raise_for_status()
        return response.json()
