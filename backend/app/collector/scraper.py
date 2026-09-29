import asyncio
import re
import urllib.parse
from typing import List, Dict, Any, Optional
from playwright.sync_api import sync_playwright

def _clean_phone(text: str) -> str:
    """Extrai telefone com DDD padrão brasileiro: (XX) 9XXXX-XXXX ou (XX) XXXX-XXXX"""
    match = re.search(r"\(?\d{2}\)?\s*9?\d{4}[-\s]?\d{4}", text)
    if match:
        return match.group(0).strip()
    return ""

def _parse_card(card) -> Optional[Dict[str, Any]]:
    try:
        # 1. Nome da empresa
        name_el = card.locator('a.hfpxzc, div.qBF1Pd, div.fontHeadlineSmall').first
        if name_el.count() == 0:
            return None
        name = name_el.get_attribute("aria-label") or name_el.inner_text()
        name = name.strip() if name else ""
        if not name or "Resultados" in name:
            return None

        card_text = card.inner_text()

        # 2. Avaliações (Rating / Estrelas)
        rating = 0.0
        star_el = card.locator('span[aria-label*="estrelas" i], span.MW4etd, span.ZkP5Je').first
        if star_el.count() > 0:
            aria_text = star_el.get_attribute("aria-label") or star_el.inner_text()
            m = re.search(r"(\d[,\.]\d)", aria_text)
            if m:
                rating = float(m.group(1).replace(",", "."))

        # 3. Contagem de Reviews
        review_count = 0
        rev_match = re.search(r"\((\d[\d\.]*)\)", card_text)
        if rev_match:
            try:
                review_count = int(rev_match.group(1).replace(".", "").replace(",", ""))
            except ValueError:
                pass
        else:
            rev_match2 = re.search(r"(\d[\d\.]*)\s+avalia", card_text, re.IGNORECASE)
            if rev_match2:
                try:
                    review_count = int(rev_match2.group(1).replace(".", "").replace(",", ""))
                except ValueError:
                    pass

        # 4. Telefone
        phone = _clean_phone(card_text)

        # 5. Website
        website = ""
        site_link = card.locator('a[data-value="Website"], a[aria-label*="site de " i], a[aria-label*="website" i]').first
        if site_link.count() > 0:
            href = site_link.get_attribute("href") or ""
            # Filtrar links de anúncios do Google (/aclk) ou domínios internos do Google
            if href and not href.startswith("/aclk") and "googleadservices" not in href and not href.startswith("https://www.google.com"):
                website = href

        # 6. Endereço
        address = ""
        for line in card_text.split("\n"):
            line_str = line.strip()
            if any(term in line_str.lower() for term in ["rua", "r.", "av.", "avenida", "alameda", "travessa", "rodovia", "bairro", "conj", "sala", "praça", "qd.", "lt."]):
                address = re.sub(r"[^\w\s\.\,\-\/\d]", "", line_str).strip()
                if len(address) > 5:
                    break

        return {
            "business_name": name,
            "address": address,
            "phone": phone,
            "website": website,
            "rating": rating,
            "review_count": review_count,
            "has_recent_activity": (review_count >= 20),
            "source": "local_scraper"
        }
    except Exception:
        return None

def scrape_sync(query: str, limit: int = 15) -> List[Dict[str, Any]]:
    results = []
    seen = set()
    encoded = urllib.parse.quote(query)
    url = f"https://www.google.com/maps/search/{encoded}"

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-blink-features=AutomationControlled"
            ]
        )
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            locale="pt-BR",
            viewport={"width": 1280, "height": 900}
        )
        page = context.new_page()
        page.goto(url, timeout=25000, wait_until="domcontentloaded")
        page.wait_for_timeout(2000)

        # Fechar consentimento / cookies se houver
        try:
            btn = page.locator('button:has-text("Aceitar tudo"), button:has-text("Concordo"), form button:has-text("Aceitar")')
            if btn.count() > 0:
                btn.first.click()
                page.wait_for_timeout(800)
        except Exception:
            pass

        try:
            page.wait_for_selector('div[role="feed"]', timeout=10000)
        except Exception:
            pass

        scroll_attempts = 0
        max_scrolls = max(8, limit // 2)

        while len(results) < limit and scroll_attempts < max_scrolls:
            cards = page.locator('div[role="feed"] > div > div[jsaction]').all()
            for c in cards:
                lead = _parse_card(c)
                if lead and lead["business_name"] and lead["business_name"] not in seen:
                    results.append(lead)
                    seen.add(lead["business_name"])
                    if len(results) >= limit:
                        break

            # Scroll suave no container do feed
            try:
                page.locator('div[role="feed"]').evaluate('el => el.scrollBy(0, 1000)')
                page.wait_for_timeout(1000)
            except Exception:
                page.mouse.wheel(0, 1000)
                page.wait_for_timeout(1000)

            scroll_attempts += 1

        browser.close()

    return results

class GoogleMapsScraper:
    """
    Scraper robusto para Google Maps executado via thread síncrona
    para eliminar conflitos de Event Loop no Windows com Uvicorn.
    """
    def __init__(self, headless: bool = True):
        self.headless = headless

    async def search(self, query: str, limit: int = 20) -> List[Dict[str, Any]]:
        return await asyncio.to_thread(scrape_sync, query, limit)
