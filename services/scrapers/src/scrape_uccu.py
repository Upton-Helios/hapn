"""
Scraper: UCCU Center (uccucenter.com)
Scrapes upcoming events from the UCCU Center venue page.
Parses listing cards for basic info, then fetches detail pages
for descriptions, ticket links, and times.
"""

import asyncio
import hashlib
import re
from datetime import datetime, timezone
import httpx
from bs4 import BeautifulSoup

BASE_URL = "https://www.uccucenter.com"
EVENTS_URL = f"{BASE_URL}/events/"

# UCCU Center coordinates
UCCU_LAT = 40.2790
UCCU_LNG = -111.7155

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/html",
}


def _parse_date(text: str) -> str | None:
    """Parse a date string like 'April 3, 2026' or 'May 13, 2026' into ISO date."""
    text = text.strip()
    for fmt in ("%B %d, %Y", "%b %d, %Y"):
        try:
            return datetime.strptime(text, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def _parse_time(text: str) -> str | None:
    """Parse time like '7:30 PM' or '8 PM' into HH:MM 24h format."""
    text = text.strip().upper()
    for fmt in ("%I:%M %p", "%I %p"):
        try:
            return datetime.strptime(text, fmt).strftime("%H:%M")
        except ValueError:
            continue
    return None


def _make_iso(date_str: str, time_str: str | None) -> str | None:
    """Combine date (YYYY-MM-DD) and time (HH:MM) into UTC ISO string.
    Times are Mountain Time (UTC-6 MDT / UTC-7 MST). Use UTC-6 for spring/summer."""
    if not date_str:
        return None
    if time_str:
        # Mountain Daylight Time = UTC-6
        return f"{date_str}T{time_str}:00-06:00"
    return f"{date_str}T19:00:00-06:00"  # default 7 PM


def _stable_id(text: str) -> str:
    """Generate a stable source_id from text."""
    return hashlib.md5(text.encode()).hexdigest()[:12]


def _extract_listing_events(soup: BeautifulSoup) -> list[dict]:
    """Extract event stubs from the listing page card-picture elements."""
    events = []
    for card in soup.select("div.card-picture"):
        title_el = card.select_one("img.card-picture-img")
        if not title_el:
            continue

        title = (title_el.get("title") or title_el.get("alt") or "").strip()
        if not title:
            continue

        image_url = title_el.get("src", "")
        if image_url and not image_url.startswith("http"):
            image_url = BASE_URL + image_url

        # Date
        date_str = None
        date_p = card.select_one(".card-picture-content p")
        if date_p:
            strong = date_p.find("strong", string=re.compile(r"Date:", re.I))
            if strong:
                # Text after "Date:" up to next <br> or <strong>
                text = strong.next_sibling
                if text:
                    date_str = str(text).strip().lstrip(":").strip()

        # Door and event times
        door_time = None
        event_time = None
        for li in card.select(".card-picture-content li"):
            li_text = li.get_text(strip=True)
            if "doors" in li_text.lower():
                m = re.search(r"(\d{1,2}(?::\d{2})?\s*[AP]M)", li_text, re.I)
                if m:
                    door_time = m.group(1)
            elif "event start" in li_text.lower():
                m = re.search(r"(\d{1,2}(?::\d{2})?\s*[AP]M)", li_text, re.I)
                if m:
                    event_time = m.group(1)

        # Detail page link
        detail_link = None
        link_el = card.select_one("a.card-picture-button")
        if link_el:
            href = link_el.get("href", "")
            if href:
                detail_link = href if href.startswith("http") else BASE_URL + href

        events.append({
            "title": title,
            "image_url": image_url or None,
            "date_text": date_str,
            "door_time": door_time,
            "event_time": event_time,
            "detail_url": detail_link,
        })

    return events


async def _scrape_detail(client: httpx.AsyncClient, url: str) -> dict:
    """Fetch a detail page and extract description, ticket link, and refined times."""
    result = {"description": None, "ticket_url": None, "date_text": None,
              "door_time": None, "event_time": None}
    try:
        resp = await client.get(url, headers=HEADERS, follow_redirects=True)
        if resp.status_code != 200:
            return result
        soup = BeautifulSoup(resp.text, "html.parser")

        # Description from meta
        meta_desc = soup.find("meta", attrs={"name": "description"})
        if meta_desc:
            result["description"] = meta_desc.get("content", "").strip()

        # Richer description from "Event Info" paragraph
        main = soup.select_one("main")
        if main:
            for p in main.find_all("p"):
                strong = p.find("strong", string=re.compile(r"Event Info", re.I))
                if strong:
                    text = p.get_text(separator=" ", strip=True)
                    text = re.sub(r"^Event Info\s*:\s*", "", text, flags=re.I).strip()
                    if len(text) > 20:
                        result["description"] = text[:2000]
                    break

        # Ticket link (AXS or Ticketmaster)
        for a in soup.select("a.button-solid, a[title*='Ticket'], a[href*='axs.com'], a[href*='ticketmaster.com']"):
            href = a.get("href", "")
            if "axs.com" in href or "ticketmaster.com" in href:
                result["ticket_url"] = href
                break

        # Sidebar card with structured date/times
        for div in soup.select(".border-bottom-grey-dark, .border-bottom-1"):
            label_div = div.select_one(".text-uppercase")
            value_div = div.select_one("div:not(.text-uppercase)")
            if not label_div or not value_div:
                continue
            label = label_div.get_text(strip=True).lower()
            value = value_div.get_text(strip=True)
            if "date" in label and not result["date_text"]:
                result["date_text"] = value
            elif "event start" in label or "event time" in label:
                result["event_time"] = value
            elif "doors" in label:
                result["door_time"] = value

    except Exception as e:
        print(f"  [uccu] detail error {url}: {e}")

    return result


async def scrape() -> list[dict]:
    events = []

    async with httpx.AsyncClient(timeout=30) as client:
        # Fetch listing page
        try:
            resp = await client.get(EVENTS_URL, headers=HEADERS, follow_redirects=True)
            if resp.status_code != 200:
                print(f"  [uccu] HTTP {resp.status_code}")
                return []
        except Exception as e:
            print(f"  [uccu] error fetching listing: {e}")
            return []

        soup = BeautifulSoup(resp.text, "html.parser")
        listings = _extract_listing_events(soup)
        print(f"  [uccu] found {len(listings)} events on listing page")

        if not listings:
            return []

        # Fetch detail pages
        for stub in listings:
            detail = {}
            if stub["detail_url"]:
                await asyncio.sleep(1)  # polite delay
                detail = await _scrape_detail(client, stub["detail_url"])

            # Merge: prefer detail page data, fall back to listing
            date_text = detail.get("date_text") or stub["date_text"]
            door_time_text = detail.get("door_time") or stub["door_time"]
            event_time_text = detail.get("event_time") or stub["event_time"]
            description = detail.get("description") or ""
            ticket_url = detail.get("ticket_url")

            # Parse date
            date_str = _parse_date(date_text) if date_text else None
            if not date_str:
                print(f"  [uccu] skipping '{stub['title']}' — no parseable date")
                continue

            # Skip past events
            try:
                event_date = datetime.strptime(date_str, "%Y-%m-%d").replace(
                    tzinfo=timezone.utc)
                if event_date.date() < datetime.now(timezone.utc).date():
                    print(f"  [uccu] skipping past event '{stub['title']}'")
                    continue
            except ValueError:
                pass

            # Parse times
            event_time = _parse_time(event_time_text) if event_time_text else None
            door_time = _parse_time(door_time_text) if door_time_text else None

            start_iso = _make_iso(date_str, event_time or door_time)
            # End time: assume ~3 hours after start for concerts
            end_iso = None

            title = stub["title"]
            source_id = f"uccu-{_stable_id(title + date_str)}"
            source_url = ticket_url or stub["detail_url"]

            events.append({
                "source": "uccu_center",
                "source_id": source_id,
                "source_url": source_url,
                "title": title,
                "description": description,
                "venue_name": "UCCU Center",
                "address": "800 W University Pkwy, Orem, UT 84058",
                "city": "Orem",
                "category": "music",
                "tags": ["music", "concert"],
                "price": "Tickets available" if ticket_url else None,
                "price_cents_min": None,
                "start_time": start_iso,
                "end_time": end_iso,
                "lat": UCCU_LAT,
                "lng": UCCU_LNG,
                "image_url": stub["image_url"],
                "status": "active",
            })

    print(f"  [uccu] {len(events)} upcoming events after filtering")
    return events
