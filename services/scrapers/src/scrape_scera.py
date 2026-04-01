"""
Scraper: SCERA Center (scera.org)
Scrapes shows, concerts, movies, and special events from SCERA.
Skips education/classes (dance, pottery, camps, lessons, etc.).
"""

import asyncio
import hashlib
import re
from datetime import datetime, timezone, timedelta
import httpx
from bs4 import BeautifulSoup

BASE_URL = "https://scera.org"
EVENTS_URL = f"{BASE_URL}/events/"
MOVIES_URL = f"{BASE_URL}/movies/"

SCERA_LAT = 40.2840
SCERA_LNG = -111.6946

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/html",
}

# URL slug patterns that indicate education/classes — skip these
SKIP_PATTERNS = [
    r"adult-ballet", r"adult-hip-hop", r"adult-jazz", r"adult-tap",
    r"adult-oil-painting", r"adult-watercolor", r"adult-stained-glass",
    r"adult-wheel-pottery", r"adult-illustration", r"adult-ballroom",
    r"youth-ballet", r"youth-hip-hop", r"youth-tap", r"youth-broadway",
    r"youth-tumbling", r"youth-anime", r"youth-character", r"youth-collage",
    r"youth-comic", r"youth-fantasy", r"youth-illustration", r"youth-jewelry",
    r"youth-miniature", r"youth-oil-painting", r"youth-watercolor",
    r"youth-3d-art", r"youth-wheel",
    r"junior-ballet", r"junior-broadway", r"junior-tumbling",
    r"teen-ballet", r"teen-hip-hop", r"teen-tap",
    r"beginning-youth-wheel", r"intermediate-youth-wheel",
    r"dance-technique-ages", r"creative-movement",
    r"private-voice-lessons", r"private-dance-lessons",
    r"art-camp", r"camp-scera", r"boot-camp",
    r"pottery-art-in-action", r"tiny-wheel-pottery", r"sceramics",
    r"mixed-media", r"people-proportions", r"art-around-the-world",
    r"bricks-and-minifigs", r"clay-crazy",
    r"musical-theatre-\d+", r"auditioning-for-musical",
    r"lets-sing", r"play-ukulele",
    r"summer-musical-workshop",
    r"magic-explorers-",
    r"lights-camera-acting",
    r"paint-the-night",
    r"scera-chamber-singers",
]


def _is_class(slug: str) -> bool:
    """Return True if the URL slug looks like an education class."""
    for pat in SKIP_PATTERNS:
        if re.search(pat, slug):
            return True
    return False


def _stable_id(text: str) -> str:
    return hashlib.md5(text.encode()).hexdigest()[:12]


def _parse_date_range(text: str) -> tuple[str | None, str | None]:
    """Parse date strings like 'April 10 - May 02, 2026' or 'May 04, 2026'.
    Returns (start_date, end_date) as YYYY-MM-DD strings."""
    text = text.strip()
    if not text:
        return None, None

    # Range: "April 10 - May 02, 2026"
    m = re.match(
        r"(\w+ \d{1,2})\s*[-–]\s*(\w+ \d{1,2},?\s*\d{4})",
        text,
    )
    if m:
        end_str = m.group(2).strip()
        try:
            end_dt = datetime.strptime(end_str, "%B %d, %Y")
        except ValueError:
            try:
                end_dt = datetime.strptime(end_str, "%B %d %Y")
            except ValueError:
                return None, None
        year = end_dt.year
        start_raw = m.group(1).strip() + f", {year}"
        try:
            start_dt = datetime.strptime(start_raw, "%B %d, %Y")
        except ValueError:
            return None, None
        return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")

    # Single date: "May 04, 2026" or "August 24, 2026"
    for fmt in ("%B %d, %Y", "%B %d %Y"):
        try:
            dt = datetime.strptime(text, fmt)
            return dt.strftime("%Y-%m-%d"), dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    return None, None


def _parse_time(text: str) -> str | None:
    """Parse time like '7:30pm' or '8 PM' into HH:MM."""
    text = text.strip().upper().replace(".", "")
    for fmt in ("%I:%M%p", "%I:%M %p", "%I%p", "%I %p"):
        try:
            return datetime.strptime(text, fmt).strftime("%H:%M")
        except ValueError:
            continue
    return None


def _extract_first_time(text: str) -> str | None:
    """Extract the first time from a times string like 'Mondays @ 7:30pm'."""
    m = re.search(r"(\d{1,2}(?::\d{2})?\s*[ap]m)", text, re.I)
    if m:
        return _parse_time(m.group(1))
    return None


