import re
import unicodedata
import urllib.parse
from datetime import datetime
from typing import Optional, Dict, Any, Tuple, List
from sqlalchemy.orm import Session
from app.models import Lead, SiteAudit

def normalize_text(text: Optional[str]) -> str:
    """Normaliza texto removendo acentos, pontuação e múltiplos espaços."""
    if not text:
        return ""
    # Remover acentuação
    text = unicodedata.normalize('NFKD', str(text))
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = text.lower()
    # Remover pontuações comuns
    text = re.sub(r'[\-\|\/\&\+\(\)\.\,\:\;\"\'\’\_\@\#\$\%\*\!\?]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def normalize_phone(phone: Optional[str]) -> str:
    """Extrai somente os dígitos do telefone e remove DDI 55 se presente."""
    if not phone:
        return ""
    digits = re.sub(r'\D', '', str(phone)).lstrip('0')
    if digits.startswith('55') and len(digits) in (12, 13):
        digits = digits[2:]
    return digits

def normalize_domain(url: Optional[str]) -> str:
    """Extrai o domínio limpo da URL, ignorando redes sociais genéricas."""
    if not url:
        return ""
    url = str(url).strip()
    if not url.startswith(('http://', 'https://')):
        url = 'http://' + url
    try:
        parsed = urllib.parse.urlparse(url)
        netloc = parsed.netloc.lower()
        if netloc.startswith('www.'):
            netloc = netloc[4:]
        
        # Ignorar plataformas sociais e links genéricos que não identificam a empresa de forma única
        generic_domains = [
            'instagram.com', 'facebook.com', 'linktr.ee', 'wa.me',
            'api.whatsapp.com', 'whatsapp.com', 'google.com',
            'maps.google.com', 'bio.site', 'linkr.bio', 'globo.com'
        ]
        if any(g in netloc for g in generic_domains) or len(netloc) < 4:
            return ""
        return netloc
    except Exception:
        return ""

def find_existing_lead(
    db: Session,
    business_name: str,
    phone: Optional[str] = None,
    website: Optional[str] = None,
    city: Optional[str] = None
) -> Optional[Lead]:
    """
    Inteligência de deduplicação multifatorial:
    1. Correspondência por Telefone (se informado)
    2. Correspondência por Domínio do Site (se domínio próprio válido)
    3. Correspondência por Nome da Empresa normalizado + Cidade
    """
    clean_phone = normalize_phone(phone)
    clean_domain = normalize_domain(website)
    clean_name = normalize_text(business_name)
    clean_city = normalize_text(city)

    all_leads = db.query(Lead).all()

    # 1. Checar por Telefone
    if clean_phone and len(clean_phone) >= 8:
        for lead in all_leads:
            if not lead.phone:
                continue
            l_phone = normalize_phone(lead.phone)
            if not l_phone:
                continue
            # Correspondência exata de telefone ou últimos 8 dígitos (abrange celulares com ou sem 9)
            if l_phone == clean_phone:
                return lead
            if len(l_phone) >= 8 and len(clean_phone) >= 8 and l_phone[-8:] == clean_phone[-8:]:
                # Se os últimos 8 dígitos batem e DDD é o mesmo ou cidade/nome é compatível
                if len(l_phone) >= 10 and len(clean_phone) >= 10 and l_phone[:2] == clean_phone[:2]:
                    return lead

    # 2. Checar por Domínio de Website Próprio
    if clean_domain:
        for lead in all_leads:
            if not lead.website:
                continue
            l_domain = normalize_domain(lead.website)
            if l_domain and l_domain == clean_domain:
                return lead

    # 3. Checar por Nome Comercial Normalizado (+ Cidade)
    if clean_name and len(clean_name) >= 3:
        for lead in all_leads:
            l_name = normalize_text(lead.business_name)
            if not l_name:
                continue
            
            # Se nomes são exatamente iguais após normalização
            if l_name == clean_name:
                return lead
            
            # Se um nome contém o outro e a diferença de tamanho é pequena
            if (clean_name in l_name or l_name in clean_name):
                shorter = min(len(clean_name), len(l_name))
                longer = max(len(clean_name), len(l_name))
                if shorter >= 6 and (shorter / longer) >= 0.75:
                    l_city = normalize_text(lead.city)
                    if not clean_city or not l_city or clean_city == l_city:
                        return lead

    return None

def cleanup_duplicate_leads(db: Session) -> Dict[str, Any]:
    """
    Varre a base de leads, consolida registros duplicados mantendo
    o lead mais relevante (priorizando o que já tem status alterado no CRM ou notas)
    e exclui as duplicatas redundantes.
    """
    leads = db.query(Lead).order_by(Lead.created_at.asc()).all()
    if not leads:
        return {"merged_groups": 0, "removed_leads": 0, "remaining_leads": 0}

    visited_ids = set()
    duplicate_groups: List[List[Lead]] = []

    for i in range(len(leads)):
        l1 = leads[i]
        if l1.id in visited_ids:
            continue
        group = [l1]
        visited_ids.add(l1.id)

        clean_p1 = normalize_phone(l1.phone)
        clean_d1 = normalize_domain(l1.website)
        clean_n1 = normalize_text(l1.business_name)
        clean_c1 = normalize_text(l1.city)

        for j in range(i + 1, len(leads)):
            l2 = leads[j]
            if l2.id in visited_ids:
                continue

            is_dup = False
            clean_p2 = normalize_phone(l2.phone)
            clean_d2 = normalize_domain(l2.website)
            clean_n2 = normalize_text(l2.business_name)
            clean_c2 = normalize_text(l2.city)

            # Match por telefone
            if clean_p1 and clean_p2 and (clean_p1 == clean_p2 or (len(clean_p1) >= 8 and len(clean_p2) >= 8 and clean_p1[-8:] == clean_p2[-8:])):
                is_dup = True
            # Match por domínio
            elif clean_d1 and clean_d2 and clean_d1 == clean_d2:
                is_dup = True
            # Match por nome idêntico normalizado
            elif clean_n1 and clean_n2 and clean_n1 == clean_n2:
                is_dup = True

            if is_dup:
                group.append(l2)
                visited_ids.add(l2.id)

        if len(group) > 1:
            duplicate_groups.append(group)

    removed_count = 0

    for group in duplicate_groups:
        # Escolher o lead principal:
        # Prioridade 1: status diferente de 'new'
        # Prioridade 2: tem anotações comerciais
        # Prioridade 3: maior lead_score
        def rank_lead(l: Lead) -> Tuple[int, int, int]:
            has_moved = 1 if l.crm_status != "new" else 0
            has_notes = 1 if (l.notes and len(l.notes.strip()) > 0) else 0
            score = l.lead_score or 0
            return (has_moved, has_notes, score)

        group.sort(key=rank_lead, reverse=True)
        primary = group[0]
        duplicates = group[1:]

        # Mesclar informações úteis das duplicatas que estejam vazias no primário
        for dup in duplicates:
            if not primary.phone and dup.phone:
                primary.phone = dup.phone
                primary.phone_type = dup.phone_type
            if not primary.website and dup.website:
                primary.website = dup.website
                primary.website_status = dup.website_status
            if not primary.address and dup.address:
                primary.address = dup.address
            if not primary.city and dup.city:
                primary.city = dup.city
            if not primary.state and dup.state:
                primary.state = dup.state
            if dup.notes and not primary.notes:
                primary.notes = dup.notes

            # Mover auditorias associadas para o primário se houver
            audits = db.query(SiteAudit).filter(SiteAudit.lead_id == dup.id).all()
            for audit in audits:
                audit.lead_id = primary.id

            db.delete(dup)
            removed_count += 1

        primary.updated_at = datetime.utcnow()

    db.commit()
    remaining_leads = db.query(Lead).count()

    return {
        "merged_groups": len(duplicate_groups),
        "removed_leads": removed_count,
        "remaining_leads": remaining_leads
    }
