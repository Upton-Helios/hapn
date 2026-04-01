"""
Scraper: NowPlayingUtah (nowplayingutah.com)
Uses the public iCalendar feed to fetch performing arts events.
Filters to Utah Valley venues only.
"""

import asyncio
import html
import re
from datetime import datetime, timezone, timedelta
import httpx

ICAL_URL = "https://nowplayingutah.com/wp-json/apollo/v1/calendar/subscribe/all"

# Mountain Time
MT = timezone(timedelta(hours=-6))

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/calendar",
}

# Utah Valley cities and approximate center coordinates
UV_CITIES = {
    "provo":          (40.2338, -111.6585),
    "orem":           (40.2969, -111.6946),
    "lehi":           (40.3916, -111.8508),
    "springville":    (40.1652, -111.6107),
    "spanish fork":   (40.1149, -111.6549),
    "american fork":  (40.3769, -111.7952),
    "pleasant grove": (40.3641, -111.7385),
    "lindon":         (40.3425, -111.7207),
    "mapleton":       (40.1265, -111.5735),
    "payson":         (40.0443, -111.7324),
    "salem":          (40.0543, -111.6735),
    "vineyard":       (40.3047, -111.7474),
    "highland":       (40.4271, -111.7952),
    "alpine":         (40.4532, -111.7735),
    "cedar hills":    (40.4141, -111.7535),
    "saratoga springs": (40.3494, -111.9046),
    "eagle mountain": (40.3141, -112.0069),
    "santaquin":      (39.9754, -111.7857),
    "draper":         (40.5246, -111.8638),
    "heber city":     (40.5069, -111.4135),
    "midway":         (40.5121, -111.4735),
    "sundance":       (40.3928, -111.5811),
}

# NowPlayingUtah boilerplate to strip from descriptions
BOILERPLATE_RE = re.compile(
    r"This calendar listing is brought to you by NowPlayingUtah\.com.*$",
    re.IGNORECASE | re.DOTALL,
)


def _parse_ical_datetime(raw: str) -> str | None:
    """Parse iCal datetime like '20260401T193000' to ISO 8601 UTC."""
    raw = raw.strip()
    if not raw:
        return None
    try:
        if "T" in raw:
            local_dt = datetime.strptime(raw, "%Y%m%dT%H%M%S")
        else:
            local_dt = datetime.strptime(raw, "%Y%m%d")
        utc_dt = local_dt.replace(tzinfo=MT).astimezone(timezone.utc)
        return utc_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    except ValueError:
        return None


def _unescape_ical(text: str) -> str:
    """Unescape iCal text (backslash-comma, backslash-n, etc)."""
    text = text.replace("\\,", ",")
    text = text.replace("\\;", ";")
    text = text.replace("\\n", "\n")
    text = text.replace("\\N", "\n")
    text = html.unescape(text)
    return text.strip()


def _extract_city(location: str) -> tuple[str | None, tuple[float, float] | None]:
    """Find a Utah Valley city in the location string. Returns (city_name, (lat, lng))."""
    loc_lower = location.lower()
    for city, coords in UV_CITIES.items():
        if city in loc_lower:
            # Capitalize properly
            display = city.title()
            return display, coords
    return None, None


def _parse_vevents(ical_text: str) -> list[dict]:
    """Parse iCal text into a list of raw event dicts."""
    events = []
    # Unfold long lines (lines starting with space/tab are continuations)
    ical_text = re.sub(r"\r?\n[ \t]", "", ical_text)

    blocks = re.findall(r"BEGIN:VEVENT(.*?)END:VEVENT", ical_text, re.DOTALL)

    now = datetime.now(timezone.utc)

    for block in blocks:
        fields = {}
        for line in block.strip().split("\n"):
            line = line.strip()
            if ":" in line:
                key, _, value = line.partition(":")
                # Handle properties with parameters like DTSTART;VALUE=DATE:20260401
                key = key.split(";")[0]
                fields[key] = value

        # Must have basics
        if not fields.get("SUMMARY") or not fields.get("DTSTART"):
            continue

        location = _unescape_ical(fields.get("LOCATION", ""))
        city, coords = _extract_city(location)

        # Skip non-Utah Valley events
        if not city:
            continue

        start_time = _parse_ical_datetime(fields["DTSTART"])
        if not start_time:
            continue

        end_raw = fields.get("DTEND", "")
        end_time = _parse_ical_datetime(end_raw) if end_raw else None

        # Skip past events
        check = end_time or start_time
        try:
            dt = datetime.fromisoformat(check.replace("Z", "+00:00"))
            if dt < now:
                continue
        except (ValueError, TypeError):
            pass

        title = _unescape_ical(fields.get("SUMMARY", ""))
        description = _unescape_ical(fields.get("DESCRIPTION", ""))
        description = BOILERPLATE_RE.sub("", description).strip()

        url = fields.get("URL", "").strip()
        uid = fields.get("UID", "").strip()

        # Build source_id from UID
        source_id = f"npu-{uid}" if uid else f"npu-{hash(title + start_time)}"

        lat, lng = coords

        events.append({
            "source": "nowplayingutah",
            "source_id": source_id,
            "source_url": url if url else None,
            "title": title,
            "description": description[:2000] if description else "",
            "venue_name": location.split(",")[0].strip() if location else None,
            "address": location.replace("\\,", ",") if location else None,
            "city": city,
            "category": "arts",
            "tags": ["arts", "performing arts"],
            "price": None,
            "price_cents_min": None,
            "start_time": start_time,
            "end_time": end_time if end_time != start_time else None,
            "lat": lat,
            "lng": lng,
            "image_url": None,  # iCal feed doesn't include images
            "status": "active",
        })

    return events


async def scrape() -> list[dict]:
    async with httpx.AsyncClient(timeout=60) as client:
        try:
            resp = await client.get(ICAL_URL, headers=HEADERS, follow_redirects=True)
            if resp.status_code != 200:
                print(f"  [nowplayingutah] HTTP {resp.status_code}")
                return []
        except httpx.HTTPError as e:
            print(f"  [nowplayingutah] fetch error: {e}")
            return []

        print(f"  [nowplayingutah] downloaded iCal feed ({len(resp.text)} chars)")
        events = _parse_vevents(resp.text)

        # Deduplicate by source_id (recurring events may have multiple occurrences)
        seen = set()
        unique = []
        for e in events:
            if e["source_id"] not in seen:
                seen.add(e["source_id"])
                unique.append(e)

        print(f"  [nowplayingutah] {len(unique)} future Utah Valley events")
        return unique
