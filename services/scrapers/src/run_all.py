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

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

SCRAPERS = [
    "scrape_eventbrite",
    "scrape_utahvalley",
    "scrape_byu",
    # "scrape_nowplayingutah",  # blocked by Cloudflare — needs browser-based solution
    "scrape_provo_gov",
    "scrape_uvu",
    "scrape_uccu",
    "scrape_scera",
    "scrape_visitsaltlake",
]


def get_supabase():
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("WARNING: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", file=sys.stderr)
        print("Skipping database operations. Set secrets in GitHub repo settings.", file=sys.stderr)
        return None
    from supabase import create_client
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def upsert_events(supabase, events: list[dict]):
    """Upsert events using source + source_id as the dedup key.

    The unique index is partial (WHERE source_id IS NOT NULL), so we
    can't use the Supabase client's upsert. Instead, we delete-then-insert
    per source, or insert individually with conflict handling via RPC.
    """
    if not events or supabase is None:
        return 0

    for event in events:
        # Build PostGIS point from lat/lng
        lat = event.pop("lat", None)
        lng = event.pop("lng", None)
        if lat is not None and lng is not None:
            event["location"] = f"SRID=4326;POINT({lng} {lat})"

    # Group by source, delete existing, then bulk insert
    source = events[0]["source"] if events else None
    if source:
        try:
            supabase.table("events").delete().eq("source", source).execute()
        except Exception as e:
            print(f"  [warning] Could not clear old {source} events: {e}")

    result = supabase.table("events").insert(events).execute()
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
    if supabase is None:
        print("No database connection. Exiting gracefully.")
        return

    total = 0

    for scraper_name in SCRAPERS:
        events = await run_scraper(scraper_name)
        if events:
            count = upsert_events(supabase, events)
            total += count

            # Update last_scraped_at for this source
            source_name = scraper_name.replace("scrape_", "")
            try:
                supabase.table("event_sources").update({
                    "last_scraped_at": datetime.now(timezone.utc).isoformat(),
                    "event_count": count
                }).eq("name", source_name).execute()
            except Exception as e:
                print(f"  [warning] Could not update event_sources for {source_name}: {e}")

    print()
    print(f"Done. {total} events upserted.")


if __name__ == "__main__":
    asyncio.run(main())
