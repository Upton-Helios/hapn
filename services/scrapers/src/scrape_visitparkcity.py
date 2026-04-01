"""
Scraper: Visit Park City (visitparkcity.com)
Uses the Simpleview CMS REST API to fetch public events.
Covers Park City area — skiing, concerts, festivals, arts, food, etc.
"""

import asyncio
import json
import urllib.parse
from datetime import datetime, timezone, timedelta
import httpx

API_BASE = "https://www.visitparkcity.com/includes/rest_v2/plugins_events_events_by_date/find/"
API_TOKEN = "99d10b58182eb49f823389f95982132e"

# Park City center coordinates (fallback when event has no geo)
PC_LAT = 40.6461
PC_LNG = -111.4980

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json",
}

PAGE_SIZE = 50

# Simpleview category IDs -> our categories (Leisure Calendar)
CATEGORY_MAP = {
    "42": "arts",          # Visual Arts
    "43": "sports",        # Sports & Athletics
    "44": "arts",          # Film & Literature
    "45": "arts",          # Theater & Performing Arts
    "47": "music",         # Music & Concerts
    "50": "community",     # Community Events
    "53": "food",          # Food & Drink
    "59": "community",     # Markets & Fairs
    "61": "community",     # Lectures & Tours
    "74": "sports",        # Deer Valley Resort
    "75": "sports",        # Park City Mountain
    "76": "sports",        # Utah Olympic Park
    "79": "community",     # National Ability Center
    "80": "community",     # Featured Events
    "81": "sports",        # 2026 Olympic Events
}

# Skip these categories
SKIP_CAT_IDS = [
    "63",  # Online Classes & Workshops
    "64",  # Cancel | Unpublish
    "67",  # Virtual Events
]

ALL_CAT_IDS = list(CATEGORY_MAP.keys())


def _build_query(skip: int = 0) -> str:
    """Build the JSON query param for the Simpleview events API."""
    MT = timezone(timedelta(hours=-6))
    now_mt = datetime.now(MT).replace(hour=0, minute=0, second=0, microsecond=0)
    start_utc = now_mt.astimezone(timezone.utc)
    end_utc = (now_mt + timedelta(days=90)).astimezone(timezone.utc)

    query = {
        "filter": {
            "active": True,
            "$and": [
                {"categories.catId": {"$in": ALL_CAT_IDS}},
                {"categories.catId": {"$nin": SKIP_CAT_IDS}},
            ],
            "date_range": {
                "start": {"$date": start_utc.strftime("%Y-%m-%dT%H:%M:%S.000Z")},
                "end": {"$date": end_utc.strftime("%Y-%m-%dT%H:%M:%S.000Z")},
            },
        },
        "options": {
            "limit": PAGE_SIZE,
            "skip": skip,
            "count": True,
            "castDocs": False,
            "fields": {
                "recid": 1, "title": 1, "description": 1,
                "date": 1, "startDate": 1, "endDate": 1,
                "location": 1, "hostname": 1, "city": 1, "state": 1,
                "address1": 1, "zip": 1,
                "loc": 1, "latitude": 1, "longitude": 1,
                "categories": 1, "media_raw": 1,
                "detail_type": 1, "linkUrl": 1, "url": 1,
                "admission": 1,
            },
            "sort": {"date": 1, "rank": 1, "title_sort": 1},
        },
    }
    return json.dumps(query, separators=(",", ":"))


def _get_category(event: dict) -> str:
    """Map Simpleview categories to our categories."""
    cats = event.get("categories") or []
    priority = ["music", "sports", "food", "family", "outdoors", "arts", "nightlife", "community"]
    found = set()
    for cat in cats:
        cat_id = str(cat.get("catId", ""))
        if cat_id in CATEGORY_MAP:
            found.add(CATEGORY_MAP[cat_id])
    for p in priority:
        if p in found:
            return p
    return "community"


def _get_image(event: dict) -> str | None:
    """Extract best image URL from media_raw."""
    media = event.get("media_raw") or []
    for m in media:
        url = m.get("mediaurl") or ""
        if url:
            # Use Simpleview CDN for optimized images
            if "simpleviewcrm.com" in url or "simpleviewinc.com" in url:
                return f"https://assets.simpleviewinc.com/simpleview/image/fetch/c_fill,h_400,q_75,w_600/{url}"
            return url
    return None


def _get_tags(event: dict) -> list[str]:
    """Build tags from categories."""
    tags = set()
    for cat in event.get("categories") or []:
        cat_id = str(cat.get("catId", ""))
        if cat_id in CATEGORY_MAP:
            tags.add(CATEGORY_MAP[cat_id])
    return list(tags)


