import csv
import io
from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Lead

router = APIRouter(prefix="/api/export", tags=["Export"])

@router.get("/csv")
def export_leads_csv(crm_status: str = None, search_id: str = None, db: Session = Depends(get_db)):
    query = db.query(Lead)
    if crm_status:
        query = query.filter(Lead.crm_status == crm_status)
    if search_id:
        query = query.filter(Lead.search_id == search_id)
    leads = query.order_by(Lead.lead_score.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output, delimiter=";", quoting=csv.QUOTE_MINIMAL)

    # Header
    writer.writerow([
        "ID", "Nome da Empresa", "Nicho", "Score", "Tier", "Avaliações", "Nota",
        "Site", "Status do Site", "Telefone", "Tipo Telefone", "Status CRM",
        "Endereço", "Cidade", "Origem", "Criado Em"
    ])

    for l in leads:
        writer.writerow([
            l.id,
            l.business_name,
            l.niche,
            l.lead_score,
            l.score_tier,
            l.review_count,
            l.rating,
            l.website or "",
            l.website_status,
            l.phone or "",
            l.phone_type,
            l.crm_status,
            l.address or "",
            l.city or "",
            l.source,
            l.created_at.strftime("%d/%m/%Y %H:%M") if l.created_at else ""
        ])

    csv_data = output.getvalue().encode("utf-8-sig")  # utf-8-sig para abrir perfeitamente no Excel

    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=bucaleads_export.csv"}
    )
