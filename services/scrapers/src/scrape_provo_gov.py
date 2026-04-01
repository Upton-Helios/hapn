"""
Scraper: Provo City Community Events (provo.gov)
Scrapes the Community Events page for both provo.gov calendar events
and Covey Center performing arts events.
"""

import asyncio
import hashlib
import re
from datetime import datetime, timezone, timedelta
from urllib.parse import urljoin
import httpx
from bs4 import BeautifulSoup

BASE_URL = "https://www.provo.gov"
COMMUNITY_URL = f"{BASE_URL}/572/Community-Events"
CALENDAR_URL = f"{BASE_URL}/Calendar.aspx"

# Covey Center location
COVEY_CENTER = {
    "venue_name": "Covey Center for the Arts",
    "address": "425 W Center St, Provo, UT 84601",
    "lat": 40.2338,
    "lng": -111.6587,
}

# Provo city center fallback
PROVO_DEFAULT = {"lat": 40.2338, "lng": -111.6585}

MT = timezone(timedelta(hours=-6))

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml",
}

# Month abbreviation map for "Apr." -> 4
MONTH_ABBR = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}


def _parse_listing_date(date_text: str, year: int = None) -> tuple[str | None, str | None]:
    """Parse dates like 'Fri, Apr. 3' or 'Tue, Apr. 7 - Wed, Apr. 8'.

    Returns (start_date, end_date) as 'YYYY-MM-DD' strings.
    """
    if not year:
        year = datetime.now(MT).year

    date_text = date_text.strip()

    # Multi-day: "Tue, Apr. 7 - Wed, Apr. 8"
    if " - " in date_text:
        parts = date_text.split(" - ")
        start = _parse_single_date(parts[0].strip(), year)
        end = _parse_single_date(parts[1].strip(), year)
        return start, end

    return _parse_single_date(date_text, year), None


def _parse_single_date(text: str, year: int) -> str | None:
    """Parse 'Fri, Apr. 3' or 'Apr. 3' to 'YYYY-MM-DD'."""
    # Remove day-of-week prefix
    if "," in text:
        text = text.split(",", 1)[1].strip()

    # Match "Apr. 3" or "April 3"
    m = re.match(r"(\w+)\.?\s+(\d+)", text)
    if not m:
        return None

    month_str = m.group(1).lower()[:3]
    day = int(m.group(2))
    month = MONTH_ABBR.get(month_str)
    if not month:
        return None

    return f"{year}-{month:02d}-{day:02d}"


def _extract_detail_field(soup: BeautifulSoup, label: str) -> str | None:
    """Extract a field value from specificDetail divs on provo.gov event pages.

    Structure: <div class="specificDetail">
                 <div class="specificDetailHeader">Location:</div>
                 <div class="specificDetailItem">Recreation Center</div>
               </div>
    """
    for detail in soup.find_all("div", class_="specificDetail"):
        header = detail.find("div", class_="specificDetailHeader")
        item = detail.find("div", class_="specificDetailItem")
        if header and item:
            header_text = header.get_text(strip=True).rstrip(":")
            if header_text.lower() == label.lower():
                return item.get_text(separator=" ", strip=True) or None
    return None


def _parse_detail_datetime(soup: BeautifulSoup) -> tuple[str | None, str | None]:
    """Extract start/end datetime from a provo.gov event detail page.

    The date h3 contains "Saturday, April 25, 2026" and the Time specificDetail
    contains "5:00 PM - 7:00 PM". A hidden datetime attribute may also be present.
    """
    # Try the Date specificDetail field first (contains "April 25, 2026")
    date_str = _extract_detail_field(soup, "Date")
    time_str = _extract_detail_field(soup, "Time")

    if not date_str:
        # Fallback: look for h3 with date text like "Saturday, April 25, 2026"
        for h3 in soup.find_all("h3"):
            text = h3.get_text(strip=True)
            if re.search(r"\w+\s+\d{1,2},\s+\d{4}", text):
                # Remove day-of-week prefix
                date_str = re.sub(r"^\w+,\s*", "", text)
                break

    if not date_str:
        return None, None

    # Clean non-breaking spaces
    date_str = date_str.replace("\xa0", " ").strip()

    # Parse the date: "April 25, 2026"
    try:
        date_obj = datetime.strptime(date_str, "%B %d, %Y")
    except ValueError:
        return None, None

    # Parse start time from Time field: "5:00 PM - 7:00 PM" (may use thin spaces)
    start_hour, start_min = 12, 0  # default noon
    end_iso = None

    if time_str:
        # Normalize thin/non-breaking spaces
        time_str = time_str.replace("\u2009", " ").replace("\xa0", " ")
        # Match time range
        time_match = re.search(
            r"(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)",
            time_str, re.IGNORECASE,
        )
        if time_match:
            start_time_str = time_match.group(1).strip()
            end_time_str = time_match.group(2).strip()
            try:
                st = datetime.strptime(start_time_str, "%I:%M %p")
                start_hour, start_min = st.hour, st.minute
            except ValueError:
                pass
            try:
                et = datetime.strptime(end_time_str, "%I:%M %p")
                end_dt = date_obj.replace(hour=et.hour, minute=et.minute)
                end_utc = end_dt.replace(tzinfo=MT).astimezone(timezone.utc)
                end_iso = end_utc.strftime("%Y-%m-%dT%H:%M:%SZ")
            except ValueError:
                pass
        else:
            # Single time like "5:00 PM"
            single = re.search(r"(\d{1,2}:\d{2}\s*[AP]M)", time_str, re.IGNORECASE)
            if single:
                try:
                    st = datetime.strptime(single.group(1).strip(), "%I:%M %p")
                    start_hour, start_min = st.hour, st.minute
                except ValueError:
                    pass

    start_dt = date_obj.replace(hour=start_hour, minute=start_min)
    start_utc = start_dt.replace(tzinfo=MT).astimezone(timezone.utc)
    start_iso = start_utc.strftime("%Y-%m-%dT%H:%M:%SZ")

    return start_iso, end_iso


