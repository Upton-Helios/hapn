# CLAUDE.md — Project Intelligence for Claude Code

## What is Hapn?

Hapn is a community-sourced event discovery app covering all of Utah — from Salt Lake City and Park City to Provo, St. George, Logan, and Moab. It aggregates 2,000+ events from 13 sources and community submissions into a single, clean, mobile-first feed with GPS-based "near me" discovery. Think "Instagram Stories meets Craigslist Events" — not a ticketing platform.

## Tech Stack

- **Mobile App:** React Native / Expo (SDK 52+) with Expo Router (file-based routing)
- **Language:** TypeScript (strict mode) everywhere except scrapers
- **Backend:** Supabase (Postgres + PostGIS, Auth, Row-Level Security, Edge Functions)
- **Scrapers:** Python 3.12+ with httpx, BeautifulSoup4, scheduled via GitHub Actions cron
- **Monorepo:** pnpm workspaces + Turborepo
- **Maps:** Mapbox GL (react-native-mapbox-gl) — NOT Google Maps
- **State Management:** Zustand (no Redux, no Context-heavy patterns)
- **Styling:** Nativewind (Tailwind for React Native)

## Project Structure

```
hapn/
├── apps/mobile/         # Expo app (entry point: apps/mobile/app/)
├── packages/supabase/   # SQL migrations, seed data, edge functions, types
├── services/scrapers/   # Python scraper pipeline (one file per source)
├── docs/                # Architecture docs, data model, scraper source list
└── .github/workflows/   # CI + scraper cron jobs
```

## Architecture Rules

1. **Database is the source of truth.** All event data flows through Supabase Postgres. Scrapers INSERT. App READS. Community posts go through a moderation queue.
2. **PostGIS for all geo queries.** Events have a `location` column of type `geography(Point, 4326)`. Use `ST_DWithin()` and `ST_Distance()` for proximity queries. Never calculate distance client-side for filtering.
3. **Row-Level Security is mandatory.** Every table must have RLS enabled. Public reads for events. Authenticated writes for community submissions. Admin-only for moderation.
4. **Scrapers are idempotent.** Each scraper run should be safe to re-run. Use `ON CONFLICT (source, source_id) DO UPDATE` for upserts. Never create duplicate events.
5. **Edge Functions for server logic.** Moderation actions, event approval, and notifications run as Supabase Edge Functions (Deno), NOT client-side.

## Conventions

### TypeScript / React Native
- Functional components only. No class components.
- Named exports for components. Default export only for Expo Router screens.
- File naming: `kebab-case.tsx` for components, `camelCase.ts` for utilities.
- All API calls go through `packages/supabase/client.ts`. No raw fetch calls in components.
- Use `react-native-reanimated` for animations, not Animated API.

### Supabase
- Migration files: `packages/supabase/migrations/YYYYMMDDHHMMSS_description.sql`
- Always include both UP and DOWN (as comments) in migration files.
- Generated TypeScript types live in `packages/supabase/types/database.ts` (run `supabase gen types typescript`).
- Use Supabase JS client v2 (`@supabase/supabase-js`).

### Python Scrapers
- One file per source: `services/scrapers/src/scrape_<source_name>.py`
- All scrapers implement a `scrape() -> list[Event]` interface.
- Use `httpx` for HTTP (async). Use `BeautifulSoup4` for HTML parsing.
- Log to stdout. Errors to stderr. Exit code 0 on success, 1 on failure.
- Each scraper writes to Supabase via the Python client (`supabase-py`).

### Git
- Branch naming: `feat/description`, `fix/description`, `chore/description`
- Commit messages: imperative mood, lowercase, no period. e.g., `add event card component`
- PR into `main`. No direct pushes to `main`.

## Key Decisions (and why)

| Decision | Choice | Reason |
|----------|--------|--------|
| Database | Supabase (Postgres) | PostGIS for geo queries, full SQL, RLS, cheaper than Firestore for read-heavy feeds |
| Mobile framework | Expo | OTA updates, EAS Build, no native code ejection needed |
| State mgmt | Zustand | Minimal boilerplate, works well with Supabase subscriptions |
| Maps | Mapbox | Cheaper than Google Maps at scale, better customization |
| Scrapers | Python | Best ecosystem for web scraping (BS4, httpx). Isolated from TS app |
| Monorepo | Turborepo + pnpm | Lightweight, fast, good caching. Shared types between app and supabase |

## Data Model Summary

Core tables: `events`, `venues`, `event_sources`, `community_submissions`, `saved_events`, `profiles`

See `docs/DATA_MODEL.md` for full schema. See `packages/supabase/migrations/` for SQL.

## Common Commands

```bash
# Install dependencies
pnpm install

# Start Expo dev server
pnpm --filter mobile dev

# Run Supabase locally
supabase start

# Generate types from database
pnpm --filter supabase gen:types

# Run a specific scraper
python services/scrapers/src/scrape_eventbrite.py

# Run all scrapers
python services/scrapers/src/run_all.py
```

## Things to AVOID

- Do NOT use Firebase or any Google Cloud services.
- Do NOT use Redux, MobX, or React Context for global state.
- Do NOT calculate geo distance on the client for filtering (use PostGIS).
- Do NOT store event images in Supabase Storage for MVP. Use external URLs.
- Do NOT build a ticketing system. Hapn is discovery only. Link out to ticket sources.
- Do NOT add social features (profiles, follows, comments) in v1. Keep it simple.
