import re
from typing import Dict, Any, Tuple

def classify_phone(phone_str: str) -> str:
    """
    Classifica se o telefone informado é celular (WhatsApp provável), fixo ou desconhecido.
    No Brasil: celulares possuem 9 dígitos e começam com 9 após o DDD.
    """
    if not phone_str:
        return "unknown"
    
    digits = re.sub(r"\D", "", phone_str)
    
    # Se tiver DDI 55 na frente, remove para checar DDD + número
    if digits.startswith("55") and len(digits) in (12, 13):
        digits = digits[2:]
        
    if len(digits) == 11:
        # DDD (2) + 9 dígitos (começando com 9)
        if digits[2] == '9':
            return "mobile"
        return "landline"
    elif len(digits) == 10:
        # DDD (2) + 8 dígitos (geralmente telefone fixo começando com 2, 3, 4, 5)
        return "landline"
    elif len(digits) == 9 and digits[0] == '9':
        return "mobile"
    elif len(digits) == 8:
        return "landline"
        
    return "unknown"

def calculate_lead_score(
    website: str,
    website_status: str,
    review_count: int,
    rating: float,
    phone: str,
    has_recent_activity: bool
) -> Tuple[int, str, Dict[str, Any]]:
    """
    Calcula o Lead Score (0 a 100) com base na matriz validada.
    Retorna: (total_score, score_tier, breakdown_dict)
    """
    breakdown = {}
    
    # 1. Situação do Site (Máx: 40 pts)
    site_pts = 0
    status_lower = (website_status or "").lower()
    
    if not website or status_lower == "none":
        site_pts = 40
        breakdown["website"] = {"points": 40, "reason": "Sem site oficial cadastrado no Google"}
    elif status_lower == "social_media":
        site_pts = 35
        breakdown["website"] = {"points": 35, "reason": "Utiliza rede social no lugar de site próprio"}
    elif status_lower == "insecure":
        site_pts = 30
        breakdown["website"] = {"points": 30, "reason": "Site sem certificado HTTPS ou inacessível"}
    elif status_lower == "outdated":
        site_pts = 20
        breakdown["website"] = {"points": 20, "reason": "Site lento (>4s) ou não otimizado para celular"}
    else:
        site_pts = 0
        breakdown["website"] = {"points": 0, "reason": "Site moderno e ativo"}

    # 2. Volume de Avaliações (Máx: 25 pts)
    rev_count = review_count or 0
    if rev_count > 200:
        rev_pts = 25
        breakdown["reviews_volume"] = {"points": 25, "reason": f"Empresa consolidada ({rev_count} avaliações)"}
    elif rev_count >= 50:
        rev_pts = 15
        breakdown["reviews_volume"] = {"points": 15, "reason": f"Bom movimento ({rev_count} avaliações)"}
    elif rev_count > 0:
        rev_pts = 5
        breakdown["reviews_volume"] = {"points": 5, "reason": f"Poucas avaliações ({rev_count} avaliações)"}
    else:
        rev_pts = 0
        breakdown["reviews_volume"] = {"points": 0, "reason": "Nenhuma avaliação encontrada"}

    # 3. Qualidade / Estrelas (Máx: 15 pts)
    rat = rating or 0.0
    if rat >= 4.5:
        rat_pts = 15
        breakdown["rating_quality"] = {"points": 15, "reason": f"Excelente reputação ({rat:.1f} estrelas)"}
    elif rat >= 4.0:
        rat_pts = 10
        breakdown["rating_quality"] = {"points": 10, "reason": f"Boa reputação ({rat:.1f} estrelas)"}
    elif rat > 0.0:
        rat_pts = 5
        breakdown["rating_quality"] = {"points": 5, "reason": f"Reputação moderada ({rat:.1f} estrelas)"}
    else:
        rat_pts = 0
        breakdown["rating_quality"] = {"points": 0, "reason": "Sem nota registrada"}

    # 4. Canal de Contato (Máx: 10 pts)
    phone_type = classify_phone(phone)
    if phone_type == "mobile":
        contact_pts = 10
        breakdown["contact_channel"] = {"points": 10, "reason": "Celular / WhatsApp direto disponível"}
    elif phone_type == "landline":
        contact_pts = 3
        breakdown["contact_channel"] = {"points": 3, "reason": "Telefone fixo cadastrado"}
    else:
        contact_pts = 0
        breakdown["contact_channel"] = {"points": 0, "reason": "Nenhum telefone encontrado"}

    # 5. Atividade Recente (Máx: 10 pts)
    if has_recent_activity:
        act_pts = 10
        breakdown["recent_activity"] = {"points": 10, "reason": "Perfil ativo (gerência responde clientes)"}
    else:
        act_pts = 0
        breakdown["recent_activity"] = {"points": 0, "reason": "Sem resposta a avaliações recente"}

    total_score = site_pts + rev_pts + rat_pts + contact_pts + act_pts
    # Garantir limite de 0 a 100
    total_score = max(0, min(100, total_score))

    if total_score >= 85:
        tier = "hot"
    elif total_score >= 60:
        tier = "warm"
    else:
        tier = "cold"

    return total_score, tier, breakdown