async def _scrape_event_detail(client: httpx.AsyncClient, eid: int) -> dict | None:
    """Fetch and parse a single provo.gov calendar event page."""
    url = f"{CALENDAR_URL}?EID={eid}"
    try:
        resp = await client.get(url, headers=HEADERS, follow_redirects=True)
        if resp.status_code != 200:
            return None
    except httpx.HTTPError:
        return None

    soup = BeautifulSoup(resp.text, "html.parser")

    # Title: find h2 after "Event Details" h2
    title = None
    found_details = False
    for h2 in soup.find_all("h2"):
        text = h2.get_text(strip=True)
        if text == "Event Details":
            found_details = True
            continue
        if found_details and text and text != "Event Details":
            title = text
            break

    # Fallback: og:title
    if not title:
        og_title = soup.find("meta", property="og:title")
        if og_title:
            title = og_title.get("content", "").strip()

    if not title:
        return None

    start_time, end_time = _parse_detail_datetime(soup)
    if not start_time:
        return None

    # Skip past events
    now = datetime.now(timezone.utc)
    check = end_time or start_time
    try:
        dt = datetime.fromisoformat(check.replace("Z", "+00:00"))
        if dt < now:
            return None
    except (ValueError, TypeError):
        pass

    # Location and address from specificDetail divs
    venue_raw = _extract_detail_field(soup, "Location") or "Provo"
    # Strip "View Facility" prefix that appears in some entries
    venue = re.sub(r"^View\s+Facility\s*", "", venue_raw).strip() or "Provo"
    # Strip embedded address after " - " (e.g. "Fire Station #2 - 2737 North Canyon Road, Provo")
    if " - " in venue:
        venue = venue.split(" - ")[0].strip()
    address = _extract_detail_field(soup, "Address")
    if address:
        # Clean up spacing: "320 W 500 N Provo , UT 84601" -> "320 W 500 N, Provo, UT 84601"
        address = re.sub(r"\s*,\s*", ", ", address)
        address = re.sub(r"\s{2,}", " ", address)
    elif "provo" not in venue.lower():
        address = f"{venue}, Provo, UT"

    # Cost
    cost_text = _extract_detail_field(soup, "Cost")
    price = cost_text if cost_text else None
    price_cents = 0 if (price and "free" in price.lower()) else None

    # Description from fr-view divs (skip the one with Location/Address)
    description = ""
    for fr in soup.find_all("div", class_="fr-view"):
        text = fr.get_text(separator=" ", strip=True)
        if text and not text.startswith("Location:") and text != "Loading":
            description = text
            break

    # Image from og:image meta tag
    image_url = None
    og_image = soup.find("meta", property="og:image")
    if og_image:
        img_src = og_image.get("content", "")
        if img_src and "documentID" in img_src:
            image_url = img_src

    return {
        "source": "provo_gov",
        "source_id": f"provo-eid-{eid}",
        "source_url": url,
        "title": title,
        "description": description[:2000] if description else "",
        "venue_name": venue,
        "address": address,
        "city": "Provo",
        "category": "community",
        "tags": ["community"],
        "price": price,
        "price_cents_min": price_cents,
        "start_time": start_time,
        "end_time": end_time,
        "lat": PROVO_DEFAULT["lat"],
        "lng": PROVO_DEFAULT["lng"],
        "image_url": image_url,
        "status": "active",
    }


