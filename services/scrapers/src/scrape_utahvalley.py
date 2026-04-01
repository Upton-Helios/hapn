"""
Scraper: Explore Utah Valley (utahvalley.com)
1. Fetches event URLs from the sitemap.
2. Scrapes each event page for JSON-LD + inline JS for accurate datetimes.
"""

import asyncio
import html as html_mod
import json
import re
from datetime import datetime, timezone, timedelta
import httpx

SITEMAP_URL = "https://www.utahvalley.com/sitemap.xml"
EVENT_URL_PATTERN = re.compile(r"<loc>(https://www\.utahvalley\.com/event/[^<]+)</loc>")

# Mountain Time offset (UTC-7 for MDT, UTC-6 for MST)
# Utah Valley events are in Mountain Time; use -6 as a reasonable default
MT_OFFSET = timezone(timedelta(hours=-6))

# Venues scraped by dedicated scrapers — skip to avoid cross-source duplicates
SKIP_VENUES = {
    "uccu center", "uccu events center",
    "scera center for the arts", "scera shell outdoor theatre",
    "scera center", "scera park",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/html",
}

# Category mapping from keywords in title/description
KEYWORD_CATEGORY_MAP = {
    "music": "music", "concert": "music", "live band": "music", "symphony": "music",
    "jazz": "music", "choir": "music", "sing": "music", "tribute": "music",
    "food": "food", "drink": "food", "tasting": "food", "brunch": "food",
    "farmer": "food", "culinary": "food", "dining": "food",
    "sport": "sports", "fitness": "sports", "run ": "sports", "race": "sports",
    "marathon": "sports", "triathlon": "sports", "5k": "sports", "10k": "sports",
    "hike": "outdoors", "outdoor": "outdoors", "trail": "outdoors",
    "lake": "outdoors", "mountain": "outdoors", "garden": "outdoors",
    "art": "arts", "theater": "arts", "theatre": "arts", "dance": "arts",
    "gallery": "arts", "exhibit": "arts", "paint": "arts", "pottery": "arts",
    "stroll": "arts", "film": "arts", "opera": "arts",
    "family": "family", "kid": "family", "children": "family", "easter": "family",
    "egg hunt": "family", "tulip": "family",
    "night": "nightlife", "club": "nightlife", "party": "nightlife",
    "festival": "community", "parade": "community", "patriotic": "community",
    "volunteer": "community", "fair": "community", "rodeo": "community",
}


def _guess_category(title: str, description: str = "") -> str:
    text = f"{title} {description}".lower()
    for keyword, cat in KEYWORD_CATEGORY_MAP.items():
        if keyword in text:
            return cat
    return "community"


def _parse_js_datetime(raw: str) -> str | None:
    """Parse 'Saturday, June 6, 2026 10:00 AM' into ISO 8601 UTC string."""
    # Remove day-of-week prefix
    cleaned = re.sub(r"^\w+,\s*", "", raw.strip())
    for fmt in ("%B %d, %Y %I:%M %p", "%B %d, %Y"):
        try:
            local_dt = datetime.strptime(cleaned, fmt)
            utc_dt = local_dt.replace(tzinfo=MT_OFFSET).astimezone(timezone.utc)
            return utc_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        except ValueError:
            continue
    return None


async def _fetch_event_urls(client: httpx.AsyncClient) -> list[str]:
    """Fetch the sitemap and extract event page URLs."""
    try:
        resp = await client.get(SITEMAP_URL, headers=HEADERS, follow_redirects=True)
        if resp.status_code != 200:
            print(f"  [utahvalley] sitemap returned HTTP {resp.status_code}")
            return []
    except httpx.HTTPError as e:
        print(f"  [utahvalley] sitemap fetch error: {e}")
        return []

    urls = EVENT_URL_PATTERN.findall(resp.text)
    print(f"  [utahvalley] found {len(urls)} event URLs in sitemap")
    return urls


