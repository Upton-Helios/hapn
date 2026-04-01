"""
Scraper: Visit Salt Lake (visitsaltlake.com)
Uses the Simpleview CMS REST API to fetch public events.
Covers Salt Lake City metro area — concerts, theater, sports, festivals, etc.
"""

import asyncio
import json
import urllib.parse
from datetime import datetime, timezone, timedelta
import httpx

API_BASE = "https://www.visitsaltlake.com/includes/rest_v2/plugins_events_events_by_date/find/"
API_TOKEN = "324f4350f0f1e6c53032d29845431c29"

# Default SLC center coordinates (used when event has no geo)
SLC_LAT = 40.7608
SLC_LNG = -111.8910

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json",
}

PAGE_SIZE = 50

# Simpleview category IDs -> our categories
CATEGORY_MAP = {
    "3": "arts_crafts",        # Art (visual arts, crafts)
    "4": "performing_arts",    # Comedy (stand-up, improv shows)
    "5": "nightlife",          # Nightlife
    "6": "sports",             # Sports
    "7": "community",          # Festivals & Special Events
    "10": "exhibits",          # Museums
    "12": "performing_arts",   # Performing Arts
    "15": "arts_crafts",       # Classes & Workshops
    "18": "family",            # Kids & Families
    "22": "community",         # Holiday
    "97": "music",             # Concerts & Live Music
    "142": "performing_arts",  # Theatre
    "144": "outdoors",         # Outdoors
    "145": "performing_arts",  # Literary/Film (screenings, readings)
    "149": "food",             # Culinary
    "156": "community",        # Date Night
    "187": "performing_arts",  # Dance
}

ALL_CAT_IDS = list(CATEGORY_MAP.keys())


def _build_query(skip: int = 0) -> str:
    """Build the JSON query param for the Simpleview events API."""
    # API requires dates at midnight in Mountain time (UTC-6)
    MT = timezone(timedelta(hours=-6))
    now_mt = datetime.now(MT).replace(hour=0, minute=0, second=0, microsecond=0)
    start_utc = now_mt.astimezone(timezone.utc)
    end_utc = (now_mt + timedelta(days=90)).astimezone(timezone.utc)

    query = {
        "filter": {
            "active": True,
            "$and": [
                {"categories.catId": {"$in": ALL_CAT_IDS}},
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
                "startTime": 1, "endTime": 1,
                "location": 1, "hostname": 1, "city": 1, "state": 1,
                "address1": 1, "zip": 1,
                "loc": 1, "categories": 1, "media_raw": 1,
                "detail_type": 1, "linkUrl": 1,
            },
            "sort": {"date": 1, "rank": 1, "title_sort": 1},
        },
    }
    return json.dumps(query, separators=(",", ":"))


def _get_category(event: dict) -> str:
    """Map Simpleview categories to our categories."""
    cats = event.get("categories") or []
    priority = ["music", "sports", "food", "family", "outdoors", "performing_arts", "exhibits", "arts_crafts", "nightlife", "community"]
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
    media = event.get("media_raw") or event.get("_media") or []
    for m in media:
        url = m.get("mediaurl") or ""
        if url and ("Image" in m.get("mediatype", "Image") or url.endswith((".jpg", ".jpeg", ".png", ".webp"))):
            return f"https://assets.simpleviewinc.com/simpleview/image/fetch/c_fill,h_400,q_75,w_600/{url}"
    return None


def _get_tags(event: dict) -> list[str]:
    """Build tags from categories."""
    tags = set()
    for cat in event.get("categories") or []:
        cat_id = str(cat.get("catId", ""))
        if cat_id in CATEGORY_MAP:
            tags.add(CATEGORY_MAP[cat_id])
        name = (cat.get("catName") or "").lower()
        if "free" in name:
            tags.add("free")
    return list(tags)


