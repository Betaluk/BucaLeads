import re
import urllib.parse
from typing import Dict, Any

class PitchGenerator:
    """
    Motor de geração de abordagem comercial personalizada (WhatsApp / E-mail).
    Atualmente roda 100% offline via templates dinâmicos, com arquitetura preparada
    para integrar API de IA no futuro.
    """

    @staticmethod
    def clean_phone(phone_str: str) -> str:
        if not phone_str:
            return ""
        digits = re.sub(r"\D", "", phone_str)
        # Se for número BR sem 55, adiciona 55
        if len(digits) in (10, 11) and not digits.startswith("55"):
            return f"55{digits}"
        return digits

    @classmethod
    def generate_pitch(cls, lead_data: Dict[str, Any]) -> Dict[str, str]:
        business_name = lead_data.get("business_name", "Empresa")
        niche = lead_data.get("niche", "seu segmento")
        city = lead_data.get("city", "sua cidade")
        rating = lead_data.get("rating", 0.0)
        review_count = lead_data.get("review_count", 0)
        website = lead_data.get("website")
        website_status = (lead_data.get("website_status") or "none").lower()
        phone = lead_data.get("phone", "")

        # Determinar cenário
        if not website or website_status == "none":
            if review_count >= 50 or rating >= 4.3:
                scenario = "no_website_high_rep"
                text = (
                    f"Olá, time da {business_name}! Tudo bem?\n\n"
                    f"Estava pesquisando por {niche} em {city} e encontrei o perfil de vocês no Google com uma reputação incrível: "
                    f"são {review_count} avaliações e nota {rating:.1f} ⭐, parabéns!\n\n"
                    f"Notei, porém, que vocês ainda não possuem um site oficial registrado no perfil do Google. "
                    f"Hoje, grande parte das pessoas que encontram vocês no Maps querem ver cardápio/tabela de serviços ou agendar direto antes de ligar.\n\n"
                    f"Vocês já pensaram em ter uma página rápida e moderna para converter essas buscas em clientes fechados?"
                )
            else:
                scenario = "no_website_standard"
                text = (
                    f"Olá, equipe da {business_name}! Tudo bem?\n\n"
                    f"Estava buscando referências de {niche} em {city} e vi o perfil de vocês no Google.\n\n"
                    f"Notei que ainda não colocaram um link para site oficial de vocês. "
                    f"Criar uma presença web profissional hoje ajuda muito a ficar à frente da concorrência local nas buscas.\n\n"
                    f"Trabalho com desenvolvimento de páginas rápidas para atrair clientes. Gostariam de ver uma demonstração de como ficaria um site para vocês?"
                )
        elif website_status == "social_media":
            scenario = "social_media_link"
            text = (
                f"Olá, pessoal da {business_name}! Tudo bem?\n\n"
                f"Parabéns pelo trabalho com {niche} em {city}, vi as ótimas avaliações de vocês no Google ({rating:.1f} ⭐ com {review_count} clientes).\n\n"
                f"Notei que o botão de site no Google direciona direto para a rede social de vocês. "
                f"Apesar de ser ótimo ter o perfil ativo, ter um site próprio indexado no Google transmite muito mais autoridade e permite botões rápidos de agendamento/venda direta sem depender do algoritmo.\n\n"
                f"Gostariam de ver uma prévia sem compromisso de uma landing page focada em conversão para a {business_name}?"
            )
        elif website_status == "insecure":
            scenario = "insecure_site"
            text = (
                f"Olá, time da {business_name}! Tudo bem?\n\n"
                f"Estava navegando no perfil de vocês no Google e tentei acessar o site, mas o navegador alertou sobre ausência de certificado de segurança (HTTPS).\n\n"
                f"Esse aviso costuma assustar clientes novos que chegam pelo Google e prejudica o ranqueamento da empresa nas pesquisas.\n\n"
                f"Vocês já estão cientes desse detalhe técnico? Consigo ajudar a regularizar isso rapidamente e dar uma renovada na página."
            )
        elif website_status == "outdated":
            scenario = "outdated_mobile"
            text = (
                f"Olá, pessoal da {business_name}! Tudo bem?\n\n"
                f"Vi a excelente reputação de vocês no Google ({review_count} avaliações e nota {rating:.1f} ⭐), parabéns!\n\n"
                f"Tentei acessar o site de vocês pelo celular e notei que a página demora a carregar e não se adapta bem a telas menores. "
                f"Como mais de 80% do tráfego hoje vem do smartphone, muitas pessoas acabam desistindo antes de entrar em contato.\n\n"
                f"Gostariam de receber uma prévia de um redesign moderno e super rápido para mobile sem nenhum compromisso?"
            )
        else:
            scenario = "general_modernization"
            text = (
                f"Olá, equipe da {business_name}! Tudo bem?\n\n"
                f"Acompanho o trabalho de vocês como referência em {niche} na região de {city} (nota {rating:.1f} no Google!).\n\n"
                f"Vi que vocês já têm site institucional. Desenvolvemos soluções para automação de atendimento, agendamento online e otimização para captação de leads locais.\n\n"
                f"Vocês teriam 5 minutinhos nesta semana para eu mostrar algumas oportunidades de aumentar a taxa de conversão do site de vocês?"
            )

        clean_p = cls.clean_phone(phone)
        wa_url = None
        if clean_p:
            encoded_msg = urllib.parse.quote(text)
            wa_url = f"https://wa.me/{clean_p}?text={encoded_msg}"

        return {
            "scenario": scenario,
            "pitch_text": text,
            "whatsapp_url": wa_url,
            "phone": phone
        }
