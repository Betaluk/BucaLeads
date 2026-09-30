from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Search, Lead, SiteAudit
from app.schemas import SearchRequest, SearchResponse, LeadResponse, SearchResultResponse
from app.collector import orchestrate_collection
from app.services.dedup import find_existing_lead
from typing import List, Optional

router = APIRouter(prefix="/api/search", tags=["Search & Collection"])

@router.post("", response_model=SearchResultResponse)
async def create_search(req: SearchRequest, db: Session = Depends(get_db)):
    query = f"{req.niche} em {req.location}".strip()

    # Criar registro de busca
    search_record = Search(
        query=query,
        niche=req.niche,
        location=req.location,
        total_found=0,
        new_leads=0,
        existing_leads=0
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

    result_leads = []
    new_count = 0
    existing_count = 0

    for item in collected:
        # Verificar se lead já existe na base através da inteligência de deduplicação
        existing = find_existing_lead(
            db=db,
            business_name=item["business_name"],
            phone=item.get("phone"),
            website=item.get("website"),
            city=item.get("city")
        )

        if existing:
            # Opção de pular leads existentes
            if req.skip_existing:
                continue

            existing_count += 1

            # PRESERVAR STATUS E NOTAS: Nunca reiniciar status do funil ou apagar notas do usuário
            # Atualizar dados métricos mais recentes
            if item.get("rating") is not None and item["rating"] > 0:
                existing.rating = item["rating"]
            if item.get("review_count") is not None and item["review_count"] > 0:
                existing.review_count = item["review_count"]
            if item.get("has_recent_activity") is not None:
                existing.has_recent_activity = item["has_recent_activity"]

            # Se não tinha telefone ou site antes, atualizar
            if not existing.phone and item.get("phone"):
                existing.phone = item["phone"]
                existing.phone_type = item["phone_type"]
            if not existing.website and item.get("website"):
                existing.website = item["website"]
                existing.website_status = item["website_status"]

            # Atualizar lead score com base na auditoria atual
            existing.lead_score = item["lead_score"]
            existing.score_tier = item["score_tier"]
            existing.score_breakdown = item["score_breakdown"]
            existing.updated_at = datetime.utcnow()

            # Salvar nova auditoria se houver
            if item.get("audit_data"):
                audit_dict = item["audit_data"]
                audit = SiteAudit(
                    lead_id=existing.id,
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
            db.refresh(existing)

            # Atributo transitório para resposta na API
            setattr(existing, "is_existing", True)
            result_leads.append(existing)

        else:
            new_count += 1
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

            setattr(lead, "is_existing", False)
            result_leads.append(lead)

    search_record.total_found = len(result_leads)
    search_record.new_leads = new_count
    search_record.existing_leads = existing_count
    db.commit()

    return SearchResultResponse(
        search_id=search_record.id,
        query=search_record.query,
        niche=search_record.niche,
        location=search_record.location,
        total_found=len(result_leads),
        new_count=new_count,
        existing_count=existing_count,
        leads=result_leads
    )

@router.get("/history", response_model=List[SearchResponse])
def get_search_history(db: Session = Depends(get_db)):
    searches = db.query(Search).order_by(Search.created_at.desc()).all()
    res = []
    for s in searches:
        lead_count = db.query(Lead).filter(Lead.search_id == s.id).count()
        item = SearchResponse(
            id=s.id,
            query=s.query,
            niche=s.niche,
            location=s.location,
            total_found=s.total_found,
            new_leads=s.new_leads or 0,
            existing_leads=s.existing_leads or 0,
            lead_count=lead_count,
            created_at=s.created_at
        )
        res.append(item)
    return res

@router.delete("/{search_id}")
def delete_search(
    search_id: str,
    delete_leads: bool = Query(False, description="Se verdadeiro, remove leads não movimentados desta busca"),
    db: Session = Depends(get_db)
):
    search = db.query(Search).filter(Search.id == search_id).first()
    if not search:
        raise HTTPException(status_code=404, detail="Busca não encontrada")

    deleted_leads_count = 0
    if delete_leads:
        # Excluir apenas os leads associados que AINDA estão em status 'new' e sem anotações
        leads_to_delete = db.query(Lead).filter(
            Lead.search_id == search_id,
            Lead.crm_status == "new",
            (Lead.notes == None) | (Lead.notes == "")
        ).all()
        for l in leads_to_delete:
            db.delete(l)
            deleted_leads_count += 1

    # Desvincular quaisquer leads restantes para não haver violação de FK
    remaining_leads = db.query(Lead).filter(Lead.search_id == search_id).all()
    for l in remaining_leads:
        l.search_id = None

    db.delete(search)
    db.commit()

    return {
        "message": "Busca excluída com sucesso",
        "search_id": search_id,
        "deleted_leads": deleted_leads_count
    }