def _parse_community_listing(soup: BeautifulSoup) -> list[dict]:
    """Parse the Community Events page for event listings.

    Returns basic event info for Covey Center and other linked events.
    """
    events = []
    now = datetime.now(timezone.utc)

    # Find the ordered list of events
    for li in soup.find_all("li"):
        h4 = li.find("h4")
        link = li.find("a", href=True)
        if not h4 or not link:
            continue

        title = link.get_text(strip=True)
        href = link["href"]
        date_text = h4.get_text(strip=True)

        if not title or not date_text:
            continue

        # Skip provo.gov EID links — we scrape those separately with full detail
        if "EID=" in href:
            continue

        # Only process external event links (Covey Center, etc.)
        if not href.startswith("http"):
            continue

        start_date, end_date = _parse_listing_date(date_text)
        if not start_date:
            continue

        # Default to 7 PM for performing arts events
        try:
            start_dt = datetime.strptime(f"{start_date} 19:00", "%Y-%m-%d %H:%M")
            start_utc = start_dt.replace(tzinfo=MT).astimezone(timezone.utc)
            start_iso = start_utc.strftime("%Y-%m-%dT%H:%M:%SZ")
        except ValueError:
            continue

        end_iso = None
        if end_date:
            try:
                end_dt = datetime.strptime(f"{end_date} 21:00", "%Y-%m-%d %H:%M")
                end_utc = end_dt.replace(tzinfo=MT).astimezone(timezone.utc)
                end_iso = end_utc.strftime("%Y-%m-%dT%H:%M:%SZ")
            except ValueError:
                pass

        # Skip past events
        check_iso = end_iso or start_iso
        try:
            dt = datetime.fromisoformat(check_iso.replace("Z", "+00:00"))
            if dt < now:
                continue
        except (ValueError, TypeError):
            pass

        # Determine if Covey Center
        is_covey = "covey.provo.gov" in href

        source_id = f"provo-{hashlib.md5((title + start_date).encode()).hexdigest()[:12]}"

        events.append({
            "source": "provo_gov",
            "source_id": source_id,
            "source_url": href,
            "title": title,
            "description": "",
            "venue_name": COVEY_CENTER["venue_name"] if is_covey else "Provo",
            "address": COVEY_CENTER["address"] if is_covey else "Provo, UT",
            "city": "Provo",
            "category": "arts" if is_covey else "community",
            "tags": ["arts", "performing arts"] if is_covey else ["community"],
            "price": None,
            "price_cents_min": None,
            "start_time": start_iso,
            "end_time": end_iso,
            "lat": COVEY_CENTER["lat"] if is_covey else PROVO_DEFAULT["lat"],
            "lng": COVEY_CENTER["lng"] if is_covey else PROVO_DEFAULT["lng"],
            "image_url": None,
            "status": "active",
        })

    return events


async def scrape() -> list[dict]:
    events = []
    eid_list = []

    async with httpx.AsyncClient(timeout=30) as client:
        # 1. Fetch the Community Events listing page
        try:
            resp = await client.get(COMMUNITY_URL, headers=HEADERS, follow_redirects=True)
            if resp.status_code != 200:
                print(f"  [provo_gov] community page HTTP {resp.status_code}")
                return []
        except httpx.HTTPError as e:
            print(f"  [provo_gov] fetch error: {e}")
            return []

        soup = BeautifulSoup(resp.text, "html.parser")

        # Extract EID links from the page
        for link in soup.find_all("a", href=True):
            m = re.search(r"EID=(\d+)", link["href"])
            if m:
                eid_list.append(int(m.group(1)))

        # Parse Covey Center and other external events from listing
        listing_events = _parse_community_listing(soup)
        events.extend(listing_events)
        print(f"  [provo_gov] listing: {len(listing_events)} external events (Covey Center, etc.)")

        # 2. Also check the calendar page for more EIDs
        cal_url = f"{CALENDAR_URL}?view=list&year={datetime.now(MT).year}&month={datetime.now(MT).month}&day=1&CID=14,44,24,38,41,27"
        try:
            resp2 = await client.get(cal_url, headers=HEADERS, follow_redirects=True)
            if resp2.status_code == 200:
                cal_soup = BeautifulSoup(resp2.text, "html.parser")
                for link in cal_soup.find_all("a", href=True):
                    m = re.search(r"EID=(\d+)", link["href"])
                    if m:
                        eid_list.append(int(m.group(1)))
        except httpx.HTTPError:
            pass

        # Check next month too
        next_month = datetime.now(MT).month % 12 + 1
        next_year = datetime.now(MT).year + (1 if next_month == 1 else 0)
        cal_url2 = f"{CALENDAR_URL}?view=list&year={next_year}&month={next_month}&day=1&CID=14,44,24,38,41,27"
        try:
            resp3 = await client.get(cal_url2, headers=HEADERS, follow_redirects=True)
            if resp3.status_code == 200:
                cal_soup2 = BeautifulSoup(resp3.text, "html.parser")
                for link in cal_soup2.find_all("a", href=True):
                    m = re.search(r"EID=(\d+)", link["href"])
                    if m:
                        eid_list.append(int(m.group(1)))
        except httpx.HTTPError:
            pass

        # Deduplicate EIDs
        eid_list = list(set(eid_list))
        print(f"  [provo_gov] found {len(eid_list)} unique calendar event IDs")

        # 3. Fetch detail pages for each EID
        for eid in eid_list:
            detail = await _scrape_event_detail(client, eid)
            if detail:
                events.append(detail)
            await asyncio.sleep(0.5)

        print(f"  [provo_gov] {len([e for e in events if 'eid' in e['source_id']])} calendar events with details")

    # Deduplicate by source_id
    seen = set()
    unique = []
    for e in events:
        if e["source_id"] not in seen:
            seen.add(e["source_id"])
            unique.append(e)

    print(f"  [provo_gov] total: {len(unique)} events")
    return unique
