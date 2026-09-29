from app.database import SessionLocal
from app.models import Search, Lead, SiteAudit
from app.services.scoring import calculate_lead_score

def seed_sample_data():
    db = SessionLocal()
    try:
        # Se já tiver leads, não duplicar
        if db.query(Lead).count() > 0:
            print("Banco já contém leads. Pulando seed.")
            return

        search = Search(
            query="Odontologia em Curitiba, PR",
            niche="Clínica Odontológica",
            location="Curitiba, PR",
            total_found=3
        )
        db.add(search)
        db.commit()
        db.refresh(search)

        samples = [
            {
                "business_name": "Clínica Sorriso & Arte Curitiba",
                "niche": "Clínica Odontológica",
                "address": "Av. Sete de Setembro, 3210 - Batel, Curitiba - PR",
                "city": "Curitiba",
                "state": "PR",
                "phone": "(41) 99822-1144",
                "phone_type": "mobile",
                "website": "",
                "website_status": "none",
                "rating": 4.9,
                "review_count": 340,
                "has_recent_activity": True,
                "source": "local_scraper",
                "crm_status": "new"
            },
            {
                "business_name": "Instituto Dental Batel",
                "niche": "Clínica Odontológica",
                "address": "Rua Bispo Dom José, 2100 - Batel, Curitiba - PR",
                "city": "Curitiba",
                "state": "PR",
                "phone": "(41) 98711-2233",
                "phone_type": "mobile",
                "website": "https://instagram.com/institutodentalbatel",
                "website_status": "social_media",
                "rating": 4.7,
                "review_count": 185,
                "has_recent_activity": True,
                "source": "google_places_api",
                "crm_status": "contacted"
            },
            {
                "business_name": "Odonto Centro Express",
                "niche": "Clínica Odontológica",
                "address": "Rua XV de Novembro, 850 - Centro, Curitiba - PR",
                "city": "Curitiba",
                "state": "PR",
                "phone": "(41) 3222-4455",
                "phone_type": "landline",
                "website": "http://odontocentroexpress.com.br",
                "website_status": "insecure",
                "rating": 4.4,
                "review_count": 82,
                "has_recent_activity": False,
                "source": "local_scraper",
                "crm_status": "in_conversation"
            }
        ]

        for s in samples:
            score, tier, breakdown = calculate_lead_score(
                website=s["website"],
                website_status=s["website_status"],
                review_count=s["review_count"],
                rating=s["rating"],
                phone=s["phone"],
                has_recent_activity=s["has_recent_activity"]
            )

            lead = Lead(
                search_id=search.id,
                business_name=s["business_name"],
                niche=s["niche"],
                address=s["address"],
                city=s["city"],
                state=s["state"],
                phone=s["phone"],
                phone_type=s["phone_type"],
                website=s["website"],
                website_status=s["website_status"],
                rating=s["rating"],
                review_count=s["review_count"],
                has_recent_activity=s["has_recent_activity"],
                source=s["source"],
                lead_score=score,
                score_tier=tier,
                score_breakdown=breakdown,
                crm_status=s["crm_status"]
            )
            db.add(lead)
            db.commit()

        print("Seed finalizado com sucesso!")
    finally:
        db.close()

if __name__ == "__main__":
    seed_sample_data()
