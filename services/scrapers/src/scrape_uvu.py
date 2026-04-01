"""
Scraper: UVU Events Calendar (uvu.edu)
Uses the 25Live PHP proxy API to fetch public events.
Keeps only major events: sports, concerts, theater, art exhibits, film screenings.
Filters out student clubs, campus life, wellness, and admin events.
"""

import asyncio
import re
from datetime import datetime, timezone, timedelta
import httpx

API_URL = "https://www.uvu.edu/_common/ext/25live/php/25live.php"

# UVU campus default coordinates
UVU_LAT = 40.2783
UVU_LNG = -111.7146

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json",
}

# Categories to scrape — major events only (sports, concerts, theater, art, film)
# Arts & Entertainment
ARTS_CATS = [120, 121, 122, 123, 124]  # Music, Dance, Theater, Art & Design, Film
# Athletics
ATHLETICS_CATS = [125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 137, 138, 139, 140]

ALL_CATS = ARTS_CATS + ATHLETICS_CATS

# Map 25Live category IDs to our categories
CATEGORY_MAP = {
    120: "music",              # Music
    121: "performing_arts",    # Dance
    122: "performing_arts",    # Theater
    123: "arts_crafts",        # Art & Design
    124: "performing_arts",    # Film
    125: "sports",     # Athletics
    126: "sports", 127: "sports", 128: "sports", 129: "sports",
    130: "sports", 131: "sports", 132: "sports", 133: "sports",
    134: "sports", 137: "sports", 138: "sports", 139: "sports", 140: "sports",
}

# Skip events with these keywords in the title (internal/admin/club)
SKIP_KEYWORDS = [
    "faculty meeting", "staff meeting", "department meeting",
    "committee meeting", "board meeting", "budget review",
    "employee orientation", "training session",
    "closed session", "internal",
    # Club and student life events
    "club meeting", "club meetup", "club practice", "club lesson",
    "club social", "club night", "club info",
    "pancakes", "open gym", "open mat",
    "intramural", "pickup game",
]

# Skip if title contains "club" (catches "Chess Club", "Bachata Club", etc.)
# Allow through: events at named club venues (rare at UVU)
SKIP_TITLE_PATTERNS = [
    r"\bclub\b",        # any mention of "club" in title
    r"\bpractice\b",    # club practices
    r"\blesson\b",      # club lessons
    r"\bmeetup\b",      # meetups
]

# Skip employee-only events
SKIP_AUDIENCES = ["Employees"]


def _should_skip(event: dict) -> bool:
    """Skip internal/admin/club events. Keep only major arts and sports."""
    title = event.get("event_name", "").lower()

    for kw in SKIP_KEYWORDS:
        if kw in title:
            return True

    for pat in SKIP_TITLE_PATTERNS:
        if re.search(pat, title):
            return True

    audience = event.get("audience", "")
    if audience in SKIP_AUDIENCES:
        return True

    # Skip employee-only activities (category 142)
    cat_ids = [c["category_id"] for c in event.get("categories", [])]
    if 142 in cat_ids:
        return True

    return False


def _get_category(event: dict) -> str:
    """Map 25Live categories to our categories."""
    for cat in event.get("categories", []):
        cid = cat["category_id"]
        if cid in CATEGORY_MAP:
            return CATEGORY_MAP[cid]
    return "community"


def _get_tags(event: dict) -> list[str]:
    """Build tags from 25Live categories."""
    tags = set()
    for cat in event.get("categories", []):
        cid = cat["category_id"]
        if cid in CATEGORY_MAP:
            tags.add(CATEGORY_MAP[cid])
        if cid == -2 or cid == 95:  # Featured / Top Events
            tags.add("featured")
    return list(tags)


def _get_venue(event: dict) -> str:
    """Extract venue name from locations."""
    locs = event.get("locations", [])
    if not locs:
        return "UVU Campus"
    # Use formal_name if it's descriptive, otherwise space_name
    loc = locs[0]
    formal = loc.get("formal_name", "")
    space = loc.get("space_name", "")
    partition = loc.get("partition_name", "")

    # Prefer formal name if it's more descriptive
    if formal and formal != space:
        return formal

    # Fall back to partition (building name) + space
    if partition:
        building = partition.split(" - ")[-1].strip() if " - " in partition else partition
        return f"{space}, {building}" if space else building

    return space or "UVU Campus"


def _normalize_event(event: dict) -> dict | None:
    """Convert a 25Live event to our schema."""
    if _should_skip(event):
        return None

    start = event.get("start_time", {})
    end = event.get("end_time", {})

    start_utc = start.get("utc")
    end_utc = end.get("utc")
    if not start_utc:
        return None

    # Ensure Z suffix for ISO format
    if start_utc and not start_utc.endswith("Z"):
        start_utc += "Z"
    if end_utc and not end_utc.endswith("Z"):
        end_utc += "Z"

    # Skip past events
    now = datetime.now(timezone.utc)
    check = end_utc or start_utc
    try:
        dt = datetime.fromisoformat(check.replace("Z", "+00:00"))
        if dt < now:
            return None
    except (ValueError, TypeError):
        pass

    title = event.get("event_name", "").strip()
    if not title:
        return None

    description = event.get("description", "") or ""
    # Strip HTML tags
    description = re.sub(r"<[^>]+>", " ", description)
    description = re.sub(r"\s+", " ", description).strip()
    description = description[:2000]

    category = _get_category(event)
    tags = _get_tags(event)
    venue = _get_venue(event)

    # Image URL — validate it's actually an image, not a page URL
    image_url = event.get("image_url")
    if image_url and not any(image_url.lower().endswith(ext) for ext in (".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg")):
        image_url = None

    # Source/detail URL
    details = event.get("details_url") or None
    ticket = event.get("ticket_url") or None
    # ticket_url is sometimes "0" instead of null
    if ticket and ticket in ("0", "null", ""):
        ticket = None
    source_url = details or ticket

    # Price from ticket_url presence
    price = None
    if ticket:
        price = "Tickets available"

    event_id = event.get("event_id", "")

    return {
        "source": "uvu",
        "source_id": f"uvu-{event_id}",
        "source_url": source_url,
        "title": title,
        "description": description,
        "venue_name": venue,
        "address": f"UVU Campus, 800 W University Pkwy, Orem, UT 84058",
        "city": "Orem",
        "category": category,
        "tags": tags,
        "price": price,
        "price_cents_min": None,
        "start_time": start_utc,
        "end_time": end_utc if end_utc != start_utc else None,
        "lat": UVU_LAT,
        "lng": UVU_LNG,
        "image_url": image_url,
        "status": "active",
    }


async def scrape() -> list[dict]:
    events = []

    # Build category string with double-encoded + signs
    cat_str = "%2B".join(str(c) for c in ALL_CATS)
    url = f"{API_URL}?category_id={cat_str}&audience=students%252Bemployee&limit=300"

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.get(url, headers=HEADERS, follow_redirects=True)
            if resp.status_code != 200:
                print(f"  [uvu] HTTP {resp.status_code}")
                return []

            data = resp.json()
            raw_events = data.get("events") or []
            print(f"  [uvu] API returned {len(raw_events)} events")

            for raw in raw_events:
                normalized = _normalize_event(raw)
                if normalized:
                    events.append(normalized)

        except Exception as e:
            print(f"  [uvu] error: {e}")
            return []

    # Deduplicate by source_id (same event may appear in multiple categories)
    seen = set()
    unique = []
    for e in events:
        if e["source_id"] not in seen:
            seen.add(e["source_id"])
            unique.append(e)

    print(f"  [uvu] {len(unique)} public events after filtering")
    return unique
