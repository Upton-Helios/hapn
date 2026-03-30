# Architecture Overview

## System Diagram

```
┌─────────────────┐     ┌──────────────────────────────────────┐
│   Expo Mobile    │────▶│           Supabase                    │
│   App (RN)       │◀────│  ┌──────────┐  ┌──────────────────┐ │
└─────────────────┘     │  │ Postgres  │  │  Edge Functions   │ │
                        │  │ + PostGIS │  │  (moderation,     │ │
┌─────────────────┐     │  │          │  │   notifications)  │ │
│  Python Scrapers │────▶│  └──────────┘  └──────────────────┘ │
│  (GitHub Actions)│     │  ┌──────────┐  ┌──────────────────┐ │
└─────────────────┘     │  │   Auth   │  │  Row-Level        │ │
                        │  │          │  │  Security          │ │
                        │  └──────────┘  └──────────────────┘ │
                        └──────────────────────────────────────┘
```

## Data Flow

### Event Ingestion (Scrapers)
1. GitHub Actions cron triggers scraper pipeline every 6 hours
2. Each scraper fetches events from one source (Eventbrite, utahvalley.com, etc.)
3. Events are normalized to a common schema
4. Upserted to Supabase via `ON CONFLICT (source, source_id) DO UPDATE`
5. Expired events (end_time < now) are soft-deleted nightly

### Community Submissions
1. Authenticated user fills out event submission form
2. Row inserted to `community_submissions` table (status: `pending`)
3. Moderator reviews via admin Edge Function
4. On approval, row copied to `events` table with `source = 'community'`

### Event Discovery (App)
1. App requests events via Supabase client with filters
2. Postgres query uses PostGIS `ST_DWithin()` for radius filtering
3. Results sorted by: happening_now DESC, distance ASC
4. Client renders feed with category/time filters applied

## Geo Query Strategy

All proximity queries use PostGIS geography type for accurate distance on a sphere.

```sql
-- Find events within 10 miles of user
SELECT *, ST_Distance(location, ST_MakePoint($lng, $lat)::geography) AS distance_m
FROM events
WHERE ST_DWithin(location, ST_MakePoint($lng, $lat)::geography, 16093) -- 10 miles in meters
  AND start_time >= now()
ORDER BY
  (start_time <= now() AND end_time >= now()) DESC, -- happening now first
  distance_m ASC;
```

## Auth Strategy

- **Anonymous users:** Can browse events, search, filter. No account needed.
- **Authenticated users:** Can save events, submit community events, get push notifications.
- **Auth providers (v1):** Google, Apple, Email/Password via Supabase Auth.
- **Moderators:** Flag in `profiles.role`. Can approve/reject community submissions.

## Caching Strategy (v1 — Keep it simple)

- No client-side cache beyond React Query's default stale-while-revalidate
- Supabase handles connection pooling via Supavisor
- Scraper results cached by source with `last_scraped_at` timestamp to avoid redundant fetches