async def _scrape_event_page(client: httpx.AsyncClient, url: str) -> dict | None:
    """Fetch a single event page and extract JSON-LD + JS datetime data."""
    try:
        resp = await client.get(url, headers=HEADERS, follow_redirects=True)
    except httpx.HTTPError:
        return None

    if resp.status_code != 200:
        return None

    html = resp.text

    # Extract JSON-LD
    ld_match = re.search(
        r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>',
        html, re.DOTALL,
    )
    if not ld_match:
        return None

    try:
        data = json.loads(ld_match.group(1))
    except json.JSONDecodeError:
        return None

    if data.get("@type") != "Event":
        return None

    # Location and geo
    location = data.get("location") or {}
    geo = location.get("geo") or {}
    lat = geo.get("latitude")
    lng = geo.get("longitude")
    if not lat or not lng:
        return None

    address_obj = location.get("address") or {}
    city = address_obj.get("addressLocality", "Unknown")

    # Build full street address
    street = address_obj.get("streetAddress", "")
    region = address_obj.get("addressRegion", "")
    postal = address_obj.get("postalCode", "")
    address_parts = [p for p in [street, city, region, postal] if p]
    full_address = ", ".join(address_parts) if address_parts else None

    title = data.get("name", "Untitled")

    # Prefer og:description (full text) over JSON-LD (truncated)
    og_match = re.search(
        r'<meta[^>]*property="og:description"[^>]*content="([^"]+)"', html,
    )
    if og_match:
        raw_desc = html_mod.unescape(og_match.group(1))
        # Strip NowPlayingUtah boilerplate
        raw_desc = re.sub(
            r"This calendar listing is brought to you by NowPlayingUtah\.com.*$",
            "", raw_desc, flags=re.IGNORECASE,
        ).strip()
        description = raw_desc
    else:
        description = (data.get("description", "") or "")

    # Extract accurate datetimes from inline JS: var startDate = "..."; var endDate = "...";
    start_match = re.search(r'var\s+startDate\s*=\s*"([^"]+)"', html)
    end_match = re.search(r'var\s+endDate\s*=\s*"([^"]+)"', html)

    start_time = None
    end_time = None

    if start_match:
        start_time = _parse_js_datetime(start_match.group(1))
    if end_match:
        end_time = _parse_js_datetime(end_match.group(1))

    # Fallback to JSON-LD date-only if JS extraction failed
    if not start_time:
        start_time = data.get("startDate")
    if not end_time:
        end_time = data.get("endDate")

    # Filter out past events (end_time or start_time before today)
    now = datetime.now(timezone.utc)
    check_time = end_time or start_time
    if check_time:
        try:
            if "T" in check_time:
                event_dt = datetime.fromisoformat(check_time.replace("Z", "+00:00"))
            else:
                event_dt = datetime.strptime(check_time, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            if event_dt < now:
                return None
        except (ValueError, TypeError):
            pass

    # Image
    image = data.get("image")
    image_url = None
    if isinstance(image, str):
        image_url = image
    elif isinstance(image, list) and image:
        image_url = image[0]
    elif isinstance(image, dict):
        image_url = image.get("url")

    # Extract source_id from URL (the numeric ID at the end)
    id_match = re.search(r"/(\d+)/?$", url)
    source_id = f"uv-{id_match.group(1)}" if id_match else f"uv-{hash(url)}"

    category = _guess_category(title, description)

    return {
        "source": "utahvalley",
        "source_id": source_id,
        "source_url": url,
        "title": title,
        "description": description,
        "venue_name": location.get("name"),
        "address": full_address,
        "city": city,
        "category": category,
        "tags": [category],
        "price": None,
        "price_cents_min": None,
        "start_time": start_time,
        "end_time": end_time,
        "lat": float(lat),
        "lng": float(lng),
        "image_url": image_url,
        "status": "active",
    }


async def scrape() -> list[dict]:
    events = []

    async with httpx.AsyncClient(timeout=30) as client:
        urls = await _fetch_event_urls(client)
        if not urls:
            print("  [utahvalley] no event URLs found")
            return []

        print(f"  [utahvalley] scraping {len(urls)} event pages...")

        batch_size = 5
        for i in range(0, len(urls), batch_size):
            batch = urls[i:i + batch_size]
            tasks = [_scrape_event_page(client, url) for url in batch]
            results = await asyncio.gather(*tasks)
            for result in results:
                if result:
                    venue = (result.get("venue_name") or "").lower().strip()
                    if venue in SKIP_VENUES:
                        continue
                    events.append(result)
            # Respect crawl-delay: 2
            await asyncio.sleep(2)

        print(f"  [utahvalley] scraped {len(events)} future events")

    return events
