"""
Hapn Scraper Pipeline — Run all active scrapers
Usage: python services/scrapers/src/run_all.py
"""

import asyncio
import importlib
import sys
import os
from datetime import datetime, timezone
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

SCRAPERS = [
    "scrape_eventbrite",
    # "scrape_utahvalley",
    # "scrape_nowplayingutah",
    # "scrape_provo_gov",
    # "scrape_byu",
    # "scrape_uvu",
    # "scrape_uccu",
]


def get_supabase():
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", file=sys.stderr)
        sys.exit(1)
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def upsert_events(supabase, events: list[dict]):
    """Upsert events using source + source_id as the dedup key."""
    if not events:
        return 0

    for event in events:
        # Build PostGIS point from lat/lng
        lat = event.pop("lat", None)
        lng = event.pop("lng", None)
        if lat is not None and lng is not None:
            event["location"] = f"SRID=4326;POINT({lng} {lat})"

    # Upsert via Supabase — relies on the unique index on (source, source_id)
    result = supabase.table("events").upsert(
        events,
        on_conflict="source,source_id"
    ).execute()

    return len(result.data) if result.data else 0


async def run_scraper(name: str) -> list[dict]:
    """Import and run a single scraper module."""
    try:
        module = importlib.import_module(f"src.{name}")
        events = await module.scrape()
        print(f"  [{name}] scraped {len(events)} events")
        return events
    except Exception as e:
        print(f"  [{name}] ERROR: {e}", file=sys.stderr)
        return []


async def main():
    print(f"=== Hapn Scraper Pipeline ===")
    print(f"Started at {datetime.now(timezone.utc).isoformat()}")
    print()

    supabase = get_supabase()
    total = 0

    for scraper_name in SCRAPERS:
        events = await run_scraper(scraper_name)
        if events:
            count = upsert_events(supabase, events)
            total += count

            # Update last_scraped_at for this source
            source_name = scraper_name.replace("scrape_", "")
            supabase.table("event_sources").update({
                "last_scraped_at": datetime.now(timezone.utc).isoformat(),
                "event_count": count
            }).eq("name", source_name).execute()

    print()
    print(f"Done. {total} events upserted.")


if __name__ == "__main__":
    asyncio.run(main())