def _guess_category(title: str, url: str, description: str) -> str:
    """Map to hapn category based on title and URL."""
    t = title.lower()
    d = description.lower()

    if "/movies/" in url or "outdoor-movie" in url:
        return "arts"
    if "cinema-classics" in url or "cinema classic" in t:
        return "arts"
    if any(w in t for w in ["concert", "symphony", "orchestra"]):
        return "music"
    if any(w in t for w in ["fireside", "magic of disney"]):
        return "family"
    if any(w in t for w in ["musical", "the musical", "theater", "theatre"]):
        return "arts"
    if any(w in t for w in ["frozen", "matilda"]):
        return "family"
    if "dancing under the stars" in t:
        return "arts"
    # Named artists are likely concerts
    if any(w in url for w in [
        "diamond-rio", "heather-headley", "rachel-platten",
        "lauren-alaina", "simply-queen", "dallyn-vail",
    ]):
        return "music"
    if "chamber-singers" in url:
        return "music"
    if "dance" in t or "dancing" in t:
        return "arts"
    if "family" in d or "children" in d or "kids" in d:
        return "family"

    return "arts"


async def _collect_event_urls(client: httpx.AsyncClient) -> list[str]:
    """Collect all event and movie URLs from the site."""
    urls = set()

    # Paginated event listing
    for page in range(1, 6):
        list_url = EVENTS_URL if page == 1 else f"{EVENTS_URL}page/{page}/"
        try:
            resp = await client.get(list_url, headers=HEADERS, follow_redirects=True)
            if resp.status_code != 200:
                break
            found = re.findall(r'href="(https://scera\.org/events/[^"]+)"', resp.text)
            page_urls = {u for u in found if not u.endswith("/feed/") and "/page/" not in u and u != EVENTS_URL}
            if not page_urls:
                break
            urls.update(page_urls)
            await asyncio.sleep(1)
        except httpx.HTTPError:
            break

    # Movies listing
    try:
        resp = await client.get(MOVIES_URL, headers=HEADERS, follow_redirects=True)
        if resp.status_code == 200:
            found = re.findall(r'href="(https://scera\.org/movies/[^"]+)"', resp.text)
            urls.update(found)
    except httpx.HTTPError:
        pass

    return sorted(urls)


