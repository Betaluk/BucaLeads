import time
import re
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

def detect_social_redirect(url: str) -> tuple[bool, str | None]:
    if not url:
        return False, None
    parsed = urlparse(url.lower())
    netloc = parsed.netloc
    for domain, network in SOCIAL_DOMAINS.items():
        if domain in netloc or domain in url.lower():
            return True, network
    return False, None

async def inspect_website(url: str) -> Dict[str, Any]:
    """
    Audita levemente a URL da empresa usando HTTP assíncrono.
    Detecta redirecionamentos para redes sociais, certificado SSL,
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

    clean_url = url.strip()
    if not clean_url.startswith("http://") and not clean_url.startswith("https://"):
        clean_url = "https://" + clean_url

    # Checar se a própria URL é rede social
    is_social, network = detect_social_redirect(clean_url)
    if is_social:
        return {
            "url_tested": clean_url,
            "is_accessible": True,
            "is_https": clean_url.startswith("https"),
            "is_mobile_responsive": True,
            "response_time_ms": 100,
            "redirects_to_social": True,
            "social_network": network,
            "website_status": "social_media"
        }

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    }

    start_time = time.time()
    try:
        async with httpx.AsyncClient(
            headers=headers,
            timeout=8.0,
            follow_redirects=True,
            verify=True
        ) as client:
            resp = await client.get(clean_url)
            elapsed_ms = int((time.time() - start_time) * 1000)

            # Checar se redirecionou para rede social
            final_url = str(resp.url)
            is_social_final, network_final = detect_social_redirect(final_url)
            if is_social_final:
                return {
                    "url_tested": clean_url,
                    "is_accessible": True,
                    "is_https": final_url.startswith("https"),
                    "is_mobile_responsive": True,
                    "response_time_ms": elapsed_ms,
                    "redirects_to_social": True,
                    "social_network": network_final,
                    "website_status": "social_media"
                }

            is_https = final_url.startswith("https://")
            html_text = resp.text[:150000] # Limite para não sobrecarregar
            soup = BeautifulSoup(html_text, "html.parser")
            
            # Checar viewport
            viewport = soup.find("meta", attrs={"name": re.compile(r"viewport", re.I)})
            is_mobile = bool(viewport and "width=device-width" in (viewport.get("content") or ""))

            # Determinar status
            is_accessible = (resp.status_code < 400)
            if not is_accessible:
                website_status = "insecure"
            elif not is_https:
                website_status = "insecure"
            elif elapsed_ms > 4000 or not is_mobile:
                website_status = "outdated"
            else:
                website_status = "healthy"

            return {
                "url_tested": clean_url,
                "is_accessible": is_accessible,
                "is_https": is_https,
                "is_mobile_responsive": is_mobile,
                "response_time_ms": elapsed_ms,
                "redirects_to_social": False,
                "social_network": None,
                "website_status": website_status
            }

    except httpx.ConnectError:
        # Tentar com HTTP simples se HTTPS falhar
        if clean_url.startswith("https://"):
            http_url = clean_url.replace("https://", "http://", 1)
            try:
                async with httpx.AsyncClient(headers=headers, timeout=5.0, follow_redirects=True, verify=False) as client:
                    resp = await client.get(http_url)
                    elapsed_ms = int((time.time() - start_time) * 1000)
                    return {
                        "url_tested": http_url,
                        "is_accessible": (resp.status_code < 400),
                        "is_https": False,
                        "is_mobile_responsive": False,
                        "response_time_ms": elapsed_ms,
                        "redirects_to_social": False,
                        "social_network": None,
                        "website_status": "insecure"
                    }
            except Exception:
                pass

        return {
            "url_tested": clean_url,
            "is_accessible": False,
            "is_https": False,
            "is_mobile_responsive": False,
            "response_time_ms": 0,
            "redirects_to_social": False,
            "social_network": None,
            "website_status": "insecure"
        }
    except Exception:
        return {
            "url_tested": clean_url,
            "is_accessible": False,
            "is_https": False,
            "is_mobile_responsive": False,
            "response_time_ms": 0,
            "redirects_to_social": False,
            "social_network": None,
            "website_status": "insecure"
        }
