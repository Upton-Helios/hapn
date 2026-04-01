# Scraper Sources — Statewide Utah

Hapn aggregates events from across the entire state of Utah using a mix of API-based and HTML scrapers. Sources are organized into three tiers: statewide, regional, and local.

## Statewide Sources

| Source | File | URL | Type | Coverage | Events |
|--------|------|-----|------|----------|--------|
| Eventbrite | `scrape_eventbrite.py` | eventbrite.com | HTML + API | All of Utah (5 geo centers at 75mi radius) | ~300 |
| Visit Salt Lake | `scrape_visitsaltlake.py` | visitsaltlake.com/events | Simpleview CMS REST API | Salt Lake metro + statewide tourism events | ~1,300 |

## Regional Sources

| Source | File | URL | Type | Coverage | Events |
|--------|------|-----|------|----------|--------|
| Explore Utah Valley | `scrape_utahvalley.py` | utahvalley.com/events | HTML scrape | Utah County (Provo, Orem, Lehi, etc.) | ~180 |
| Visit Park City | `scrape_visitparkcity.py` | visitparkcity.com/events | Simpleview CMS REST API | Park City, Heber City, Summit County | ~100 |
| Visit St. George | `scrape_visitstgeorge.py` | events.greaterzion.com | WordPress TEC REST API | St. George, Hurricane, Ivins, Washington County | ~70 |

## Local / Venue Sources

| Source | File | URL | Type | Coverage | Events |
|--------|------|-----|------|----------|--------|
| BYU Events | `scrape_byu.py` | calendar.byu.edu | HTML scrape | BYU campus (Provo) | ~70 |
| UVU Events | `scrape_uvu.py` | uvu.edu/events | HTML scrape | UVU campus (Orem) | ~12 |
| UCCU Center | `scrape_uccu.py` | uccucenter.com/events | HTML scrape | UCCU Center venue (Orem) | ~2 |
| SCERA Center | `scrape_scera.py` | scera.org | HTML scrape | SCERA venue (Orem) | ~30 |
| Provo City | `scrape_provo.py` | provo.gov | HTML scrape | Provo city events | ~10 |
| NowPlayingUtah | `scrape_nowplayingutah.py` | nowplayingutah.com | HTML scrape | Performing arts statewide | ~2 |

## Planned Sources (v2)

| Source | URL | Type | Notes |
|--------|-----|------|-------|
| Meetup API | api.meetup.com | REST API | Tech, hobby groups |
| Thanksgiving Point | thanksgivingpoint.org | HTML scrape | Family, gardens, museum |
| Visit Ogden | visitogden.com | TBD | Weber County events |
| Visit Logan | explorelogan.com | TBD | Cache Valley events |
| Spanish Fork City | spanishfork.org | HTML scrape | City events, rodeo |
| Lehi City | lehi-ut.gov | HTML scrape | City events |

## Scraper Design

Each scraper follows this pattern:

```python
# services/scrapers/src/scrape_<source>.py

async def scrape() -> list[dict]:
    """
    Returns a list of normalized event dicts:
    {
        "source": "source_name",
        "source_id": "unique-id-from-source",
        "source_url": "https://...",
        "title": "Event Title",
        "description": "...",
        "venue_name": "Venue Name",
        "address": "123 Main St, City, UT 84601",
        "city": "Provo",
        "category": "music",
        "tags": ["music", "community"],
        "price": "Free",
        "price_cents_min": 0,
        "start_time": "2026-04-01T19:00:00-06:00",
        "end_time": "2026-04-01T21:00:00-06:00",
        "lat": 40.2338,
        "lng": -111.6585,
        "image_url": "https://...",
        "status": "active"
    }
    """
    pass
```

### API Patterns Used

**Simpleview CMS** (Visit Salt Lake, Visit Park City):
- Endpoint: `GET /includes/rest_v2/plugins_events_events_by_date/find/?json={query}&token={token}`
- Dates must be at midnight in the client's timezone (UTC-6 for Mountain)
- Requires `fields` projection to avoid maxSize errors on large result sets
- Response shape: `{ docs: { count: N, docs: [...] } }`

**WordPress + The Events Calendar** (Visit St. George / Greater Zion):
- Endpoint: `GET /wp-json/tribe/events/v1/events?per_page=50&start_date=YYYY-MM-DD&page=N`
- No authentication required
- Returns 404 when page exceeds total_pages
- Response shape: `{ events: [...], total: N, total_pages: N }`

**Eventbrite** (statewide):
- Dual discovery: slug-based city search + geo-radius HTML search from 5 centers
- API enrichment for full event details after ID discovery
- Utah bounding box filter (lat 36.9-42.1, lng -109.0 to -114.1)

## Scheduling

All scrapers run weekly on Sundays at 6:00 AM UTC via GitHub Actions (`.github/workflows/scrape.yml`).

- **Orchestrator:** `run_all.py` runs all scrapers sequentially
- **Upsert strategy:** `ON CONFLICT (source, source_id) WHERE source_id IS NOT NULL DO UPDATE`
- **Cleanup job:** Mark events with `end_time < now()` as `status = 'expired'`

## Rate Limiting & Politeness

- 1-2 second delay between paginated requests
- Respect robots.txt for all HTML scrape targets
- Cache ETags / Last-Modified headers where supported
- Eventbrite: respect rate limits (2000 req/hr)
- Simpleview APIs: use field projections to minimize response size
