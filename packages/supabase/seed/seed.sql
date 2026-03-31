-- Seed data: Utah Valley events for development and demo
-- Uses real venues and realistic event data

-- Event Sources
INSERT INTO event_sources (name, base_url, scraper_file, is_active) VALUES
    ('eventbrite', 'https://www.eventbrite.com', 'scrape_eventbrite.py', true),
    ('utahvalley', 'https://www.utahvalley.com/events', 'scrape_utahvalley.py', true),
    ('nowplayingutah', 'https://nowplayingutah.com', 'scrape_nowplayingutah.py', true),
    ('provo_gov', 'https://www.provo.gov/572/Community-Events', 'scrape_provo_gov.py', true),
    ('byu', 'https://calendar.byu.edu', 'scrape_byu.py', true),
    ('uvu', 'https://www.uvu.edu/events', 'scrape_uvu.py', true),
    ('uccu_center', 'https://www.uccucenter.com/events', 'scrape_uccu.py', true),
    ('community', NULL, NULL, true);

-- Venues
INSERT INTO venues (name, address, city, location, website) VALUES
    ('Velour Live Music Gallery', '135 N University Ave', 'Provo',
        ST_MakePoint(-111.6595, 40.2335)::geography, 'https://velourlive.com'),
    ('SCERA Center for the Arts', '745 S State St', 'Orem',
        ST_MakePoint(-111.6946, 40.2840)::geography, 'https://scera.org'),
    ('Noorda Center for the Performing Arts', '800 W University Pkwy', 'Orem',
        ST_MakePoint(-111.7146, 40.2783)::geography, 'https://noorda.uvu.edu'),
    ('UCCU Center', '800 W University Pkwy', 'Orem',
        ST_MakePoint(-111.7155, 40.2790)::geography, 'https://uccucenter.com'),
    ('Ashton Gardens at Thanksgiving Point', '3003 Thanksgiving Way', 'Lehi',
        ST_MakePoint(-111.9021, 40.4313)::geography, 'https://thanksgivingpoint.org'),
    ('Pioneer Park', '500 W Center St', 'Provo',
        ST_MakePoint(-111.6585, 40.2338)::geography, NULL),
    ('Covey Center for the Arts', '425 W Center St', 'Provo',
        ST_MakePoint(-111.6620, 40.2335)::geography, 'https://coveycenter.org'),
    ('Spanish Fork Sports Park', '475 S Main St', 'Spanish Fork',
        ST_MakePoint(-111.6548, 40.1149)::geography, NULL),
    ('Y Mountain Trailhead', 'E 820 N', 'Provo',
        ST_MakePoint(-111.6345, 40.2468)::geography, NULL),
    ('Larry H. Miller Field', 'Provo', 'Provo',
        ST_MakePoint(-111.6493, 40.2518)::geography, 'https://byucougars.com');

-- Events (mix of happening now, today, this week, and upcoming)
INSERT INTO events (title, description, venue_name, city, category, tags, price, price_cents_min, start_time, end_time, location, image_url, source, source_id) VALUES