async def _scrape_detail(client: httpx.AsyncClient, url: str) -> dict | None:
    """Scrape a single event/movie detail page."""
    try:
        resp = await client.get(url, headers=HEADERS, follow_redirects=True)
        if resp.status_code != 200:
            return None
    except httpx.HTTPError:
        return None

    soup = BeautifulSoup(resp.text, "html.parser")
    content = soup.select_one("#content")
    if not content:
        return None

    # Title
    h1 = content.select_one("h1")
    if not h1:
        return None
    title = h1.get_text(strip=True)
    # Strip runtime from movie titles like "THE SUPER MARIO GALAXY MOVIE 98 minutes"
    title = re.sub(r"\s*\d+ minutes$", "", title)
    if not title:
        return None

    # Check if past event
    if content.find(string=re.compile(r"THIS EVENT HAS PASSED", re.I)):
        return None

    # Date
    date_div = content.select_one(".event-date")
    date_text = date_div.get_text(strip=True) if date_div else ""
    # Movies may use .movie-date or different format
    if not date_text:
        movie_date = content.select_one(".movie-date")
        if movie_date:
            date_text = movie_date.get_text(strip=True)

    # Strip prefixes like "FALL/WINTER - " or "MONTHLY SESSIONS - "
    date_text = re.sub(r"^[A-Z/\s]+-\s*", "", date_text).strip()
    # Handle "Opening April 1st..." or "Now showing..." for movies
    m_opening = re.search(r"Opening (\w+ \d+)\w*", date_text)
    if m_opening:
        date_text = m_opening.group(1) + ", 2026"
    elif re.search(r"[Nn]ow showing", date_text):
        # Currently showing movie — use today as start date
        date_text = datetime.now().strftime("%B %d, %Y")

    start_date, end_date = _parse_date_range(date_text)

    # Skip if no date or entirely in the past
    now = datetime.now(timezone.utc)
    if end_date:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            if end_dt.date() < now.date():
                return None
        except ValueError:
            pass
    elif start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            if start_dt.date() < now.date():
                return None
        except ValueError:
            pass
    else:
        # No date at all — skip
        return None

    # Description
    short_desc = content.select_one(".short-description")
    long_desc = content.select_one(".long-description")
    description = ""
    if long_desc:
        # Get first paragraph of long description (skip h3)
        paras = long_desc.find_all("p")
        if paras:
            description = paras[0].get_text(strip=True)[:2000]
    if not description and short_desc:
        description = short_desc.get_text(strip=True)[:2000]

    # Image
    image_url = None
    poster = content.select_one("img.poster-image")
    if poster:
        src = poster.get("src", "")
        if src and not src.endswith("ages-list-bg.png"):
            image_url = src if src.startswith("http") else BASE_URL + src

    # Ticket link
    ticket_url = None
    ticket_btn = content.select_one("a.ticket-button")
    if ticket_btn:
        ticket_url = ticket_btn.get("href", "")
        if ticket_url:
            ticket_url = ticket_url.replace("&amp;", "&")

    # Times
    times_div = content.select_one(".times")
    event_time = None
    if times_div:
        times_text = times_div.get_text(" ", strip=True)
        event_time = _extract_first_time(times_text)

    # Prices
    price = None
    prices_div = content.select_one(".prices")
    if prices_div:
        price_text = prices_div.get_text(" ", strip=True)
        m_price = re.search(r"\$(\d+(?:\.\d{2})?)", price_text)
        if m_price:
            price = f"From ${m_price.group(1)}"
    # Check for free admission
    alt_content = content.select_one(".alternative-content")
    if alt_content and "free" in alt_content.get_text(strip=True).lower():
        price = "Free"

    # Location / venue name
    venue_name = "SCERA Center for the Arts"
    loc_div = content.select_one(".location")
    if loc_div:
        loc_text = loc_div.get_text(" ", strip=True)
        loc_text = re.sub(r"Location:\s*", "", loc_text)
        loc_text = re.sub(r"(View Map Location|Get Directions)\s*>>", "", loc_text).strip()
        # Take only the first line (venue name), not embedded address
        loc_text = loc_text.split("\n")[0].strip()
        # Remove trailing address fragments (numbers at start = street address)
        loc_text = re.sub(r"\s*\d+\s+South.*$", "", loc_text).strip()
        if loc_text:
            venue_name = loc_text

    # Build start_time ISO
    start_time_iso = None
    if start_date:
        t = event_time or "19:30"
        start_time_iso = f"{start_date}T{t}:00-06:00"

    end_time_iso = None
    if end_date and end_date != start_date:
        # For multi-day runs (like musicals), end_time is the last performance date
        t = event_time or "19:30"
        end_time_iso = f"{end_date}T{t}:00-06:00"

    category = _guess_category(title, url, description)

    tags = [category]
    if "/movies/" in url or "outdoor-movie" in url:
        tags = ["movie", "family"]
    elif "cinema-classics" in url:
        tags = ["movie", "arts"]
    elif category == "music":
        tags = ["music", "concert"]
    elif "fireside" in url:
        tags = ["family", "music"]

    source_id = f"scera-{_stable_id(url)}"

    return {
        "source": "scera",
        "source_id": source_id,
        "source_url": url,
        "title": title,
        "description": description,
        "venue_name": venue_name,
        "address": "745 S State St, Orem, UT 84058",
        "city": "Orem",
        "category": category,
        "tags": tags,
        "price": price if price else ("Tickets available" if ticket_url else None),
        "price_cents_min": None,
        "start_time": start_time_iso,
        "end_time": end_time_iso,
        "lat": SCERA_LAT,
        "lng": SCERA_LNG,
        "image_url": image_url,
        "ticket_url": ticket_url,
        "status": "active",
    }


async def scrape() -> list[dict]:
    events = []

    async with httpx.AsyncClient(timeout=30) as client:
        all_urls = await _collect_event_urls(client)
        print(f"  [scera] found {len(all_urls)} total event/movie URLs")

        # Filter out classes/education by slug
        show_urls = []
        for url in all_urls:
            slug = url.rstrip("/").split("/")[-1]
            if _is_class(slug):
                continue
            show_urls.append(url)

        print(f"  [scera] {len(show_urls)} after filtering out classes")

        # Scrape detail pages
        for url in show_urls:
            await asyncio.sleep(1)  # polite delay
            result = await _scrape_detail(client, url)
            if result:
                events.append(result)

        print(f"  [scera] {len(events)} upcoming events after scraping details")

    return events
