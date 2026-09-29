from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from app.database import get_db
from app.models import Lead, SiteAudit
from app.schemas import LeadResponse, LeadUpdateStatus, LeadUpdateNotes, PitchResponse
from app.services.pitch import PitchGenerator

router = APIRouter(prefix="/api/leads", tags=["Leads & CRM"])

@router.get("", response_model=List[LeadResponse])
def get_leads(
    crm_status: Optional[str] = None,
    score_tier: Optional[str] = None,
    niche: Optional[str] = None,
    website_status: Optional[str] = None,
    search_id: Optional[str] = None,
    min_score: Optional[int] = None,
    only_mobile: bool = False,
    db: Session = Depends(get_db)
):
    query = db.query(Lead)

    if crm_status:
        query = query.filter(Lead.crm_status == crm_status)
    if score_tier:
        query = query.filter(Lead.score_tier == score_tier)
    if niche:
        query = query.filter(Lead.niche.ilike(f"%{niche}%"))
    if website_status:
        query = query.filter(Lead.website_status == website_status)
    if search_id:
        query = query.filter(Lead.search_id == search_id)
    if min_score is not None:
        query = query.filter(Lead.lead_score >= min_score)
    if only_mobile:
        query = query.filter(Lead.phone_type == "mobile")

    # Sempre ordenar pelo maior Lead Score
    leads = query.order_by(Lead.lead_score.desc(), Lead.created_at.desc()).all()
    return leads

@router.get("/stats")
def get_lead_stats(db: Session = Depends(get_db)) -> Dict[str, Any]:
    leads = db.query(Lead).all()
    total = len(leads)
    hot = sum(1 for l in leads if l.score_tier == "hot")
    warm = sum(1 for l in leads if l.score_tier == "warm")
    cold = sum(1 for l in leads if l.score_tier == "cold")
    no_site = sum(1 for l in leads if l.website_status == "none")
    with_mobile = sum(1 for l in leads if l.phone_type == "mobile")

    by_status = {
        "new": sum(1 for l in leads if l.crm_status == "new"),
        "contacted": sum(1 for l in leads if l.crm_status == "contacted"),
        "in_conversation": sum(1 for l in leads if l.crm_status == "in_conversation"),
        "proposal_sent": sum(1 for l in leads if l.crm_status == "proposal_sent"),
        "won": sum(1 for l in leads if l.crm_status == "won"),
        "lost": sum(1 for l in leads if l.crm_status == "lost"),
    }

    return {
        "total": total,
        "hot": hot,
        "warm": warm,
        "cold": cold,
        "no_site": no_site,
        "with_mobile": with_mobile,
        "by_status": by_status
    }

@router.get("/{lead_id}", response_model=LeadResponse)
def get_lead(lead_id: str, db: Session = Depends(get_db)):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead não encontrado")
    return lead

@router.patch("/{lead_id}/status", response_model=LeadResponse)
def update_lead_status(lead_id: str, body: LeadUpdateStatus, db: Session = Depends(get_db)):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead não encontrado")
    
    valid_statuses = {"new", "contacted", "in_conversation", "proposal_sent", "won", "lost"}
    if body.crm_status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Status CRM inválido")

    lead.crm_status = body.crm_status
    db.commit()
    db.refresh(lead)
    return lead

@router.patch("/{lead_id}/notes", response_model=LeadResponse)
def update_lead_notes(lead_id: str, body: LeadUpdateNotes, db: Session = Depends(get_db)):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead não encontrado")

    lead.notes = body.notes
    db.commit()
    db.refresh(lead)
    return lead

@router.delete("/{lead_id}")
def delete_lead(lead_id: str, db: Session = Depends(get_db)):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead não encontrado")

    db.delete(lead)
    db.commit()
    return {"message": "Lead excluído com sucesso", "id": lead_id}

@router.get("/{lead_id}/pitch", response_model=PitchResponse)
def generate_lead_pitch(lead_id: str, db: Session = Depends(get_db)):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead não encontrado")

    lead_dict = {
        "business_name": lead.business_name,
        "niche": lead.niche,
        "city": lead.city or "sua região",
        "rating": lead.rating,
        "review_count": lead.review_count,
        "website": lead.website,
        "website_status": lead.website_status,
        "phone": lead.phone
    }

    pitch_data = PitchGenerator.generate_pitch(lead_dict)

    return PitchResponse(
        lead_id=lead.id,
        business_name=lead.business_name,
        phone=pitch_data.get("phone"),
        whatsapp_url=pitch_data.get("whatsapp_url"),
        pitch_text=pitch_data.get("pitch_text", ""),
        scenario=pitch_data.get("scenario", "default")
    )
