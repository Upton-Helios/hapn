# Data Model

## Entity Relationship

```
profiles ──────┐
               │ 1:N
               ▼
         saved_events ◀── events ──▶ venues
                            ▲
                            │ 1:1 (on approval)
                    community_submissions
                            ▲
                            │ N:1
                         profiles

event_sources (reference table for scraper metadata)
```

## Tables

### events
The core table. All events — scraped and community-submitted — live here.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | Default: gen_random_uuid() |
| title | text | NOT NULL |
| description | text | |
| venue_name | text | Denormalized for query speed |
| venue_id | uuid (FK) | Nullable, links to venues |
| city | text | NOT NULL, e.g., "Provo" |
| category | text | One of: music, food, outdoors, family, nightlife, arts, sports, community |
| tags | text[] | Additional tags, e.g., {"free", "family"} |
| price | text | Display string: "Free", "$12", "$10-25" |
| price_cents_min | integer | For filtering. 0 = free. NULL = unknown |
| start_time | timestamptz | NOT NULL |
| end_time | timestamptz | |
| date | date | Derived from start_time, indexed for quick date range queries |
| location | geography(Point, 4326) | PostGIS point. NOT NULL |
| image_url | text | External URL to event image |
| source | text | 'eventbrite', 'utahvalley', 'community', etc. |
| source_id | text | External ID from source. Used for dedup |
| source_url | text | Link back to original listing |
| status | text | 'active', 'cancelled', 'expired'. Default: 'active' |
| submitted_by | uuid (FK) | Links to profiles. NULL for scraped events |
| created_at | timestamptz | Default: now() |
| updated_at | timestamptz | Default: now(), auto-updated via trigger |

**Indexes:**
- `idx_events_location` — GIST index on `location` for geo queries
- `idx_events_start_time` — B-tree on `start_time` for date range filters
- `idx_events_category` — B-tree on `category`
- `idx_events_source_dedup` — UNIQUE on `(source, source_id)` for upserts
- `idx_events_status` — Partial index WHERE status = 'active'

### venues
Optional. For events at known, recurring venues.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| name | text | NOT NULL |
| address | text | |
| city | text | |
| location | geography(Point, 4326) | |
| website | text | |
| created_at | timestamptz | |

### profiles
Extended user info beyond Supabase Auth.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | Same as auth.users.id |
| display_name | text | |
| role | text | 'user', 'moderator', 'admin'. Default: 'user' |
| home_city | text | For default location |
| push_token | text | Expo push notification token |
| created_at | timestamptz | |

### saved_events
Join table for user bookmarks.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| user_id | uuid (FK) | References profiles.id |
| event_id | uuid (FK) | References events.id |
| created_at | timestamptz | |

**Constraint:** UNIQUE on `(user_id, event_id)`

### community_submissions
Moderation queue for user-submitted events.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| submitted_by | uuid (FK) | References profiles.id |
| title | text | NOT NULL |
| description | text | |
| venue_name | text | |
| city | text | |
| category | text | |
| tags | text[] | |
| price | text | |
| start_time | timestamptz | |
| end_time | timestamptz | |
| lat | float8 | User-provided or geocoded |
| lng | float8 | |
| image_url | text | |
| status | text | 'pending', 'approved', 'rejected'. Default: 'pending' |
| reviewed_by | uuid (FK) | Moderator who reviewed |
| reviewed_at | timestamptz | |
| rejection_reason | text | |
| created_at | timestamptz | |

### event_sources
Metadata for scraper pipeline.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| name | text | 'eventbrite', 'utahvalley', 'byu', etc. |
| base_url | text | |
| scraper_file | text | e.g., 'scrape_eventbrite.py' |
| last_scraped_at | timestamptz | |
| is_active | boolean | Default: true |
| event_count | integer | Denormalized count of active events from this source |

## Row-Level Security Policies

```sql
-- events: anyone can read active events
CREATE POLICY "Public read active events" ON events
  FOR SELECT USING (status = 'active');

-- saved_events: users can only see/manage their own
CREATE POLICY "Users manage own saves" ON saved_events
  FOR ALL USING (auth.uid() = user_id);

-- community_submissions: users can insert and view their own
CREATE POLICY "Users submit events" ON community_submissions
  FOR INSERT WITH CHECK (auth.uid() = submitted_by);

CREATE POLICY "Users view own submissions" ON community_submissions
  FOR SELECT USING (auth.uid() = submitted_by);

-- Moderators can view and update all submissions
CREATE POLICY "Moderators manage submissions" ON community_submissions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('moderator', 'admin'))
  );
```
