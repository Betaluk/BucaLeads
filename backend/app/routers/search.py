from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Search, Lead, SiteAudit
from app.schemas import SearchRequest, SearchResponse, LeadResponse
from app.collector import orchestrate_collection
from typing import List

router = APIRouter(prefix="/api/search", tags=["Search & Collection"])

@router.post("", response_model=List[LeadResponse])
async def create_search(req: SearchRequest, db: Session = Depends(get_db)):
    query = f"{req.niche} em {req.location}".strip()

    # Criar registro de busca
    search_record = Search(
        query=query,
        niche=req.niche,
        location=req.location,
        total_found=0
    )
    db.add(search_record)
    db.commit()
    db.refresh(search_record)

    # Executar coleta e auditoria
    collected = await orchestrate_collection(
        query=query,
        niche=req.niche,
        location=req.location,
        limit=req.limit,
        google_api_key=req.google_api_key,
        deep_audit=req.deep_audit
    )

    created_leads = []
    for item in collected:
        lead = Lead(
            search_id=search_record.id,
            business_name=item["business_name"],
            niche=item["niche"],
            address=item["address"],
            city=item["city"],
            state=item["state"],
            phone=item["phone"],
            phone_type=item["phone_type"],
            website=item["website"],
            website_status=item["website_status"],
            rating=item["rating"],
            review_count=item["review_count"],
            has_recent_activity=item["has_recent_activity"],
            source=item["source"],
            lead_score=item["lead_score"],
            score_tier=item["score_tier"],
            score_breakdown=item["score_breakdown"],
            crm_status="new"
        )
        db.add(lead)
        db.commit()
        db.refresh(lead)

        # Salvar auditoria se houver
        if item.get("audit_data"):
            audit_dict = item["audit_data"]
            audit = SiteAudit(
                lead_id=lead.id,
                url_tested=audit_dict.get("url_tested"),
                is_accessible=audit_dict.get("is_accessible", False),
                is_https=audit_dict.get("is_https", False),
                is_mobile_responsive=audit_dict.get("is_mobile_responsive", False),
                response_time_ms=audit_dict.get("response_time_ms", 0),
                redirects_to_social=audit_dict.get("redirects_to_social", False),
                social_network=audit_dict.get("social_network")
            )
            db.add(audit)
            db.commit()

        created_leads.append(lead)

    search_record.total_found = len(created_leads)
    db.commit()

    return created_leads

@router.get("/history", response_model=List[SearchResponse])
def get_search_history(db: Session = Depends(get_db)):
    searches = db.query(Search).order_by(Search.created_at.desc()).all()
    return searches
