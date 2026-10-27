import time
import asyncio
import re
import ssl
from urllib.parse import urlparse
import httpx
from bs4 import BeautifulSoup
from typing import Dict, Any

SOCIAL_DOMAINS = {
    "instagram.com": "instagram",
    "facebook.com": "facebook",
    "fb.com": "facebook",
    "fb.me": "facebook",
    "linktr.ee": "linktree",
    "tiktok.com": "tiktok",
    "wa.me": "whatsapp",
    "api.whatsapp.com": "whatsapp",
    "linkedin.com": "linkedin"
}

def get_system_ssl_context() -> ssl.SSLContext:
    """
    Retorna o contexto SSL padrão do sistema operacional, carregando
    automaticamente a cadeia de certificados raiz do Windows / SO e
    certificados de autoridade corporativa (ex: proxies governamentais/empresariais).
    """
    try:
        ctx = ssl.create_default_context()
        return ctx
    except Exception:
        return True

def detect_social_redirect(url: str) -> tuple[bool, str | None]:
    if not url:
        return False, None
    parsed = urlparse(url.lower())
    netloc = parsed.netloc
    for domain, network in SOCIAL_DOMAINS.items():
        if domain in netloc or domain in url.lower():
            return True, network
    return False, None

def is_real_ssl_error(exc: Exception) -> bool:
    """Verifica com precisão se a exceção foi causada por certificado SSL inválido/rejeitado."""
    curr = exc
    while curr is not None:
        if isinstance(curr, ssl.SSLError):
            return True
        err_str = str(curr).lower()
        if any(term in err_str for term in [
            "certificate_verify_failed",
            "certificateverifyfailed",
            "ssl: certificate",
            "self-signed certificate",
            "certificate has expired",
            "hostname mismatch",
            "tlsv1 alert"
        ]):
            return True
        curr = getattr(curr, "__cause__", None)
    return False

