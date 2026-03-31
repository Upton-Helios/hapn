"""
Scraper: Eventbrite
Fetches public events in Utah Valley via the Eventbrite API.
"""

import os
import httpx
from datetime import datetime, timezone

API_KEY = os.getenv("EVENTBRITE_API_KEY")
BASE_URL = "https://www.eventbriteapi.com/v3"

# Utah Valley bounding box (approximate)
LOCATION = {
    "latitude": "40.2338",
    "longitude": "-111.6585",
    "within": "25mi",  # covers Lehi to Spanish Fork
}

CATEGORY_MAP = {
    "103": "music",       # Music
    "110": "food",        # Food & Drink
    "108": "sports",      # Sports & Fitness
    "105": "arts",        # Performing & Visual Arts
    "104": "arts",        # Film, Media & Entertainment
    "101": "community",   # Business (mapped to community)
    "102": "community",   # Science & Technology
    "109": "outdoors",    # Travel & Outdoor
    "115": "family",      # Family & Education
    "106": "nightlife",   # Fashion (mapped loosely)
    "113": "community",   # Community & Culture
    "107": "nightlife",   # Health & Wellness → could be outdoors too
}


async def scrape() -> list[dict]:
    if not API_KEY:
        print("  [eventbrite] WARNING: No EVENTBRITE_API_KEY set, skipping")
        return []

    events = []
    headers = {"Authorization": f"Bearer {API_KEY}"}

    async with httpx.AsyncClient(timeout=30) as client:
        params = {
            "location.latitude": LOCATION["latitude"],
            "location.longitude": LOCATION["longitude"],
            "location.within": LOCATION["within"],
            "start_date.range_start": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "expand": "venue",
            "page_size": 50,
        }

        resp = await client.get(f"{BASE_URL}/events/search/", headers=headers, params=params)

        if resp.status_code != 200:
            print(f"Eventbrite API error: {resp.status_code} {resp.text}")
            return []

        data = resp.json()

        for ev in data.get("events", []):
            venue = ev.get("venue", {})
            address = venue.get("address", {})
            lat = address.get("latitude")
            lng = address.get("longitude")

            if not lat or not lng:
                continue

            category_id = ev.get("category_id", "")
            category = CATEGORY_MAP.get(category_id, "community")

            price = "Free" if ev.get("is_free") else None
            price_cents = 0 if ev.get("is_free") else None

            events.append({
                "source": "eventbrite",
                "source_id": f"eb-{ev['id']}",
                "source_url": ev.get("url"),
                "title": ev.get("name", {}).get("text", "Untitled"),
                "description": (ev.get("description", {}).get("text", "") or "")[:500],
                "venue_name": venue.get("name"),
                "city": address.get("city", "Unknown"),
                "category": category,
                "tags": [category],
                "price": price,
                "price_cents_min": price_cents,
                "start_time": ev.get("start", {}).get("utc"),
                "end_time": ev.get("end", {}).get("utc"),
                "lat": float(lat),
                "lng": float(lng),
                "image_url": ev.get("logo", {}).get("url") if ev.get("logo") else None,
                "status": "active",
            })

    return events
