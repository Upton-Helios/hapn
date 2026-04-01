"""
Scraper: Visit St. George / Greater Zion (events.greaterzion.com)
Uses the WordPress + The Events Calendar REST API to fetch public events.
Covers St. George / Washington County area — outdoors, festivals, music, family, etc.
"""

import asyncio
import html
import re
from datetime import datetime, timezone, timedelta
import httpx

API_BASE = "https://events.greaterzion.com/wp-json/tribe/events/v1/events"

# St. George center coordinates (fallback when event has no geo)
STG_LAT = 37.0965
STG_LNG = -113.5684

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json",
}

PAGE_SIZE = 50

# Keyword-based category detection (TEC API returns empty categories)
# Order matters — first match wins per keyword group
KEYWORD_RULES = [
    ("music", ["concert", "live music", "band", "singer", "symphony", "orchestra",
               "jazz", "blues", "rock", "country music", "dj ", "open mic",
               "karaoke", "choir", "acoustic", "musical performance", "floyd nation"]),
    ("sports", ["race ", "marathon", " 5k", " 10k", "triathlon", "pickleball",
                "softball", "basketball", "soccer", "football", "golf tournament",
                "cycling", "rodeo", "wrestling", "boxing"]),
    ("outdoors", ["hike", "hiking", "trail", "paddle", "kayak", "climb",
                  "camping", "outdoor", "state park", "canyon", "mountain bike",
                  "river", "fishing", "nature walk", "stargazing"]),
    ("food", ["food", "wine", "tasting", "culinary", "chef", "dinner",
              "brunch", "brewery", "cooking", "bake", "farmers market"]),
    ("family", ["family", "kids", "children", "youth", "easter", "egg hunt",
                "storytime", "puppet", "eggstravaganza", "spring fest"]),
    ("performing_arts", ["theatre", "theater", "plays ", "musical", "ballet",
                        "dance", "film festival", "cinema", "poetry", "mamma mia",
                        "improv", "comedy", "stand-up", "standup"]),
    ("exhibits", ["exhibit", "gallery", "museum", "art show", "art walk",
                  "installation"]),
    ("arts_crafts", ["art festival", "painting", "sculpture", "plein air",
                     "craft", "pottery", "weaving", "quilting", "art class"]),
    ("nightlife", ["nightlife", "club night", "bar crawl", "happy hour",
                   "late night", "drag show"]),
    ("community", ["festival", "fair", "market", "volunteer", "charity",
                   "fundraiser", "workshop", "class", "lecture", "seminar",
                   "meetup", "celebration", "parade", "carnival"]),
]


def _detect_category(title: str, description: str = "") -> str:
    """Detect category from title and description using keyword matching."""
    text = f"{title} {description[:500]}".lower()
    for category, keywords in KEYWORD_RULES:
        for kw in keywords:
            if kw in text:
                return category
    return "community"


def _detect_tags(title: str, description: str = "") -> list[str]:
    """Detect tags from title and description using keyword matching."""
    text = f"{title} {description[:500]}".lower()
    tags = set()
    for category, keywords in KEYWORD_RULES:
        for kw in keywords:
            if kw in text:
                tags.add(category)
                break
    return list(tags)


def _get_image(event: dict) -> str | None:
    """Extract image URL from event."""
    image = event.get("image") or {}
    url = image.get("url") or ""
    if url:
        return url
    # Try media array
    media = image.get("sizes") or {}
    for size in ["medium_large", "medium", "large", "full"]:
        if size in media:
            return media[size].get("url")
    return None


