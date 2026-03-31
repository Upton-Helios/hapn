"""
Scraper: Eventbrite (Hybrid)
1. Discovers event IDs by scraping Eventbrite search pages (JSON-LD).
2. Enriches each event via the v3 API for accurate times, prices, and categories.

The /events/search/ API was deprecated, but /events/{id}/ still works with
a private token — so we combine HTML discovery with API enrichment.
"""

import asyncio
import json
import os
import re
import httpx
from bs4 import BeautifulSoup

API_KEY = os.getenv("EVENTBRITE_API_KEY")
API_BASE = "https://www.eventbriteapi.com/v3"

# Utah Valley cities to search
SEARCH_SLUGS = [
    "ut--provo",
    "ut--orem",
    "ut--lehi",
    "ut--american-fork",
    "ut--pleasant-grove",
    "ut--spanish-fork",
    "ut--springville",
    "ut--lindon",
    "ut--saratoga-springs",
    "ut--eagle-mountain",
]

SEARCH_URL = "https://www.eventbrite.com/d/{slug}/events/"

# Eventbrite category_id -> our category
CATEGORY_MAP = {
    "103": "music",
    "110": "food",
    "108": "sports",
    "105": "arts",
    "104": "arts",
    "101": "community",
    "102": "community",
    "109": "outdoors",
    "115": "family",
    "106": "nightlife",
    "113": "community",
    "107": "community",
    "114": "community",
    "199": "community",
}

# Keyword fallback for when API category is missing
KEYWORD_CATEGORY_MAP = {
    "music": "music", "concert": "music", "live band": "music",
    "food": "food", "drink": "food", "tasting": "food",
    "sport": "sports", "fitness": "sports", "run ": "sports",
    "hike": "outdoors", "outdoor": "outdoors", "trail": "outdoors",
    "art": "arts", "theater": "arts", "theatre": "arts", "dance": "arts",
    "family": "family", "kid": "family", "children": "family",
    "night": "nightlife", "club": "nightlife", "party": "nightlife",
}

UV_CITIES = {
    "Provo", "Orem", "Lehi", "American Fork", "Pleasant Grove",
    "Spanish Fork", "Springville", "Lindon", "Saratoga Springs",
    "Eagle Mountain", "Highland", "Alpine", "Cedar Hills", "Vineyard",
    "Mapleton", "Salem", "Payson", "Santaquin", "Draper", "Herriman",
}


def _guess_category(title: str, description: str = "") -> str:
    text = f"{title} {description}".lower()
    for keyword, cat in KEYWORD_CATEGORY_MAP.items():
        if keyword in text:
            return cat
    return "community"


def _extract_event_id(url: str) -> str | None:
    match = re.search(r"-(\d+)(?:\?|$)", url)
    return match.group(1) if match else None


# ── Phase 1: Discover event IDs from HTML search pages ──────────────

async def _discover_ids(client: httpx.AsyncClient) -> set[str]:
    """Scrape Eventbrite search pages to collect event IDs."""
    all_ids = set()
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html",
    }

    for slug in SEARCH_SLUGS:
        url = SEARCH_URL.format(slug=slug)
        try:
            resp = await client.get(url, headers=headers, follow_redirects=True)
        except httpx.HTTPError as e:
            print(f"  [eventbrite] HTTP error for {slug}: {e}")
            continue

        if resp.status_code != 200:
            print(f"  [eventbrite] HTTP {resp.status_code} for {slug}")
            continue

        soup = BeautifulSoup(resp.text, "lxml")
        page_ids = set()

        for script in soup.find_all("script", type="application/ld+json"):
            try:
                data = json.loads(script.string)
            except (json.JSONDecodeError, TypeError):
                continue

            items = data if isinstance(data, list) else [data]
            for item in items:
                if item.get("@type") == "ItemList":
                    for li in item.get("itemListElement", []):
                        inner = li.get("item") or li
                        eid = _extract_event_id(inner.get("url", ""))
                        if eid:
                            page_ids.add(eid)
                elif item.get("@type") == "Event":
                    eid = _extract_event_id(item.get("url", ""))
                    if eid:
                        page_ids.add(eid)

        new = page_ids - all_ids
        all_ids |= page_ids
        print(f"  [eventbrite] {slug}: {len(page_ids)} events, {len(new)} new")

        await asyncio.sleep(2)  # polite delay

    print(f"  [eventbrite] discovered {len(all_ids)} unique event IDs")
    return all_ids


# ── Phase 2: Enrich each event via the API ──────────────────────────

