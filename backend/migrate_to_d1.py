"""
Script de Migração dos Dados Locais (leads.db) para o Cloudflare D1
Execute com: python migrate_to_d1.py
"""

import os
import sys
from dotenv import load_dotenv
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

# Carregar variáveis de ambiente
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR)
load_dotenv(os.path.join(ROOT_DIR, ".env"))
load_dotenv(os.path.join(BASE_DIR, ".env"))

# Importar modelos do BucaLeads
from app.models import Base, Search, Lead, SiteAudit

def main():
    print("=" * 60)
    print("[*] BucaLeads - Migracao de Dados: SQLite Local -> Cloudflare D1")
    print("=" * 60)

    # 1. Validar Credenciais D1
    cf_account_id = os.getenv("CLOUDFLARE_ACCOUNT_ID", "").strip()
    cf_db_id = os.getenv("CLOUDFLARE_D1_DATABASE_ID", "").strip()
    cf_api_token = os.getenv("CLOUDFLARE_API_TOKEN", "").strip()

    if not cf_account_id or not cf_db_id or not cf_api_token:
        print("\n[!] ERRO: Credenciais do Cloudflare D1 nao configuradas!")
        print("Por favor, crie ou edite o arquivo .env com:")
        print("  USE_CLOUDFLARE_D1=true")
        print("  CLOUDFLARE_ACCOUNT_ID=seu_account_id")
        print("  CLOUDFLARE_D1_DATABASE_ID=seu_d1_database_id")
        print("  CLOUDFLARE_API_TOKEN=seu_api_token\n")
        sys.exit(1)

    # 2. Conectar ao SQLite Local
    local_db_path = os.path.join(BASE_DIR, "leads.db")
    if not os.path.exists(local_db_path):
        print(f"\n[!] Aviso: Banco local '{local_db_path}' nao foi encontrado.")
        sys.exit(1)

    print(f"[*] Lendo dados locais de: {local_db_path}")
    local_engine = create_engine(f"sqlite:///{local_db_path}", connect_args={"check_same_thread": False})
    LocalSession = sessionmaker(bind=local_engine)
    local_session = LocalSession()

    # 3. Conectar ao Cloudflare D1
    print(f"[*] Conectando ao Cloudflare D1 (Database ID: {cf_db_id[:8]}...)...")
    d1_url = f"cloudflare_d1://{cf_account_id}:{cf_api_token}@{cf_db_id}"
    d1_engine = create_engine(d1_url)
    D1Session = sessionmaker(bind=d1_engine)
    d1_session = D1Session()

    # 4. Criar tabelas no D1 se não existirem
    print("[*] Garantindo que tabelas existam no Cloudflare D1...")
    Base.metadata.create_all(bind=d1_engine)

    # 5. Migrar Searches
    searches = local_session.query(Search).all()
    print(f"\n[*] Encontradas {len(searches)} buscas locais.")
    searches_migrated = 0
    for s in searches:
        exists = d1_session.query(Search).filter_by(id=s.id).first()
        if not exists:
            new_s = Search(
                id=s.id,
                query=s.query,
                niche=s.niche,
                location=s.location,
                total_found=s.total_found,
                new_leads=s.new_leads,
                existing_leads=s.existing_leads,
                created_at=s.created_at
            )
            d1_session.add(new_s)
            searches_migrated += 1
    d1_session.commit()
    print(f"   [OK] {searches_migrated} buscas sincronizadas com o D1.")

    # 6. Migrar Leads
    leads = local_session.query(Lead).all()
    print(f"\n[*] Encontrados {len(leads)} leads locais.")
    leads_migrated = 0
    for l in leads:
        exists = d1_session.query(Lead).filter_by(id=l.id).first()
        if not exists:
            new_l = Lead(
                id=l.id,
                search_id=l.search_id,
                business_name=l.business_name,
                niche=l.niche,
                address=l.address,
                city=l.city,
                state=l.state,
                phone=l.phone,
                phone_type=l.phone_type,
                website=l.website,
                website_status=l.website_status,
                rating=l.rating,
                review_count=l.review_count,
                has_recent_activity=l.has_recent_activity,
                source=l.source,
                lead_score=l.lead_score,
                score_tier=l.score_tier,
                score_breakdown=l.score_breakdown,
                crm_status=l.crm_status,
                notes=l.notes,
                created_at=l.created_at,
                updated_at=l.updated_at
            )
            d1_session.add(new_l)
            leads_migrated += 1
    d1_session.commit()
    print(f"   [OK] {leads_migrated} leads sincronizados com o D1.")

    # 7. Migrar Auditorias de Site
    audits = local_session.query(SiteAudit).all()
    print(f"\n[*] Encontradas {len(audits)} auditorias de site locais.")
    audits_migrated = 0
    for a in audits:
        exists = d1_session.query(SiteAudit).filter_by(id=a.id).first()
        if not exists:
            new_a = SiteAudit(
                id=a.id,
                lead_id=a.lead_id,
                url_tested=a.url_tested,
                is_accessible=a.is_accessible,
                is_https=a.is_https,
                is_mobile_responsive=a.is_mobile_responsive,
                response_time_ms=a.response_time_ms,
                redirects_to_social=a.redirects_to_social,
                social_network=a.social_network,
                audited_at=a.audited_at
            )
            d1_session.add(new_a)
            audits_migrated += 1
    d1_session.commit()
    print(f"   [OK] {audits_migrated} auditorias sincronizadas com o D1.")

    local_session.close()
    d1_session.close()

    print("\n" + "=" * 60)
    print("[SUCCESS] Migracao concluida com sucesso!")
    print("Agora seu BucaLeads compartilha a mesma base de dados na nuvem!")
    print("=" * 60)

if __name__ == "__main__":
    main()
