-- Migration: 20260401000000_cross_source_dedup.sql
-- Description: Add cross-source dedup to nearby_events function
-- Dedup logic: same title + same date + within 1 mile + different source = duplicate
-- Keeps the version with the richest data (description, image, price, address, source_url)

-- DOWN (restore previous version without dedup):
-- DROP FUNCTION IF EXISTS nearby_events;
-- (then recreate from 20260329000000_initial_schema.sql)

DROP FUNCTION IF EXISTS nearby_events;

CREATE OR REPLACE FUNCTION nearby_events(
    user_lat DOUBLE PRECISION,
    user_lng DOUBLE PRECISION,
    radius_miles DOUBLE PRECISION DEFAULT 10,
    category_filter TEXT DEFAULT NULL,
    time_filter TEXT DEFAULT 'today'
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    venue_name TEXT,
    address TEXT,
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
)
LANGUAGE plpgsql STABLE
AS $function$
DECLARE
    radius_meters DOUBLE PRECISION := radius_miles * 1609.34;
    user_point GEOGRAPHY := ST_MakePoint(user_lng, user_lat)::geography;
BEGIN
    RETURN QUERY
    WITH base AS (
        SELECT
            e.id,
            e.title,
            e.description,
            e.venue_name,
            e.address,
            e.city,
            e.category,
            e.tags,
            e.price,
            e.start_time,
            e.end_time,
            e.image_url,
            e.source,
            e.source_url,
            e.location AS geo,
            ST_Y(e.location::geometry) AS lat,
            ST_X(e.location::geometry) AS lng,
            ROUND((ST_Distance(e.location, user_point) / 1609.34)::numeric, 1)::double precision AS distance_miles,
            (e.start_time <= now() AND (e.end_time IS NULL OR e.end_time >= now())) AS is_happening_now,
            -- Data richness score for picking the best version
            (CASE WHEN e.description IS NOT NULL AND length(e.description) > 10 THEN 1 ELSE 0 END)
            + (CASE WHEN e.image_url IS NOT NULL THEN 1 ELSE 0 END)
            + (CASE WHEN e.price IS NOT NULL THEN 1 ELSE 0 END)
            + (CASE WHEN e.address IS NOT NULL THEN 1 ELSE 0 END)
            + (CASE WHEN e.source_url IS NOT NULL THEN 1 ELSE 0 END) AS richness,
            CASE e.source
                WHEN 'byu' THEN 1
                WHEN 'eventbrite' THEN 2
                WHEN 'provo_gov' THEN 3
                WHEN 'utahvalley' THEN 4
                WHEN 'community' THEN 5
                ELSE 6
            END AS source_rank
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
    ),
    -- Only dedup CROSS-SOURCE: same title, same date, different source, within 1 mile
    losers AS (
        SELECT DISTINCT ON (worse.id) worse.id
        FROM base better
        JOIN base worse ON better.id != worse.id
            AND better.source != worse.source
            AND lower(trim(better.title)) = lower(trim(worse.title))
            AND better.start_time::date = worse.start_time::date
            AND ST_DWithin(better.geo, worse.geo, 1609)  -- within 1 mile
            AND (
                better.richness > worse.richness
                OR (better.richness = worse.richness AND better.source_rank < worse.source_rank)
                OR (better.richness = worse.richness AND better.source_rank = worse.source_rank AND better.id < worse.id)
            )
    )
    SELECT
        b.id, b.title, b.description, b.venue_name,
        b.address, b.city, b.category, b.tags,
        b.price, b.start_time, b.end_time, b.image_url,
        b.source, b.source_url, b.lat, b.lng,
        b.distance_miles, b.is_happening_now
    FROM base b
    WHERE b.id NOT IN (SELECT l.id FROM losers l)
    ORDER BY
        b.is_happening_now DESC,
        b.distance_miles ASC,
        b.start_time ASC;
END;
$function$;
