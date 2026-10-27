import os
import re
import json
import logging
import urllib.parse
from typing import Dict, Any, Optional
import httpx
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

def clean_business_name(raw_name: str) -> str:
    """
    Higieniza o nome fantasia do Google Places para soar natural no WhatsApp.
    Ex: 'Mr. Dog 24h - hospital veterinário para cães e gatos' -> 'Mr. Dog 24h'
    Ex: 'Instituto Dental Batel | Odontologia e Estética' -> 'Instituto Dental Batel'
    Ex: 'Clínica Sorriso & Arte Curitiba (Unidade Centro)' -> 'Clínica Sorriso & Arte Curitiba'
    """
    if not raw_name:
        return "Empresa"
    name = raw_name.strip()
    # Separar por delimitadores comuns: " - ", " | ", " • ", " / ", " : "
    parts = re.split(r"\s+[\|\-\:•/]\s+", name)
    if parts:
        name = parts[0].strip()
    # Remover parênteses finais ex: (Unidade Setor Sul)
    name = re.sub(r"\s*\([^)]*\)", "", name).strip()
    # Remover menções de cidades/bairros redundantes no final se estiverem soltas
    name = re.sub(r"(?i)\s+(em\s+[\w\s]+|goiânia|curitiba|são paulo|unidade\s+\w+|setor\s+\w+)$", "", name).strip()
    return name or raw_name.strip()


