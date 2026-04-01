# hapn

**What's happening near you.**

A community-sourced event discovery app for all of Utah. Aggregates events from public sources and community submissions into a single, clean, mobile-first feed with GPS-based "near me" discovery.

## The Problem

Event discovery in Utah is fragmented across dozens of sources — Eventbrite, tourism board sites, city .gov calendars, venue websites, Facebook, word of mouth. There's no single place to answer: *"What should I do this weekend?"*

## The Solution

Hapn aggregates 2,000+ events from 13 sources across Utah (Eventbrite, Visit Salt Lake, Visit Park City, Visit St. George, Utah Valley tourism, BYU/UVU calendars, city event pages, and more) and lets community members submit local happenings. Everything in one scrollable feed, filterable by time, category, and distance radius.

## Coverage Area

**Statewide Utah** — with concentrated coverage in these regions:

- **Salt Lake Metro:** Salt Lake City, Sandy, West Jordan, Draper, Murray, Park City
- **Utah Valley:** Provo, Orem, Lehi, American Fork, Pleasant Grove, Spanish Fork, Springville
- **Southern Utah:** St. George, Hurricane, Ivins, Cedar City, Washington
- **Northern Utah:** Logan, Ogden, Layton
- **Eastern Utah:** Moab, Price

Users can filter by distance radius (5 / 10 / 25 / 50 / 100 mi / Statewide) from their GPS location.

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
- [x] Scraper pipeline — 13 sources, 2,000+ events statewide
- [x] Event feed with filters (time, category, distance radius)
- [x] GPS "near me" location detection
- [x] Distance radius filter (5 / 10 / 25 / 50 / 100 mi / Statewide)
- [ ] "Happening Now" real-time section
- [ ] Map view with clustered pins
- [ ] Community event submission + moderation
- [ ] Push notifications for saved event reminders
- [ ] Promoted listings for local businesses

## License

MIT