def _normalize_event(event: dict) -> dict | None:
    """Convert a Simpleview API event to our schema."""
    title = (event.get("title") or "").strip()
    if not title:
        return None

    recid = event.get("recid") or event.get("recId")
    if not recid:
        return None

    # Coordinates — try loc.coordinates first, then lat/lng fields
    loc = event.get("loc") or {}
    coords = loc.get("coordinates") or []
    if len(coords) == 2:
        lng, lat = float(coords[0]), float(coords[1])
    elif event.get("latitude") and event.get("longitude"):
        lat, lng = float(event["latitude"]), float(event["longitude"])
    else:
        lat, lng = PC_LAT, PC_LNG

    # Utah bounding box sanity check
    if not (36.9 <= lat <= 42.1 and -114.1 <= lng <= -109.0):
        lat, lng = PC_LAT, PC_LNG

    # Dates
    start_date = event.get("date") or event.get("startDate")
    end_date = event.get("endDate")
    if not start_date:
        return None

    # City
    city = event.get("city") or "Park City"

    # Venue
    venue = event.get("location") or event.get("hostname") or ""

    # Address
    address1 = event.get("address1") or ""
    state = event.get("state") or "UT"
    zipcode = event.get("zip") or ""
    if address1:
        address = f"{address1}, {city}, {state} {zipcode}".strip()
    elif venue:
        address = f"{venue}, {city}, {state}"
    else:
        address = f"{city}, {state}"

    # Description — strip HTML tags
    import re
    description = event.get("description") or ""
    description = re.sub(r"<[^>]+>", " ", description)
    description = re.sub(r"\s+", " ", description).strip()[:2000]

    # URL
    url_path = event.get("url") or ""
    source_url = f"https://www.visitparkcity.com{url_path}" if url_path else None

    # External link
    link_url = event.get("linkUrl") or None

    # Price
    admission = event.get("admission") or None
    price = None
    if admission:
        admission_lower = admission.lower().strip()
        if "free" in admission_lower:
            price = "Free"
        elif admission_lower:
            price = admission

    category = _get_category(event)
    tags = _get_tags(event)
    image_url = _get_image(event)

    return {
        "source": "visitparkcity",
        "source_id": f"vpc-{recid}",
        "source_url": link_url or source_url,
        "title": title,
        "description": description,
        "venue_name": venue,
        "address": address,
        "city": city,
        "category": category,
        "tags": tags,
        "price": price,
        "price_cents_min": 0 if price == "Free" else None,
        "start_time": start_date,
        "end_time": end_date,
        "lat": lat,
        "lng": lng,
        "image_url": image_url,
        "status": "active",
    }


def _extract_items(data: dict) -> tuple[list[dict], int]:
    """Extract items and count from Simpleview API response."""
    outer = data.get("docs") or {}
    items = outer.get("docs") or []
    count = outer.get("count", 0)
    return items, count


async def scrape() -> list[dict]:
    events = []
    seen_ids = set()

    async with httpx.AsyncClient(timeout=30) as client:
        # First request
        query = _build_query(skip=0)
        url = f"{API_BASE}?json={urllib.parse.quote(query)}&token={API_TOKEN}"

        try:
            resp = await client.get(url, headers=HEADERS, follow_redirects=True)
            if resp.status_code != 200:
                print(f"  [visitparkcity] HTTP {resp.status_code}: {resp.text[:200]}")
                return []
            data = resp.json()
        except Exception as e:
            print(f"  [visitparkcity] error: {e}")
            return []

        items, total = _extract_items(data)
        print(f"  [visitparkcity] API reports {total} total events")

        # Process first page
        for item in items:
            normalized = _normalize_event(item)
            if normalized and normalized["source_id"] not in seen_ids:
                seen_ids.add(normalized["source_id"])
                events.append(normalized)

        print(f"  [visitparkcity] page 1: {len(items)} items, {len(events)} events")

        # Paginate
        pages_needed = (total + PAGE_SIZE - 1) // PAGE_SIZE
        for page in range(1, pages_needed):
            skip = page * PAGE_SIZE
            query = _build_query(skip=skip)
            url = f"{API_BASE}?json={urllib.parse.quote(query)}&token={API_TOKEN}"

            try:
                resp = await client.get(url, headers=HEADERS, follow_redirects=True)
                if resp.status_code != 200:
                    print(f"  [visitparkcity] page {page+1}: HTTP {resp.status_code}")
                    continue

                data = resp.json()
                items, _ = _extract_items(data)

                page_count = 0
                for item in items:
                    normalized = _normalize_event(item)
                    if normalized and normalized["source_id"] not in seen_ids:
                        seen_ids.add(normalized["source_id"])
                        events.append(normalized)
                        page_count += 1

                print(f"  [visitparkcity] page {page+1}: {len(items)} items, {page_count} new")

            except Exception as e:
                print(f"  [visitparkcity] page {page+1} error: {e}")

            await asyncio.sleep(1)

    print(f"  [visitparkcity] {len(events)} total events after dedup")
    return events
