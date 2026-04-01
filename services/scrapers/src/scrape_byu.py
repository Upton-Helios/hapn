"""
Scraper: BYU Events Calendar (calendar.byu.edu)
Uses the official REST API to fetch public events.
Keeps only major events: sports, concerts, theater, art exhibits.
Filters out academic deadlines, student life, and club events.
"""

import asyncio
import re
from datetime import datetime, timezone, timedelta
import httpx

API_URL = "https://calendar.byu.edu/api/Events.json"

# Mountain Time (America/Denver)
MT = timezone(timedelta(hours=-6))

# BYU campus default coordinates
BYU_LAT = 40.2518
BYU_LNG = -111.6493

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json",
}

# Major event categories only (sports, arts, performances)
PUBLIC_CATEGORIES = {
    "9": "Arts & Entertainment",
    "10": "Athletics",
}

# Map BYU categories to our categories
CATEGORY_MAP = {
    "Arts & Entertainment": "arts",
    "Athletics": "sports",
}

# Title keywords that indicate academic/internal/student-life events to skip
SKIP_KEYWORDS = [
    "withdraw deadline", "last day to add", "last day to drop",
    "registration", "grades due", "semester begins", "semester ends",
    "finals", "reading day", "commencement rehearsal",
    "no classes", "holiday break", "campus closed",
    # Student life / club events
    "craft night", "game night", "movie night",
    "fhe", "stuff swap", "open mic",
    "intramural", "pickup game", "open gym", "open mat",
]

# Skip if title contains these patterns (club activities, etc.)
SKIP_TITLE_PATTERNS = [
    r"\bclub\b",        # any club event
    r"\bmeetup\b",      # meetups
    r"\bsocial\b",      # socials
]


def _should_skip(event: dict) -> bool:
    """Skip academic deadlines, internal events, and student life/club events."""
    title = event.get("Title", "").lower()

    # Skip if title matches keywords
    for kw in SKIP_KEYWORDS:
        if kw in title:
            return True

    # Skip club/student life patterns
    for pat in SKIP_TITLE_PATTERNS:
        if re.search(pat, title):
            return True

    # Skip events not on the main calendar
    if event.get("IsPublishedNotMainCalendar") == "true":
        return True

    # Skip events hosted on academiccalendar.byu.edu
    url = event.get("FullUrl", "")
    if "academiccalendar" in url:
        return True

    # Skip if category ID is a UUID (these are academic calendar categories)
    cat_id = event.get("CategoryId", "")
    if len(cat_id) > 10:
        return True

    return False


def _parse_datetime(raw: str) -> str | None:
    """Parse 'MM-dd-yyyy HH:mm:ss' or 'yyyy-MM-dd HH:mm:ss' to ISO 8601 UTC."""
    if not raw or not raw.strip():
        return None

    for fmt in ("%m-%d-%Y %H:%M:%S", "%Y-%m-%d %H:%M:%S"):
        try:
            local_dt = datetime.strptime(raw.strip(), fmt)
            utc_dt = local_dt.replace(tzinfo=MT).astimezone(timezone.utc)
            return utc_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        except ValueError:
            continue
    return None


def _parse_price(event: dict) -> tuple[str | None, int | None]:
    """Extract price info from event."""
    if event.get("IsFree") == "true":
        return "Free", 0

    low = event.get("LowPrice", "0.0")
    high = event.get("HighPrice", "0.0")
    try:
        low_f = float(low)
        high_f = float(high)
    except (ValueError, TypeError):
        return None, None

    if low_f == 0 and high_f == 0:
        return "Free", 0

    cents = int(low_f * 100)
    if low_f == high_f:
        return f"${low_f:.0f}", cents
    return f"${low_f:.0f}–${high_f:.0f}", cents


def _parse_coords(event: dict) -> tuple[float, float]:
    """Extract coordinates, falling back to BYU campus center."""
    try:
        lat = float(event.get("Latitude", "").strip())
        lng = float(event.get("Longitude", "").strip())
        if lat != 0 and lng != 0:
            return lat, lng
    except (ValueError, TypeError):
        pass
    return BYU_LAT, BYU_LNG


def _normalize_event(event: dict) -> dict | None:
    """Convert a BYU API event to our schema."""
    if _should_skip(event):
        return None

    start_time = _parse_datetime(event.get("StartDateTime", ""))
    if not start_time:
        return None

    end_time = _parse_datetime(event.get("EndDateTime", ""))

    # Filter past events
    now = datetime.now(timezone.utc)
    check = end_time or start_time
    try:
        dt = datetime.fromisoformat(check.replace("Z", "+00:00"))
        if dt < now:
            return None
    except (ValueError, TypeError):
        pass

    cat_name = event.get("CategoryName", "Other")
    category = CATEGORY_MAP.get(cat_name, "community")

    price_str, price_cents = _parse_price(event)
    lat, lng = _parse_coords(event)

    title = event.get("Title", "").strip()
    description = (event.get("Description") or event.get("ShortDescription") or "").strip()
    image_url = event.get("ImgUrl") or None
    if image_url == "None":
        image_url = None

    # Build address from location name
    location_name = (event.get("LocationName") or "").strip()
    venue = location_name if location_name else "BYU Campus"

    tags = [category]
    if event.get("IsFree") == "true":
        tags.append("free")

    return {
        "source": "byu",
        "source_id": f"byu-{event['EventId']}",
        "source_url": event.get("FullUrl"),
        "title": title,
        "description": description,
        "venue_name": venue,
        "address": f"{venue}, Provo, UT" if location_name else "BYU Campus, Provo, UT 84602",
        "city": "Provo",
        "category": category,
        "tags": tags,
        "price": price_str,
        "price_cents_min": price_cents,
        "start_time": start_time,
        "end_time": end_time,
        "lat": lat,
        "lng": lng,
        "image_url": image_url,
        "status": "active",
    }


async def scrape() -> list[dict]:
    events = []
    today = datetime.now(MT).strftime("%Y-%m-%d")
    # Fetch 3 months ahead
    end_date = (datetime.now(MT) + timedelta(days=90)).strftime("%Y-%m-%d")

    async with httpx.AsyncClient(timeout=30) as client:
        for cat_id, cat_name in PUBLIC_CATEGORIES.items():
            try:
                resp = await client.get(
                    API_URL,
                    params={
                        "categories": cat_id,
                        "event[min][date]": today,
                        "event[max][date]": end_date,
                    },
                    headers=HEADERS,
                    follow_redirects=True,
                )

                if resp.status_code != 200:
                    print(f"  [byu] category {cat_name}: HTTP {resp.status_code}")
                    continue

                data = resp.json()
                count = 0
                for raw_event in data:
                    normalized = _normalize_event(raw_event)
                    if normalized:
                        events.append(normalized)
                        count += 1

                print(f"  [byu] {cat_name}: {count} public events")

            except Exception as e:
                print(f"  [byu] error fetching {cat_name}: {e}")

            await asyncio.sleep(1)

    # Deduplicate by source_id (events can appear in multiple categories)
    seen = set()
    unique = []
    for e in events:
        if e["source_id"] not in seen:
            seen.add(e["source_id"])
            unique.append(e)

    print(f"  [byu] total: {len(unique)} unique public events")
    return unique
