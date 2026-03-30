# hapn

**What's happening near you.**

A community-sourced local event discovery app for Utah Valley. Aggregates events from public sources and community submissions into a single, clean, mobile-first feed.

## The Problem

Event discovery in Utah Valley is fragmented across dozens of sources — Eventbrite, city .gov calendars, venue websites, Facebook, word of mouth. There's no single place to answer: *"What should I do this weekend?"*

## The Solution

Hapn aggregates events from public sources (Eventbrite, utahvalley.com, BYU/UVU calendars, city event pages, NowPlayingUtah) and lets community members submit local happenings (farmers markets, pickup games, pop-ups, trivia nights). Everything in one scrollable feed, filterable by time, category, and distance.

## Coverage Area

Utah Valley / Utah County: Provo, Orem, Lehi, American Fork, Pleasant Grove, Spanish Fork, Springville, Vineyard, Saratoga Springs, Eagle Mountain, Lindon, Highland, Alpine, Mapleton, Payson, Cedar Hills, and surrounding areas.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native / Expo with Expo Router |
| Backend | Supabase (Postgres + PostGIS) |
| Auth | Supabase Auth (Google, Apple, Email) |
| Maps | Mapbox GL |
| Scrapers | Python (httpx + BeautifulSoup4) |
| Monorepo | Turborepo + pnpm |

## Project Structure

```
hapn/
├── apps/mobile/           # Expo React Native app
├── packages/supabase/     # Database schema, migrations, edge functions
├── services/scrapers/     # Python event ingestion pipeline
├── docs/                  # Architecture and data model docs
└── .github/workflows/     # CI and scraper cron jobs
```

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm 9+
- Python 3.12+
- Supabase CLI
- Expo CLI (`npx expo`)

### Setup

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/hapn.git
cd hapn

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local
# Fill in your Supabase URL, anon key, Mapbox token

# Start Supabase locally
supabase start

# Run migrations
supabase db push

# Seed the database
psql $DATABASE_URL < packages/supabase/seed/seed.sql

# Start the mobile app
pnpm --filter mobile dev
```

### Running Scrapers

```bash
cd services/scrapers
pip install -r requirements.txt
python src/run_all.py
```

## Roadmap

- [x] Data model and Supabase schema
- [ ] Event feed with filters (time, category, distance)
- [ ] "Happening Now" real-time section
- [ ] Map view with clustered pins
- [ ] Community event submission + moderation
- [ ] Scraper pipeline (Eventbrite, utahvalley.com, BYU, UVU, city calendars)
- [ ] Push notifications for saved event reminders
- [ ] Promoted listings for local businesses

## License

MIT
