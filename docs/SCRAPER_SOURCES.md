# Scraper Sources — Utah Valley

## Active Sources

| Source | URL | Type | Categories | Priority |
|--------|-----|------|-----------|----------|
| Eventbrite | eventbrite.com/d/ | HTML scrape (JSON-LD) | All | High |
| Explore Utah Valley | utahvalley.com/events | HTML scrape | Tourism, festivals | High |
| NowPlayingUtah | nowplayingutah.com | HTML scrape | Performing arts, music | High |
| Provo City | provo.gov/572/Community-Events | HTML scrape | Community, city events | Medium |
| Orem City | orem.org/events | HTML scrape | Community, city events | Medium |
| BYU Events | calendar.byu.edu | HTML/iCal | Campus, sports, arts | High |
| UVU Events | uvu.edu/events | HTML scrape | Campus, arts | Medium |
| UCCU Center | uccucenter.com/events | HTML scrape | Concerts, shows | Medium |
| SCERA Center | scera.org | HTML scrape | Arts, theater, family | Medium |
| Thanksgiving Point | thanksgivingpoint.org | HTML scrape | Family, gardens, museum | Medium |
| Utah Agenda | utahagenda.com | HTML scrape | Mixed (SLC-heavy, filter to UV) | Low |

## Planned Sources (v2)

| Source | URL | Type | Notes |
|--------|-----|------|-------|
| Meetup API | api.meetup.com | REST API | Tech, hobby groups |
| Facebook Public Events | graph.facebook.com | API (limited) | May need manual curation |
| Lehi City | lehi-ut.gov | HTML scrape | City events |
| Spanish Fork City | spanishfork.org | HTML scrape | City events, rodeo |
| American Fork City | afcity.net | HTML scrape | City events |

## Scraper Design

Each scraper follows this pattern:

```python
# services/scrapers/src/scrape_example.py

async def scrape() -> list[dict]:
    """
    Returns a list of normalized event dicts:
    {
        "source": "example",
        "source_id": "unique-id-from-source",
        "source_url": "https://...",
        "title": "Event Title",
        "description": "...",
        "venue_name": "Venue Name",
        "city": "Provo",
        "category": "music",
        "tags": ["free", "family"],
        "price": "Free",
        "price_cents_min": 0,
        "start_time": "2026-04-01T19:00:00-06:00",
        "end_time": "2026-04-01T21:00:00-06:00",
        "lat": 40.2338,
        "lng": -111.6585,
        "image_url": "https://..."
    }
    """
    pass
```

## Scheduling

- **High priority sources:** Every 4 hours via GitHub Actions cron
- **Medium priority sources:** Every 12 hours
- **Low priority sources:** Once daily
- **Cleanup job:** Nightly — mark events with `end_time < now()` as `status = 'expired'`

## Rate Limiting & Politeness

- Respect robots.txt for all HTML scrape targets
- 2-second delay between requests to the same domain
- Cache ETags / Last-Modified headers where supported
- Eventbrite API: use official API with key, respect rate limits (2000 req/hr)
