import asyncio
import re
import urllib.parse
from typing import List, Dict, Any
from playwright.async_api import async_playwright, Page, TimeoutError as PlaywrightTimeoutError

class GoogleMapsScraper:
    """
    Scraper automatizado com Playwright para extrair leads do Google Maps.
    Possui proteções contra bloqueio (delays humanos, stealth headers).
    """

    def __init__(self, headless: bool = True):
        self.headless = headless

    async def search(self, query: str, limit: int = 20) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        encoded_query = urllib.parse.quote(query)
        maps_url = f"https://www.google.com/maps/search/{encoded_query}"

        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=self.headless,
                args=[
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-blink-features=AutomationControlled",
                ]
            )

            context = await browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                ),
                viewport={"width": 1280, "height": 900},
                locale="pt-BR",
                timezone_id="America/Sao_Paulo"
            )

            page = await context.new_page()

            try:
                await page.goto(maps_url, timeout=30000, wait_until="domcontentloaded")
                await asyncio.sleep(2.0)

                # Fechar banner de consentimento / cookies se aparecer
                try:
                    accept_btn = page.locator('button:has-text("Aceitar tudo"), button:has-text("Concordo"), form button:has-text("Aceitar")')
                    if await accept_btn.count() > 0:
                        await accept_btn.first.click()
                        await asyncio.sleep(1.0)
                except Exception:
                    pass

                # Aguardar feed de resultados
                feed_selector = 'div[role="feed"]'
                try:
                    await page.wait_for_selector(feed_selector, timeout=12000)
                except PlaywrightTimeoutError:
                    # Se não achou feed, pode ser que abriu direto um único local ou nenhum resultado
                    pass

                # Rolar para carregar os cards desejados
                cards_selector = 'div[role="feed"] > div > div[jsaction]'
                seen_names = set()
                scroll_attempts = 0
                max_scroll_attempts = 25

                while len(seen_names) < limit and scroll_attempts < max_scroll_attempts:
                    cards = await page.locator(cards_selector).all()
                    for card in cards:
                        try:
                            # Nome da empresa
                            name_el = card.locator('div.fontHeadlineSmall, div.qBF1Pd, a[aria-label]').first
                            if await name_el.count() == 0:
                                continue
                            name = await name_el.inner_text()
                            name = name.strip()
                            if not name or name in seen_names or "Resultados" in name:
                                continue

                            # Avaliações e Estrelas
                            rating = 0.0
                            review_count = 0
                            rating_el = card.locator('span.MW4etd, span.ZkP5Je').first
                            if await rating_el.count() > 0:
                                r_text = await rating_el.inner_text()
                                try:
                                    rating = float(r_text.replace(",", "."))
                                except ValueError:
                                    pass

                            review_el = card.locator('span.UY7F9, span[aria-label*="avalia"]').first
                            if await review_el.count() > 0:
                                rev_text = await review_el.inner_text()
                                digits = re.sub(r"\D", "", rev_text)
                                if digits:
                                    review_count = int(digits)

                            # Clicar no card para abrir os detalhes laterais completos
                            await card.click()
                            await asyncio.sleep(1.0)

                            # Extrair dados do painel de detalhes
                            phone = ""
                            website = ""
                            address = ""

                            # Telefone
                            phone_el = page.locator('button[data-tooltip*="telefone" i], button[aria-label*="Telefone" i], button[data-item-id*="phone" i]').first
                            if await phone_el.count() > 0:
                                phone_raw = await phone_el.inner_text()
                                phone = re.sub(r"[^\d\(\)\-\+\s]", "", phone_raw).strip()

                            # Website
                            site_el = page.locator('a[data-tooltip*="website" i], a[aria-label*="site" i], a[data-item-id="authority"]').first
                            if await site_el.count() > 0:
                                website = await site_el.get_attribute("href") or ""
                                # Google costuma redirecionar com /url?q=...
                                if "/url?q=" in website:
                                    website = website.split("/url?q=")[1].split("&")[0]

                            # Endereço
                            addr_el = page.locator('button[data-tooltip*="endereço" i], button[aria-label*="Endereço" i], button[data-item-id="address"]').first
                            if await addr_el.count() > 0:
                                address = (await addr_el.inner_text()).strip()

                            # Checar atividade recente (se tem resposta a reviews)
                            has_recent = False
                            owner_resp = page.locator('div:has-text("Resposta do proprietário"), div:has-text("Resposta da empresa")')
                            if await owner_resp.count() > 0:
                                has_recent = True

                            results.append({
                                "business_name": name,
                                "address": address,
                                "phone": phone,
                                "website": website,
                                "rating": rating,
                                "review_count": review_count,
                                "has_recent_activity": has_recent,
                                "source": "local_scraper"
                            })
                            seen_names.add(name)

                            if len(results) >= limit:
                                break

                        except Exception:
                            continue

                    # Rolar um pouco o container
                    try:
                        await page.locator(feed_selector).evaluate('el => el.scrollBy(0, 1000)')
                        await asyncio.sleep(1.2)
                    except Exception:
                        await page.mouse.wheel(0, 1000)
                        await asyncio.sleep(1.2)

                    scroll_attempts += 1

            except Exception as e:
                print(f"[Scraper Error] {e}")
            finally:
                await browser.close()

        return results