def _normalize_event(event: dict) -> dict | None:
    """Convert a TEC API event to our schema."""
    title = html.unescape((event.get("title") or "").strip())
    if not title:
        return None

    event_id = event.get("id")
    if not event_id:
        return None

    # Venue info
    venue = event.get("venue") or {}
    venue_name = (venue.get("venue") or "").strip()
    city = (venue.get("city") or "").strip() or "St. George"
    state = (venue.get("state") or venue.get("province") or "").strip() or "UT"
    address1 = (venue.get("address") or "").strip()
    zipcode = (venue.get("zip") or "").strip()

    # Coordinates
    lat = None
    lng = None
    geo_lat = venue.get("geo_lat")
    geo_lng = venue.get("geo_lng")
    if geo_lat and geo_lng:
        try:
            lat = float(geo_lat)
            lng = float(geo_lng)
        except (ValueError, TypeError):
            pass

    if lat is None or lng is None:
        lat, lng = STG_LAT, STG_LNG

    # Utah bounding box sanity check
    if not (36.9 <= lat <= 42.1 and -114.1 <= lng <= -109.0):
        lat, lng = STG_LAT, STG_LNG

    # Address
    if address1:
        address = f"{address1}, {city}, {state} {zipcode}".strip()
    elif venue_name:
        address = f"{venue_name}, {city}, {state}"
    else:
        address = f"{city}, {state}"

    # Dates
    start_date = event.get("start_date") or event.get("utc_start_date")
    end_date = event.get("end_date") or event.get("utc_end_date")
    if not start_date:
        return None

    # Description — strip HTML and decode entities
    description = event.get("description") or ""
    description = re.sub(r"<[^>]+>", " ", description)
    description = html.unescape(description)
    description = re.sub(r"\s+", " ", description).strip()[:2000]

    # URL
    source_url = event.get("url") or None
    website = event.get("website") or None

    # Price / cost
    cost = (event.get("cost") or "").strip()
    price = None
    price_cents_min = None
    if cost:
        cost_lower = cost.lower()
        if "free" in cost_lower:
            price = "Free"
            price_cents_min = 0
        else:
            price = cost

    category = _detect_category(title, description)
    tags = _detect_tags(title, description)
    image_url = _get_image(event)

    return {
        "source": "visitstgeorge",
        "source_id": f"vsg-{event_id}",
        "source_url": website or source_url,
        "title": title,
        "description": description,
        "venue_name": venue_name,
        "address": address,
        "city": city,
        "category": category,
        "tags": tags,
        "price": price,
        "price_cents_min": price_cents_min,
        "start_time": start_date,
        "end_time": end_date,
        "lat": lat,
        "lng": lng,
        "image_url": image_url,
        "status": "active",
    }


async def scrape() -> list[dict]:
    events = []
    seen_ids = set()

    # Start from today, look ahead 90 days
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    async with httpx.AsyncClient(timeout=30) as client:
        page = 1
        total_pages = 1  # Will be updated from first response

        while page <= total_pages:
            params = {
                "per_page": PAGE_SIZE,
                "page": page,
                "start_date": today,
            }

            try:
                resp = await client.get(API_BASE, params=params, headers=HEADERS, follow_redirects=True)

                if resp.status_code == 404:
                    # TEC returns 404 when page is beyond results
                    print(f"  [visitstgeorge] page {page}: no more results (404)")
                    break

                if resp.status_code != 200:
                    print(f"  [visitstgeorge] page {page}: HTTP {resp.status_code}")
                    break

                data = resp.json()
            except Exception as e:
                print(f"  [visitstgeorge] page {page} error: {e}")
                break

            # Update total pages from response
            if page == 1:
                total = data.get("total", 0)
                total_pages = data.get("total_pages", 1)
                print(f"  [visitstgeorge] API reports {total} total events, {total_pages} pages")

            items = data.get("events") or []

            page_count = 0
            for item in items:
                normalized = _normalize_event(item)
                if normalized and normalized["source_id"] not in seen_ids:
                    seen_ids.add(normalized["source_id"])
                    events.append(normalized)
                    page_count += 1

            print(f"  [visitstgeorge] page {page}: {len(items)} items, {page_count} new")

            page += 1
            await asyncio.sleep(1)  # polite delay

    print(f"  [visitstgeorge] {len(events)} total events after dedup")
    return events
