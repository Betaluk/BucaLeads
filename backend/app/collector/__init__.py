import asyncio
from typing import List, Dict, Any, Optional
from app.collector.gplaces import GooglePlacesCollector
from app.collector.scraper import GoogleMapsScraper
from app.collector.inspector import inspect_website
from app.services.scoring import calculate_lead_score, classify_phone

async def orchestrate_collection(
    query: str,
    niche: str,
    location: str,
    limit: int = 20,
    google_api_key: Optional[str] = None,
    deep_audit: bool = True
) -> List[Dict[str, Any]]:
    """
    Orquestra a coleta híbrida (Google Places API + Playwright Scraper),
    executa a auditoria assíncrona concorrente dos sites e calcula o Lead Score final.
    """
    raw_leads: List[Dict[str, Any]] = []

    # 1. Tentar API Oficial se chave estiver presente
    if google_api_key and google_api_key.strip():
        try:
            gplaces = GooglePlacesCollector(api_key=google_api_key.strip())
            api_results = await gplaces.search_places(query, limit=limit)
            raw_leads.extend(api_results)
        except Exception as e:
            print(f"[API Collector Warning] Falha na API oficial: {e}")

    # 2. Se a API não preencheu o limite ou não há chave, usar Playwright Scraper
    remaining = limit - len(raw_leads)
    if remaining > 0:
        try:
            scraper = GoogleMapsScraper(headless=True)
            scraped = await scraper.search(query, limit=remaining)
            existing_names = {l["business_name"].lower() for l in raw_leads}
            for s in scraped:
                if s["business_name"].lower() not in existing_names:
                    raw_leads.append(s)
        except Exception as e:
            print(f"[Scraper Warning] Falha no scraper Playwright: {e}")

    # 3. Enriquecer cada lead com Auditoria e Lead Scoring em paralelo
    async def enrich_lead(raw: Dict[str, Any]) -> Dict[str, Any]:
        website = raw.get("website") or ""
        audit_data = None
        website_status = "none"

        # Validar website (remover lixo ou parâmetros inválidos)
        if website:
            website = website.strip()
            if website.startswith("/aclk") or "googleadservices" in website or website.startswith("https://www.google.com"):
                website = ""

        if website and deep_audit:
            try:
                # Limite de 4.0s para não travar a requisição geral
                audit_data = await asyncio.wait_for(inspect_website(website), timeout=4.0)
                website_status = audit_data.get("website_status", "healthy")
            except Exception:
                website_status = "insecure"
        elif website:
            website_status = "healthy"

        rating = float(raw.get("rating", 0.0))
        review_count = int(raw.get("review_count", 0))
        phone = raw.get("phone") or ""
        phone_type = classify_phone(phone)
        has_recent = bool(raw.get("has_recent_activity", False))

        score, tier, breakdown = calculate_lead_score(
            website=website,
            website_status=website_status,
            review_count=review_count,
            rating=rating,
            phone=phone,
            has_recent_activity=has_recent
        )

        return {
            "business_name": raw.get("business_name", "Sem Nome"),
            "niche": niche,
            "address": raw.get("address", ""),
            "city": location.split(",")[0].strip() if "," in location else location.strip(),
            "state": location.split(",")[1].strip() if "," in location else "",
            "phone": phone,
            "phone_type": phone_type,
            "website": website,
            "website_status": website_status,
            "rating": rating,
            "review_count": review_count,
            "has_recent_activity": has_recent,
            "source": raw.get("source", "local_scraper"),
            "lead_score": score,
            "score_tier": tier,
            "score_breakdown": breakdown,
            "audit_data": audit_data
        }

    # Executar enriquecimento concorrente
    if raw_leads:
        enriched_leads = await asyncio.gather(*(enrich_lead(r) for r in raw_leads))
        enriched_leads = list(enriched_leads)
    else:
        enriched_leads = []

    # Ordenar pelos melhores leads (maior score primeiro)
    enriched_leads.sort(key=lambda x: x["lead_score"], reverse=True)

    return enriched_leads