-- Happening now (Saturday morning)
('Provo Farmers Market',
 'Fresh local produce, handmade crafts, live music, and food trucks every Saturday morning at Pioneer Park.',
 'Pioneer Park', 'Provo', 'food', ARRAY['free', 'family', 'food'],
 'Free', 0,
 '2026-03-29 09:00:00-06', '2026-03-29 14:00:00-06',
 ST_MakePoint(-111.6585, 40.2338)::geography,
 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=600&h=400&fit=crop', 'provo_gov', 'provo-farmers-market-2026'),

('Pickup Basketball — Open Gym',
 'Open gym pickup games at Orem Rec Center. All skill levels. $3 drop-in or free with rec pass.',
 'Orem Recreation Center', 'Orem', 'sports', ARRAY['sports'],
 '$3', 300,
 '2026-03-29 10:00:00-06', '2026-03-29 13:00:00-06',
 ST_MakePoint(-111.6946, 40.2969)::geography,
 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=600&h=400&fit=crop', 'community', 'orem-pickup-bball-0329'),

('BYU vs Utah Baseball',
 'Rivalry game at Larry H. Miller Field. Student section opens early. Family-friendly atmosphere.',
 'Larry H. Miller Field', 'Provo', 'sports', ARRAY['sports', 'family'],
 '$8', 800,
 '2026-03-29 14:00:00-06', '2026-03-29 17:00:00-06',
 ST_MakePoint(-111.6493, 40.2518)::geography,
 'https://images.unsplash.com/photo-1529768167801-9173d94c2a42?w=600&h=400&fit=crop', 'byu', 'byu-utah-baseball-0329'),

-- Today, later
('Spanish Fork Food Truck Rally',
 '12+ food trucks, live DJ, lawn games. Bring blankets and chairs. Dogs welcome on leash.',
 'Spanish Fork Sports Park', 'Spanish Fork', 'food', ARRAY['free', 'food', 'family', 'music'],
 'Free entry', 0,
 '2026-03-29 17:00:00-06', '2026-03-29 21:00:00-06',
 ST_MakePoint(-111.6548, 40.1149)::geography,
 'https://images.unsplash.com/photo-1567129937968-cdad8f07e2f8?w=600&h=400&fit=crop', 'community', 'sf-food-truck-0329'),

('Trivia Night at Roosters',
 'Weekly pub trivia. Teams of up to 6. Prizes for top 3. Great food and local brews on tap.',
 'Roosters Brewing Co.', 'Orem', 'nightlife', ARRAY['free', 'nightlife', 'food'],
 'Free', 0,
 '2026-03-29 19:00:00-06', '2026-03-29 21:30:00-06',
 ST_MakePoint(-111.6947, 40.2849)::geography,
 'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=600&h=400&fit=crop', 'community', 'roosters-trivia-0329'),

('Live Jazz at Velour',
 'Local jazz trio performing original compositions and classic standards in an intimate venue.',
 'Velour Live Music Gallery', 'Provo', 'music', ARRAY['music', 'nightlife'],
 '$12', 1200,
 '2026-03-29 20:00:00-06', '2026-03-29 23:00:00-06',
 ST_MakePoint(-111.6595, 40.2335)::geography,
 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=600&h=400&fit=crop', 'community', 'velour-jazz-0329'),

-- Tomorrow
('Y Mountain Sunrise Hike',
 'Group hike to the Y. Meet at the trailhead parking lot. All skill levels welcome. Bring water and layers.',
 'Y Mountain Trailhead', 'Provo', 'outdoors', ARRAY['free', 'outdoors', 'sports'],
 'Free', 0,
 '2026-03-30 06:00:00-06', '2026-03-30 09:00:00-06',
 ST_MakePoint(-111.6345, 40.2468)::geography,
 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600&h=400&fit=crop', 'community', 'y-mountain-hike-0330'),

('Oremfest Volunteer Planning Kickoff',
 'Volunteer meeting for this summer''s Oremfest. Help plan concerts, parades, and carnival events.',
 'SCERA Center for the Arts', 'Orem', 'community', ARRAY['free', 'community'],
 'Free', 0,
 '2026-03-30 18:00:00-06', '2026-03-30 20:00:00-06',
 ST_MakePoint(-111.6946, 40.2840)::geography,
 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&h=400&fit=crop', 'utahvalley', 'oremfest-planning-2026'),

('Pottery Workshop for Beginners',
 'Hands-on intro to wheel throwing. All materials included. Take home your creation after firing.',
 'The Clay Space', 'Springville', 'arts', ARRAY['arts'],
 '$35', 3500,
 '2026-03-30 10:00:00-06', '2026-03-30 12:30:00-06',
 ST_MakePoint(-111.6107, 40.1653)::geography,
 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=600&h=400&fit=crop', 'eventbrite', 'eb-pottery-springville'),

-- This week
('Covey Center: Acoustic Open Mic',
 'Open mic night featuring local singer-songwriters. Sign up starts at 6:30 PM. All genres welcome.',
 'Covey Center for the Arts', 'Provo', 'music', ARRAY['music', 'free'],
 'Free', 0,
 '2026-03-31 19:00:00-06', '2026-03-31 21:00:00-06',
 ST_MakePoint(-111.6620, 40.2335)::geography,
 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=600&h=400&fit=crop', 'nowplayingutah', 'covey-open-mic-0331'),

('Lehi City Easter Egg Hunt',
 'Annual city-wide Easter egg hunt for kids ages 2-12. Bring a basket. Over 10,000 eggs hidden.',
 'Wines Park', 'Lehi', 'family', ARRAY['free', 'family'],
 'Free', 0,
 '2026-04-01 10:00:00-06', '2026-04-01 12:00:00-06',
 ST_MakePoint(-111.8507, 40.3916)::geography,
 'https://images.unsplash.com/photo-1524386416438-98b9b2d4b433?w=600&h=400&fit=crop', 'community', 'lehi-easter-2026'),

-- Upcoming
('Thanksgiving Point Tulip Festival',
 'Hundreds of thousands of tulips in bloom at Ashton Gardens. Utah Valley''s most iconic spring experience.',
 'Ashton Gardens at Thanksgiving Point', 'Lehi', 'family', ARRAY['family', 'outdoors'],
 '$22', 2200,
 '2026-04-10 10:00:00-06', '2026-04-10 20:00:00-06',
 ST_MakePoint(-111.9021, 40.4313)::geography,
 'https://images.unsplash.com/photo-1524386416438-98b9b2d4b433?w=600&h=400&fit=crop', 'utahvalley', 'tulip-festival-2026'),

('Noorda Center: Contemporary Dance',
 'UVU School of the Arts presents an evening of original contemporary dance works.',
 'Noorda Center for the Performing Arts', 'Orem', 'arts', ARRAY['arts'],
 '$15', 1500,
 '2026-04-03 19:30:00-06', '2026-04-03 21:30:00-06',
 ST_MakePoint(-111.7146, 40.2783)::geography,
 'https://images.unsplash.com/photo-1508807526345-15e9b5f4eaff?w=600&h=400&fit=crop', 'nowplayingutah', 'noorda-dance-0403'),

('Festival of Colors 2026',
 'Utah Valley''s most vibrant spring celebration at the Sri Sri Radha Krishna Temple. Music, dancing, food, and colorful powder throws.',
 'Sri Sri Radha Krishna Temple', 'Spanish Fork', 'community', ARRAY['community', 'music', 'family', 'food'],
 '$5', 500,
 '2026-04-04 11:00:00-06', '2026-04-04 18:00:00-06',
 ST_MakePoint(-111.6196, 40.0786)::geography,
 'https://images.unsplash.com/photo-1576473108869-0e8b2e8e0e5e?w=600&h=400&fit=crop', 'utahvalley', 'festival-of-colors-2026'),

('UCCU Center: Stand-Up Comedy Night',
 'Touring comedian headliner with two local openers. Doors at 7, show at 8.',
 'UCCU Center', 'Orem', 'nightlife', ARRAY['nightlife', 'arts'],
 '$25-45', 2500,
 '2026-04-05 20:00:00-06', '2026-04-05 22:00:00-06',
 ST_MakePoint(-111.7155, 40.2790)::geography,
 'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=600&h=400&fit=crop', 'uccu_center', 'uccu-comedy-0405');