async def inspect_website(url: str) -> Dict[str, Any]:
    """
    Audita levemente a URL da empresa usando HTTP assíncrono.
    Detecta redirecionamentos para redes sociais, certificado SSL válido,
    responsividade básica para celular e tempo de carregamento.
    """
    if not url or not url.strip():
        return {
            "url_tested": None,
            "is_accessible": False,
            "is_https": False,
            "is_mobile_responsive": False,
            "response_time_ms": 0,
            "redirects_to_social": False,
            "social_network": None,
            "website_status": "none"
        }

    raw_clean = url.strip()
    # Checar se a própria URL fornecida já é rede social
    is_social, network = detect_social_redirect(raw_clean)
    if is_social:
        return {
            "url_tested": raw_clean,
            "is_accessible": True,
            "is_https": raw_clean.startswith("https"),
            "is_mobile_responsive": True,
            "response_time_ms": 100,
            "redirects_to_social": True,
            "social_network": network,
            "website_status": "social_media"
        }

    # Sempre priorizar teste via HTTPS para evitar múltiplos saltos e lentidão desnecessária
    if raw_clean.startswith("http://"):
        preferred_url = raw_clean.replace("http://", "https://", 1)
        fallback_http_url = raw_clean
    elif raw_clean.startswith("https://"):
        preferred_url = raw_clean
        fallback_http_url = raw_clean.replace("https://", "http://", 1)
    else:
        preferred_url = "https://" + raw_clean
        fallback_http_url = "http://" + raw_clean

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    }

    ssl_context = get_system_ssl_context()
    start_time = time.time()

    # Tentativa 1: Acessar via HTTPS com validação SSL padrão do sistema
    try:
        async with httpx.AsyncClient(
            headers=headers,
            timeout=6.5,
            follow_redirects=True,
            verify=ssl_context
        ) as client:
            resp = await client.get(preferred_url)
            elapsed_ms = int((time.time() - start_time) * 1000)

            # Checar se redirecionou para rede social
            final_url = str(resp.url)
            is_social_final, network_final = detect_social_redirect(final_url)
            if is_social_final:
                return {
                    "url_tested": preferred_url,
                    "is_accessible": True,
                    "is_https": final_url.startswith("https"),
                    "is_mobile_responsive": True,
                    "response_time_ms": elapsed_ms,
                    "redirects_to_social": True,
                    "social_network": network_final,
                    "website_status": "social_media"
                }

            is_https = final_url.startswith("https://")
            html_text = resp.text[:150000]
            soup = BeautifulSoup(html_text, "html.parser")

            # Checar viewport para responsividade mobile
            viewport = soup.find("meta", attrs={"name": re.compile(r"viewport", re.I)})
            is_mobile = bool(viewport and "width=device-width" in (viewport.get("content") or ""))

            is_accessible = (resp.status_code < 400)
            if not is_accessible:
                website_status = "insecure"
            elif not is_https:
                website_status = "insecure"
            elif elapsed_ms > 4500 or not is_mobile:
                website_status = "outdated"
            else:
                website_status = "healthy"

            return {
                "url_tested": preferred_url,
                "is_accessible": is_accessible,
                "is_https": is_https,
                "is_mobile_responsive": is_mobile,
                "response_time_ms": elapsed_ms,
                "redirects_to_social": False,
                "social_network": None,
                "website_status": website_status
            }

    except Exception as e:
        elapsed_ms = int((time.time() - start_time) * 1000)
        has_ssl_err = is_real_ssl_error(e)
        is_timeout = isinstance(e, (httpx.TimeoutException, asyncio.TimeoutError))

        # Se falhou por erro real de certificado SSL (expirado, autoassinado, mismatch):
        # Testar se responde com verify=False para confirmar se o site está online com SSL inválido
        if has_ssl_err:
            try:
                async with httpx.AsyncClient(
                    headers=headers,
                    timeout=4.5,
                    follow_redirects=True,
                    verify=False
                ) as client_unverified:
                    resp = await client_unverified.get(preferred_url)
                    elapsed_total = int((time.time() - start_time) * 1000)
                    final_url = str(resp.url)
                    is_social_final, network_final = detect_social_redirect(final_url)
                    if is_social_final:
                        return {
                            "url_tested": preferred_url,
                            "is_accessible": True,
                            "is_https": False,
                            "is_mobile_responsive": True,
                            "response_time_ms": elapsed_total,
                            "redirects_to_social": True,
                            "social_network": network_final,
                            "website_status": "social_media"
                        }

                    is_accessible = (resp.status_code < 400)
                    return {
                        "url_tested": preferred_url,
                        "is_accessible": is_accessible,
                        "is_https": False,  # Certificado inválido/rejeitado
                        "is_mobile_responsive": False,
                        "response_time_ms": elapsed_total,
                        "redirects_to_social": False,
                        "social_network": None,
                        "website_status": "insecure"
                    }
            except Exception:
                pass

        # Se HTTPS falhou (ex: porta 443 fechada, ou timeout) e temos fallback HTTP:
        try:
            async with httpx.AsyncClient(
                headers=headers,
                timeout=4.0,
                follow_redirects=True,
                verify=ssl_context
            ) as client_http:
                resp = await client_http.get(fallback_http_url)
                final_url = str(resp.url)
                is_https_final = final_url.startswith("https://")
                elapsed_total = int((time.time() - start_time) * 1000)

                if is_https_final:
                    html_text = resp.text[:150000]
                    soup = BeautifulSoup(html_text, "html.parser")
                    viewport = soup.find("meta", attrs={"name": re.compile(r"viewport", re.I)})
                    is_mobile = bool(viewport and "width=device-width" in (viewport.get("content") or ""))
                    return {
                        "url_tested": fallback_http_url,
                        "is_accessible": (resp.status_code < 400),
                        "is_https": True,
                        "is_mobile_responsive": is_mobile,
                        "response_time_ms": elapsed_total,
                        "redirects_to_social": False,
                        "social_network": None,
                        "website_status": "outdated" if (elapsed_total > 4500 or not is_mobile) else "healthy"
                    }
                else:
                    return {
                        "url_tested": fallback_http_url,
                        "is_accessible": (resp.status_code < 400),
                        "is_https": False,
                        "is_mobile_responsive": False,
                        "response_time_ms": elapsed_total,
                        "redirects_to_social": False,
                        "social_network": None,
                        "website_status": "insecure"
                    }
        except Exception:
            pass

        # Se foi apenas timeout de rede, classificar como lento/instável (outdated), nunca inseguro falso-positivo
        if is_timeout:
            return {
                "url_tested": preferred_url,
                "is_accessible": False,
                "is_https": preferred_url.startswith("https://"),
                "is_mobile_responsive": False,
                "response_time_ms": elapsed_ms,
                "redirects_to_social": False,
                "social_network": None,
                "website_status": "outdated"
            }

        # Completamente inacessível (fora do ar, DNS inválido, conexão recusada)
        return {
            "url_tested": preferred_url,
            "is_accessible": False,
            "is_https": False,
            "is_mobile_responsive": False,
            "response_time_ms": 0,
            "redirects_to_social": False,
            "social_network": None,
            "website_status": "insecure"
        }