async def _enrich_event(client: httpx.AsyncClient, event_id: str, headers: dict) -> dict | None:
    """Fetch full event details from the Eventbrite API."""
    url = f"{API_BASE}/events/{event_id}/?expand=venue,ticket_classes"
    try:
        resp = await client.get(url, headers=headers)
    except httpx.HTTPError:
        return None

    if resp.status_code != 200:
        return None

    ev = resp.json()

    # Extract venue + geo
    venue = ev.get("venue") or {}
    address = venue.get("address") or {}
    lat = address.get("latitude")
    lng = address.get("longitude")
    if not lat or not lng:
        return None

    city = address.get("city", "Unknown")
    # Filter to Utah Valley
    if city not in UV_CITIES and city != "Unknown":
        return None

    # Category
    cat_id = ev.get("category_id", "")
    category = CATEGORY_MAP.get(cat_id)
    if not category:
        title = ev.get("name", {}).get("text", "")
        desc = (ev.get("description", {}).get("text", "") or "")[:500]
        category = _guess_category(title, desc)

    # Price from ticket classes
    price = "Free" if ev.get("is_free") else None
    price_cents = 0 if ev.get("is_free") else None
    if not ev.get("is_free"):
        tickets = ev.get("ticket_classes") or []
        costs = [t["cost"]["value"] for t in tickets if (t.get("cost") or {}).get("value")]
        if costs:
            min_cents = min(int(c) for c in costs)
            price_cents = min_cents
            price = f"${min_cents / 100:.2f}"

    # Image
    logo = ev.get("logo") or {}
    image_url = logo.get("url")

    return {
        "source": "eventbrite",
        "source_id": f"eb-{ev['id']}",
        "source_url": ev.get("url"),
        "title": ev.get("name", {}).get("text", "Untitled"),
        "description": (ev.get("description", {}).get("text", "") or "")[:500],
        "venue_name": venue.get("name"),
        "city": city,
        "category": category,
        "tags": [category],
        "price": price,
        "price_cents_min": price_cents,
        "start_time": ev.get("start", {}).get("utc"),
        "end_time": ev.get("end", {}).get("utc"),
        "lat": float(lat),
        "lng": float(lng),
        "image_url": image_url,
        "status": "active",
    }


# ── Main scrape function ────────────────────────────────────────────

async def scrape() -> list[dict]:
    events = []

    async with httpx.AsyncClient(timeout=30) as client:
        # Phase 1: discover event IDs from search pages
        event_ids = await _discover_ids(client)

        if not event_ids:
            print("  [eventbrite] no events discovered")
            return []

        # Phase 2: enrich via API (if key available)
        if API_KEY:
            print(f"  [eventbrite] enriching {len(event_ids)} events via API...")
            headers = {"Authorization": f"Bearer {API_KEY}"}
            batch_size = 5
            id_list = list(event_ids)

            for i in range(0, len(id_list), batch_size):
                batch = id_list[i:i + batch_size]
                tasks = [_enrich_event(client, eid, headers) for eid in batch]
                results = await asyncio.gather(*tasks)
                for result in results:
                    if result:
                        events.append(result)
                # Respect rate limits: ~5 req per batch, short pause between batches
                await asyncio.sleep(0.5)

            print(f"  [eventbrite] enriched {len(events)} Utah Valley events via API")
        else:
            print("  [eventbrite] WARNING: No EVENTBRITE_API_KEY — falling back to HTML-only (less accurate)")
            # Fallback: re-scrape and parse JSON-LD without API enrichment
            events = await _fallback_html_only(client, event_ids)

    return events


async def _fallback_html_only(client: httpx.AsyncClient, event_ids: set[str]) -> list[dict]:
    """Fallback when no API key: use JSON-LD data directly (less accurate)."""
    events = []
    seen_ids = set()
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html",
    }

    for slug in SEARCH_SLUGS:
        url = SEARCH_URL.format(slug=slug)
        try:
            resp = await client.get(url, headers=headers, follow_redirects=True)
        except httpx.HTTPError:
            continue
        if resp.status_code != 200:
            continue

        soup = BeautifulSoup(resp.text, "lxml")
        for script in soup.find_all("script", type="application/ld+json"):
            try:
                data = json.loads(script.string)
            except (json.JSONDecodeError, TypeError):
                continue

            items = data if isinstance(data, list) else [data]
            for item in items:
                if item.get("@type") == "ItemList":
                    for li in item.get("itemListElement", []):
                        inner = li.get("item") or li
                        if inner.get("@type") == "Event":
                            _try_add_jsonld(inner, events, seen_ids)
                elif item.get("@type") == "Event":
                    _try_add_jsonld(item, events, seen_ids)

        await asyncio.sleep(2)

    return events


def _try_add_jsonld(item: dict, events: list, seen_ids: set):
    """Parse a JSON-LD event and add it if it's in Utah Valley."""
    url = item.get("url", "")
    event_id = _extract_event_id(url)
    if not event_id or event_id in seen_ids:
        return

    location = item.get("location") or {}
    geo = location.get("geo") or {}
    lat = geo.get("latitude")
    lng = geo.get("longitude")
    if not lat or not lng:
        return

    address = location.get("address") or {}
    city = address.get("addressLocality", "Unknown")
    if city not in UV_CITIES and city != "Unknown":
        return

    # Skip online-only
    mode = item.get("eventAttendanceMode", "")
    if "Online" in mode and "Offline" not in mode:
        return

    title = item.get("name", "Untitled")
    description = (item.get("description", "") or "")[:500]

    image = item.get("image")
    image_url = None
    if isinstance(image, str):
        image_url = image
    elif isinstance(image, list) and image:
        image_url = image[0]
    elif isinstance(image, dict):
        image_url = image.get("url")

    seen_ids.add(event_id)
    events.append({
        "source": "eventbrite",
        "source_id": f"eb-{event_id}",
        "source_url": url,
        "title": title,
        "description": description,
        "venue_name": location.get("name"),
        "city": city,
        "category": _guess_category(title, description),
        "tags": [_guess_category(title, description)],
        "price": None,
        "price_cents_min": None,
        "start_time": item.get("startDate"),
        "end_time": item.get("endDate"),
        "lat": float(lat),
        "lng": float(lng),
        "image_url": image_url,
        "status": "active",
    })