class PitchGenerator:
    """
    Motor híbrido de geração de abordagem comercial personalizada (WhatsApp / E-mail).
    Suporta geração com IA (Google Gemini) e templates dinâmicos offline resilientes com 3 estilos:
    - direct: Curto e direto (2 a 3 frases, quebra-gelo de alto impacto)
    - consultative: Focado no diagnóstico técnico real (site, velocidade, HTTPS, mobile)
    - authority: Focado na reputação e volume de avaliações do Google
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
    def generate_templates(cls, lead_data: Dict[str, Any]) -> Dict[str, str]:
        """Gera os 3 estilos de abordagem usando o diagnóstico real do lead."""
        raw_name = lead_data.get("business_name", "Empresa")
        clean_name = clean_business_name(raw_name)
        niche = lead_data.get("niche", "seu segmento")
        city = lead_data.get("city", "sua cidade")
        rating = float(lead_data.get("rating") or 0.0)
        review_count = int(lead_data.get("review_count") or 0)
        website = lead_data.get("website")
        website_status = (lead_data.get("website_status") or "none").lower()

        rep_text = f"{review_count} avaliações e nota {rating:.1f} ⭐" if review_count > 0 else "ótima presença"

        # 1. ESTILO DIRETO (Curto & Quebra-Gelo, alta taxa de resposta no WhatsApp)
        if not website or website_status == "none":
            direct = (
                f"Olá, tudo bem? Me chamo Lucas.\n\n"
                f"Estava pesquisando sobre {niche} em {city} e vi o perfil da {clean_name} no Google. "
                f"Notei que vocês ainda não têm um site oficial cadastrado no perfil.\n\n"
                f"Vocês teriam 5 minutinhos essa semana para conversarmos sobre como transformar essas buscas em mais clientes?"
            )
        elif website_status == "social_media":
            direct = (
                f"Olá, tudo bem? Me chamo Lucas.\n\n"
                f"Encontrei a {clean_name} no Google com {rep_text}. "
                f"Reparei que o botão de site leva direto para a rede social de vocês.\n\n"
                f"Vocês já pensaram em ter uma página rápida própria com agendamento direto pelo WhatsApp?"
            )
        elif website_status == "insecure":
            direct = (
                f"Olá, tudo bem? Me chamo Lucas.\n\n"
                f"Estava no perfil da {clean_name} no Google e tentei abrir o site de vocês, mas o navegador alertou sobre a falta do certificado de segurança (HTTPS).\n\n"
                f"Isso costuma assustar clientes novos que chegam pelo Maps. Vocês já estão cientes desse detalhe?"
            )
        elif website_status == "outdated":
            direct = (
                f"Olá, tudo bem? Me chamo Lucas.\n\n"
                f"Vi a excelente reputação da {clean_name} no Google ({rep_text}). "
                f"Acessei o site pelo celular e notei que a página demora a carregar e a navegação no smartphone pode ser melhorada.\n\n"
                f"Gostariam de ver uma prévia de um layout moderno e rápido sem compromisso?"
            )
        else:
            direct = (
                f"Olá, tudo bem? Me chamo Lucas.\n\n"
                f"Acompanho o trabalho da {clean_name} em {city} como referência em {niche}.\n\n"
                f"Trabalho com automação de atendimento e captação de clientes locais. Vocês teriam 5 minutinhos para eu apresentar algumas ideias para acelerar o crescimento de vocês?"
            )

        # 2. ESTILO CONSULTIVO (Focado no diagnóstico técnico real e dados da auditoria)
        if not website or website_status == "none":
            consultative = (
                f"Olá, equipe da {clean_name}! Tudo bem?\n\n"
                f"Estava analisando o posicionamento de {niche} em {city} e encontrei o perfil de vocês no Google com {rep_text}.\n\n"
                f"Fizemos um diagnóstico rápido e identificamos que grande parte das pessoas que encontram vocês no Maps buscam por tabela de serviços, fotos ou agendamento antes de ligar — mas hoje não encontram um link oficial.\n\n"
                f"Desenvolvemos páginas de alta conversão específicas para {niche}. Posso te enviar uma demonstração sem compromisso de como ficaria para a {clean_name}?"
            )
        elif website_status == "social_media":
            consultative = (
                f"Olá, time da {clean_name}! Tudo bem?\n\n"
                f"Parabéns pelo trabalho em {city}, vi as ótimas avaliações de vocês no Google ({rep_text}).\n\n"
                f"Notei que o perfil direciona para redes sociais. Embora ter um perfil ativo seja fundamental, depender exclusivamente do feed faz com que muitos potenciais clientes se dispersem antes de entrar em contato.\n\n"
                f"Uma landing page dedicada com botão de WhatsApp direto e prova social costuma aumentar a taxa de conversão em até 40%. Faz sentido trocarmos uma ideia sobre isso?"
            )
        elif website_status == "insecure":
            consultative = (
                f"Olá, pessoal da {clean_name}! Tudo bem?\n\n"
                f"Ao realizar uma auditoria de presença digital das empresas de {niche} em {city}, notamos uma falha técnica importante no site oficial da {clean_name}: ausência de protocolo de segurança SSL/HTTPS.\n\n"
                f"Hoje o Google e os navegadores colocam um alerta vermelho de 'Não Seguro', o que reduz o ranqueamento orgânico e gera desconfiança imediata em quem tenta acessar.\n\n"
                f"Podemos ajudar a corrigir essa pendência técnica e otimizar a velocidade da página. Teriam disponibilidade para um bate-papo rápido?"
            )
        elif website_status == "outdated":
            consultative = (
                f"Olá, time da {clean_name}! Tudo bem?\n\n"
                f"Parabéns pela reputação de destaque no Google ({rep_text}).\n\n"
                f"Avaliamos tecnicamente o site da {clean_name} e notamos que a experiência em dispositivos móveis está defasada e com tempo de resposta elevado. Como mais de 80% das buscas locais ocorrem pelo celular, muitos visitantes acabam desistindo antes de enviar mensagem.\n\n"
                f"Temos soluções de redesign focadas em carregamento instantâneo e captação ágil de leads. Gostariam de receber um diagnóstico completo sem custo?"
            )
        else:
            consultative = (
                f"Olá, equipe da {clean_name}! Tudo bem?\n\n"
                f"Acompanho a presença da {clean_name} no Google ({rep_text}) e vi que vocês já possuem um site ativo.\n\n"
                f"Analisando o mercado de {niche} em {city}, mapeamos oportunidades concretas para otimizar a taxa de conversão da página com automação de atendimento no WhatsApp e captura inteligente de contatos.\n\n"
                f"Vocês teriam 10 minutos nesta semana para analisarmos esses números juntos?"
            )

        # 3. ESTILO AUTORIDADE & PARCERIA (Valorização da marca + escala comercial)
        if review_count >= 30 or rating >= 4.5:
            authority = (
                f"Olá, tudo bem? Me chamo Lucas.\n\n"
                f"Gostaria de parabenizar a {clean_name} pelo excelente posicionamento em {city}! Vocês contam com {rep_text}, o que comprova a qualidade e a preferência dos clientes.\n\n"
                f"Com esse volume de buscas, estruturar uma presença digital moderna e integrada com atendimento instantâneo garante que nenhum cliente qualificado escape para concorrentes.\n\n"
                f"Gostaria de propor uma parceria estratégica para potencializarmos ainda mais os resultados da {clean_name}. Podemos conversar 5 minutinhos?"
            )
        else:
            authority = (
                f"Olá, tudo bem? Me chamo Lucas.\n\n"
                f"Acompanho o setor de {niche} na região de {city} e identifiquei a {clean_name} como uma empresa com grande potencial de expansão digital.\n\n"
                f"Ajudamos empresas locais a se posicionarem no topo das pesquisas do Google e a automatizarem a captação de novos clientes todos os dias.\n\n"
                f"Faz sentido batermos um papo rápido para alinharmos estratégias para este mês?"
            )

        return {
            "direct": direct.strip(),
            "consultative": consultative.strip(),
            "authority": authority.strip()
        }

    @classmethod
    def generate_pitch(cls, lead_data: Dict[str, Any], style: str = "direct") -> Dict[str, Any]:
        """Gera abordagem comercial offline com suporte a múltiplos estilos."""
        raw_name = lead_data.get("business_name", "Empresa")
        clean_name = clean_business_name(raw_name)
        phone = lead_data.get("phone", "")
        website_status = (lead_data.get("website_status") or "none").lower()

        templates = cls.generate_templates(lead_data)
        selected_style = style if style in templates else "direct"
        pitch_text = templates.get(selected_style, templates["direct"])

        clean_p = cls.clean_phone(phone)
        wa_url = None
        if clean_p:
            encoded_msg = urllib.parse.quote(pitch_text)
            wa_url = f"https://wa.me/{clean_p}?text={encoded_msg}"

        return {
            "business_name": raw_name,
            "clean_business_name": clean_name,
            "scenario": website_status,
            "style": selected_style,
            "styles_available": templates,
            "pitch_text": pitch_text,
            "whatsapp_url": wa_url,
            "phone": phone,
            "is_ai_generated": False
        }

    @classmethod
    async def generate_ai_pitch(
        cls,
        lead_data: Dict[str, Any],
        style: str = "direct",
        custom_instructions: Optional[str] = None,
        api_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Gera abordagem ultra-personalizada via Google Gemini AI.
        Fallback inteligente e automático para templates dinâmicos em caso de ausência de chave ou falha de rede.
        """
        if not api_key:
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            load_dotenv(os.path.join(base_dir, ".env"), override=True)
            load_dotenv(os.path.join(base_dir, "backend", ".env"), override=True)
        gemini_key = (api_key or os.getenv("GEMINI_API_KEY", "")).strip()

        # Se não há chave configurada, retorna os templates offline enriquecidos
        if not gemini_key:
            res = cls.generate_pitch(lead_data, style=style)
            res["ai_error"] = "Chave GEMINI_API_KEY não encontrada. Adicione sua chave no arquivo .env ou no modal."
            return res

        raw_name = lead_data.get("business_name", "Empresa")
        clean_name = clean_business_name(raw_name)
        niche = lead_data.get("niche", "Serviços Locais")
        city = lead_data.get("city", "sua cidade")
        rating = float(lead_data.get("rating") or 0.0)
        review_count = int(lead_data.get("review_count") or 0)
        website = lead_data.get("website")
        website_status = (lead_data.get("website_status") or "none").lower()
        phone = lead_data.get("phone", "")

        # Resumo do diagnóstico técnico para o prompt
        if not website or website_status == "none":
            diag_summary = "A empresa NÃO tem website cadastrado no perfil do Google (apenas ficha no Maps)."
        elif website_status == "social_media":
            diag_summary = f"O botão de website no Google direciona para a rede social ({website}). Falta landing page própria focada em conversão."
        elif website_status == "insecure":
            diag_summary = f"O website ({website}) está marcado como INSEGURO pelo navegador (falta certificado SSL / HTTPS)."
        elif website_status == "outdated":
            diag_summary = f"O website ({website}) está desatualizado, lento ou sem responsividade adequada para smartphones."
        else:
            diag_summary = f"A empresa já possui um website saudável ({website}), o objetivo é otimização de conversão, tráfego e automação de atendimento."

        style_descriptions = {
            "direct": "CURTO E DIRETO AO PONTO. Máximo de 2 a 3 frases curtas. Quebra-gelo amigável, sem enrolação. Alta taxa de resposta no WhatsApp.",
            "consultative": "CONSULTIVO E ANALÍTICO. Focado no diagnóstico real identificado (ex: ausência de site, falta de HTTPS ou mobile). Apresenta valor antes de vender.",
            "authority": "AUTORIDADE E PARCERIA. Valoriza a reputação da empresa, quantidade de estrelas e avaliações no Google, propondo parceria estratégica."
        }
        style_instruction = style_descriptions.get(style, style_descriptions["direct"])

        custom_part = f"\nINSTRUÇÕES ADICIONAIS DO USUÁRIO:\n{custom_instructions.strip()}\n" if custom_instructions and custom_instructions.strip() else ""

        system_prompt = f"""Você é um especialista em prospecção ativa B2B e vendas consultivas via WhatsApp no Brasil.
Seu objetivo é redigir uma mensagem de PRIMEIRO CONTATO (cold outreach) para o WhatsApp de uma empresa comercial.

DADOS REAIS DA EMPRESA:
- Nome comercial higienizado: {clean_name} (Nome cadastrado no Google: {raw_name})
- Segmento/Nicho: {niche}
- Cidade: {city}
- Avaliações no Google: {review_count} avaliações com nota {rating:.1f} ⭐
- Diagnóstico Técnico da Presença Digital: {diag_summary}

ESTILO DA ABORDAGEM: {style.upper()}
{style_instruction}
{custom_part}
REGRAS CRÍTICAS DE REDAÇÃO:
1. Idioma: Português Brasileiro natural, profissional e simpático (estilo conversa real de WhatsApp).
2. NUNCA utilize jargões robóticos ou clichês ("Prezados", "Escrevo-lhes", "Gostaria de apresentar nossos préstimos", "Venho por meio desta", "Espero que este e-mail o encontre bem").
3. Use o nome higienizado da empresa ("{clean_name}"), JAMAIS repita o nome longo poluído do Google Maps.
4. Estrutura visual: 2 a 3 parágrafos curtos, separados por quebra de linha dupla, fácil e rápido de escanear no smartphone.
5. Finalize sempre com uma pergunta simples e fácil de responder (Call to Action de baixíssimo atrito).
6. RETORNE EXCLUSIVAMENTE O TEXTO DA MENSAGEM DO WHATSAPP, sem introduções explicativas, sem saudações fora da mensagem e sem aspas no início/fim.
"""

        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": system_prompt}
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.65,
                "maxOutputTokens": 500
            }
        }

        # Modelos a tentar em ordem de prioridade (modelos flash-lite para resposta instantânea e alta disponibilidade)
        models_to_try = [
            "gemini-flash-lite-latest",
            "gemini-3.5-flash-lite",
            "gemini-3.1-flash-lite",
            "gemini-3.5-flash",
            "gemini-flash-latest"
        ]
        generated_text = None
        last_error = None

        for model_name in models_to_try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={gemini_key}"
            try:
                # verify=False garante bypass transparente de interceptação SSL corporativa (Netskope/proxies)
                async with httpx.AsyncClient(verify=False, timeout=18.0) as client:
                    resp = await client.post(url, json=payload, headers={"Content-Type": "application/json"})
                    if resp.status_code == 200:
                        data = resp.json()
                        candidates = data.get("candidates", [])
                        if candidates:
                            content = candidates[0].get("content", {})
                            parts = content.get("parts", [])
                            if parts:
                                generated_text = parts[0].get("text", "").strip()
                                break
                    else:
                        last_error = f"HTTP {resp.status_code}: {resp.text[:120]}"
            except Exception as e:
                last_error = str(e)
                logger.warning(f"[Pitch AI] Erro ao chamar Gemini ({model_name}): {e}")

        templates = cls.generate_templates(lead_data)
        clean_p = cls.clean_phone(phone)

        if generated_text:
            wa_url = None
            if clean_p:
                encoded_msg = urllib.parse.quote(generated_text)
                wa_url = f"https://wa.me/{clean_p}?text={encoded_msg}"

            return {
                "business_name": raw_name,
                "clean_business_name": clean_name,
                "scenario": website_status,
                "style": style,
                "styles_available": templates,
                "pitch_text": generated_text,
                "whatsapp_url": wa_url,
                "phone": phone,
                "is_ai_generated": True,
                "ai_error": None
            }
        else:
            # Fallback seguro para template offline
            offline_pitch = cls.generate_pitch(lead_data, style=style)
            offline_pitch["is_ai_generated"] = False
            offline_pitch["ai_error"] = f"Falha na API Gemini ({last_error or 'indisponível'}). Usando template inteligente."
            return offline_pitch
