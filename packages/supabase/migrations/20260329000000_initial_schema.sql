-- Migration: 20260329000000_initial_schema.sql
-- Description: Core tables for Hapn event discovery app

-- Enable PostGIS extension for geospatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'admin')),
    home_city TEXT DEFAULT 'Orem',
    push_token TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read profiles" ON profiles
    FOR SELECT USING (true);

CREATE POLICY "Users update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, display_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- VENUES
-- ============================================================
CREATE TABLE venues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT,
    city TEXT,
    location GEOGRAPHY(Point, 4326),
    website TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read venues" ON venues
    FOR SELECT USING (true);

-- ============================================================
-- EVENTS (core table)
-- ============================================================
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    venue_name TEXT,
    venue_id UUID REFERENCES venues(id),
    city TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN (
        'music', 'food', 'outdoors', 'family', 'nightlife', 'arts', 'sports', 'community'
    )),
    tags TEXT[] DEFAULT '{}',
    price TEXT,
    price_cents_min INTEGER,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    date DATE GENERATED ALWAYS AS ((start_time AT TIME ZONE 'America/Denver')::date) STORED,
    location GEOGRAPHY(Point, 4326) NOT NULL,
    image_url TEXT,
    source TEXT NOT NULL,
    source_id TEXT,
    source_url TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
    submitted_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_events_location ON events USING GIST (location);
CREATE INDEX idx_events_start_time ON events (start_time);
CREATE INDEX idx_events_date ON events (date);
CREATE INDEX idx_events_category ON events (category);
CREATE INDEX idx_events_status ON events (status) WHERE status = 'active';
CREATE UNIQUE INDEX idx_events_source_dedup ON events (source, source_id) WHERE source_id IS NOT NULL;

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active events" ON events
    FOR SELECT USING (status = 'active');

CREATE POLICY "Scrapers insert events" ON events
    FOR INSERT WITH CHECK (true); -- Controlled via service_role key, not anon

CREATE POLICY "Admins manage events" ON events
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('moderator', 'admin'))
    );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER events_updated_at
    BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- SAVED EVENTS (user bookmarks)
-- ============================================================
CREATE TABLE saved_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, event_id)
);

ALTER TABLE saved_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own saves" ON saved_events
    FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- COMMUNITY SUBMISSIONS (moderation queue)
-- ============================================================
CREATE TABLE community_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submitted_by UUID NOT NULL REFERENCES profiles(id),
    title TEXT NOT NULL,
    description TEXT,
    venue_name TEXT,
    city TEXT,
    category TEXT CHECK (category IN (
        'music', 'food', 'outdoors', 'family', 'nightlife', 'arts', 'sports', 'community'
    )),
    tags TEXT[] DEFAULT '{}',
    price TEXT,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    image_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES profiles(id),
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE community_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users submit events" ON community_submissions
    FOR INSERT WITH CHECK (auth.uid() = submitted_by);

CREATE POLICY "Users view own submissions" ON community_submissions
    FOR SELECT USING (auth.uid() = submitted_by);

CREATE POLICY "Moderators manage submissions" ON community_submissions
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('moderator', 'admin'))
    );

-- ============================================================
-- EVENT SOURCES (scraper metadata)
-- ============================================================
CREATE TABLE event_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    base_url TEXT,
    scraper_file TEXT,
    last_scraped_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    event_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE event_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read sources" ON event_sources
    FOR SELECT USING (true);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Find events near a point within a radius (in miles)
CREATE OR REPLACE FUNCTION nearby_events(
    user_lat DOUBLE PRECISION,
    user_lng DOUBLE PRECISION,
    radius_miles DOUBLE PRECISION DEFAULT 10,
    category_filter TEXT DEFAULT NULL,
    time_filter TEXT DEFAULT 'today' -- 'now', 'today', 'weekend', 'week'
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    venue_name TEXT,
    city TEXT,
    category TEXT,
    tags TEXT[],
    price TEXT,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    image_url TEXT,
    source TEXT,
    source_url TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    distance_miles DOUBLE PRECISION,
    is_happening_now BOOLEAN
) AS $$
DECLARE
    radius_meters DOUBLE PRECISION := radius_miles * 1609.34;
    user_point GEOGRAPHY := ST_MakePoint(user_lng, user_lat)::geography;
BEGIN
    RETURN QUERY
    SELECT
        e.id,
        e.title,
        e.description,
        e.venue_name,
        e.city,
        e.category,
        e.tags,
        e.price,
        e.start_time,
        e.end_time,
        e.image_url,
        e.source,
        e.source_url,
        ST_Y(e.location::geometry) AS lat,
        ST_X(e.location::geometry) AS lng,
        ROUND((ST_Distance(e.location, user_point) / 1609.34)::numeric, 1)::double precision AS distance_miles,
        (e.start_time <= now() AND (e.end_time IS NULL OR e.end_time >= now())) AS is_happening_now
    FROM events e
    WHERE e.status = 'active'
        AND ST_DWithin(e.location, user_point, radius_meters)
        AND (category_filter IS NULL OR e.category = category_filter)
        AND (
            CASE time_filter
                WHEN 'now' THEN e.start_time <= now() AND (e.end_time IS NULL OR e.end_time >= now())
                WHEN 'today' THEN e.date = (now() AT TIME ZONE 'America/Denver')::date
                WHEN 'weekend' THEN e.date BETWEEN
                    (date_trunc('week', now() AT TIME ZONE 'America/Denver') + INTERVAL '5 days')::date
                    AND (date_trunc('week', now() AT TIME ZONE 'America/Denver') + INTERVAL '6 days')::date
                WHEN 'week' THEN e.date BETWEEN
                    (now() AT TIME ZONE 'America/Denver')::date
                    AND ((now() AT TIME ZONE 'America/Denver')::date + INTERVAL '7 days')::date
                ELSE true
            END
        )
    ORDER BY
        is_happening_now DESC,
        distance_miles ASC,
        e.start_time ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- DOWN (rollback):
-- DROP FUNCTION IF EXISTS nearby_events;
-- DROP TABLE IF EXISTS event_sources CASCADE;
-- DROP TABLE IF EXISTS community_submissions CASCADE;
-- DROP TABLE IF EXISTS saved_events CASCADE;
-- DROP TABLE IF EXISTS events CASCADE;
-- DROP TABLE IF EXISTS venues CASCADE;
-- DROP TABLE IF EXISTS profiles CASCADE;
-- DROP EXTENSION IF EXISTS postgis;
