import httpx
from typing import List, Dict, Any, Optional

class GooglePlacesCollector:
    """
    Coletor oficial do Google Places API (Text Search & Details).
    Usado quando uma API Key válida é fornecida e há cota disponível.
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key

    async def search_places(self, query: str, limit: int = 20) -> List[Dict[str, Any]]:
        if not self.api_key:
            return []

        endpoint = "https://maps.googleapis.com/maps/api/place/textsearch/json"
        results = []
        next_page_token = None

        async with httpx.AsyncClient(timeout=15.0) as client:
            while len(results) < limit:
                params = {
                    "query": query,
                    "key": self.api_key,
                    "language": "pt-BR"
                }
                if next_page_token:
                    params["pagetoken"] = next_page_token

                resp = await client.get(endpoint, params=params)
                if resp.status_code != 200:
                    break

                data = resp.json()
                places = data.get("results", [])
                for p in places:
                    place_id = p.get("place_id")
                    details = await self._get_place_details(client, place_id)
                    results.append(details)
                    if len(results) >= limit:
                        break

                next_page_token = data.get("next_page_token")
                if not next_page_token:
                    break

        return results

    async def _get_place_details(self, client: httpx.AsyncClient, place_id: str) -> Dict[str, Any]:
        endpoint = "https://maps.googleapis.com/maps/api/place/details/json"
        params = {
            "place_id": place_id,
            "fields": "name,formatted_address,formatted_phone_number,international_phone_number,website,rating,user_ratings_total,reviews,types",
            "key": self.api_key,
            "language": "pt-BR"
        }
        resp = await client.get(endpoint, params=params)
        if resp.status_code != 200:
            return {}

        result = resp.json().get("result", {})
        reviews = result.get("reviews", [])
        has_recent = False
        # Checar se há reviews recentes com resposta
        if reviews:
            for r in reviews:
                if "author_name" in r:
                    has_recent = True
                    break

        return {
            "business_name": result.get("name", "Sem nome"),
            "address": result.get("formatted_address", ""),
            "phone": result.get("formatted_phone_number") or result.get("international_phone_number", ""),
            "website": result.get("website", ""),
            "rating": float(result.get("rating", 0.0)),
            "review_count": int(result.get("user_ratings_total", 0)),
            "has_recent_activity": has_recent,
            "source": "google_places_api"
        }