def _normalize_event(event: dict) -> dict | None:
    """Convert a Simpleview API event to our schema."""
    title = (event.get("title") or "").strip()
    if not title:
        return None

    recid = event.get("recid") or event.get("recId")
    if not recid:
        return None

    # Coordinates from loc.coordinates [lng, lat] (GeoJSON format)
    loc = event.get("loc") or {}
    coords = loc.get("coordinates") or []
    if len(coords) == 2:
        lng, lat = float(coords[0]), float(coords[1])
    else:
        lat, lng = SLC_LAT, SLC_LNG

    # Utah bounding box sanity check
    if not (36.9 <= lat <= 42.1 and -114.1 <= lng <= -109.0):
        lat, lng = SLC_LAT, SLC_LNG

    # Dates — combine date + startTime/endTime
    start_date = event.get("date") or event.get("startDate")
    end_date = event.get("endDate")
    if not start_date:
        return None

    # City
    city = event.get("city") or "Salt Lake City"

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

    # Description
    description = (event.get("description") or "")[:2000]

    # URL — prefer detail_type-based URL, fallback to linkUrl
    detail_type = event.get("detail_type") or ""
    url_path = f"/event/{detail_type}/{recid}/" if detail_type else f"/event/{recid}/"
    source_url = f"https://www.visitsaltlake.com{url_path}"

    # External link (ticket/info URL)
    link_url = event.get("linkUrl") or None

    category = _get_category(event)
    tags = _get_tags(event)
    image_url = _get_image(event)

    return {
        "source": "visitsaltlake",
        "source_id": f"vsl-{recid}",
        "source_url": link_url or source_url,
        "title": title,
        "description": description,
        "venue_name": venue,
        "address": address,
        "city": city,
        "category": category,
        "tags": tags,
        "price": None,
        "price_cents_min": None,
        "start_time": start_date,
        "end_time": end_date,
        "lat": lat,
        "lng": lng,
        "image_url": image_url,
        "status": "active",
    }


def _extract_items(data: dict) -> tuple[list[dict], int]:
    """Extract items and count from Simpleview API response.
    Response shape: { docs: { count: N, docs: [...] } }
    """
    outer = data.get("docs") or {}
    items = outer.get("docs") or outer.get("items") or []
    count = outer.get("count", 0)
    return items, count


async def scrape() -> list[dict]:
    events = []
    seen_ids = set()

    async with httpx.AsyncClient(timeout=30) as client:
        # First request to get total count
        query = _build_query(skip=0)
        url = f"{API_BASE}?json={urllib.parse.quote(query)}&token={API_TOKEN}"

        try:
            resp = await client.get(url, headers=HEADERS, follow_redirects=True)
            if resp.status_code != 200:
                print(f"  [visitsaltlake] HTTP {resp.status_code}: {resp.text[:200]}")
                return []

            data = resp.json()
        except Exception as e:
            print(f"  [visitsaltlake] error: {e}")
            return []

        items, total = _extract_items(data)
        print(f"  [visitsaltlake] API reports {total} total events")

        # Process first page
        for item in items:
            normalized = _normalize_event(item)
            if normalized and normalized["source_id"] not in seen_ids:
                seen_ids.add(normalized["source_id"])
                events.append(normalized)

        print(f"  [visitsaltlake] page 1: {len(items)} items, {len(events)} events")

        # Paginate through remaining pages
        pages_needed = (total + PAGE_SIZE - 1) // PAGE_SIZE
        for page in range(1, pages_needed):
            skip = page * PAGE_SIZE
            query = _build_query(skip=skip)
            url = f"{API_BASE}?json={urllib.parse.quote(query)}&token={API_TOKEN}"

            try:
                resp = await client.get(url, headers=HEADERS, follow_redirects=True)
                if resp.status_code != 200:
                    print(f"  [visitsaltlake] page {page+1}: HTTP {resp.status_code}")
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

                print(f"  [visitsaltlake] page {page+1}: {len(items)} items, {page_count} new")

            except Exception as e:
                print(f"  [visitsaltlake] page {page+1} error: {e}")

            await asyncio.sleep(1)  # polite delay

    print(f"  [visitsaltlake] {len(events)} total events after dedup")
    return events
