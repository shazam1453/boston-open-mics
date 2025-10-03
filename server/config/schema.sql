-- Boston Open Mics Database Schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    performer_type VARCHAR(50) CHECK (performer_type IN ('musician', 'comedian', 'poet', 'storyteller', 'other')),
    bio TEXT,
    instagram_handle VARCHAR(100),
    twitter_handle VARCHAR(100),
    tiktok_handle VARCHAR(100),
    youtube_handle VARCHAR(100),
    website_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Venues table
CREATE TABLE IF NOT EXISTS venues (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    description TEXT,
    capacity INTEGER,
    amenities JSONB DEFAULT '[]',
    owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recurring event templates
CREATE TABLE IF NOT EXISTS recurring_event_templates (
    id SERIAL PRIMARY KEY,
    venue_id INTEGER REFERENCES venues(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    max_performers INTEGER NOT NULL DEFAULT 10,
    performance_length INTEGER NOT NULL DEFAULT 5, -- minutes
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('open-mic', 'showcase', 'competition', 'workshop')),
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 6=Saturday
    signup_opens_time TIME, -- specific time on event date when signups open
    signup_deadline_time TIME, -- specific time on event date when signups close
    signup_opens_hours_before INTEGER DEFAULT 168, -- hours before event (default 1 week)
    signup_deadline_hours_before INTEGER DEFAULT 2, -- hours before event
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Events table (now generated from templates or created manually)
CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    venue_id INTEGER REFERENCES venues(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    max_performers INTEGER NOT NULL DEFAULT 10,
    performance_length INTEGER NOT NULL DEFAULT 5, -- minutes
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('open-mic', 'showcase', 'competition', 'workshop')),
    signup_opens TIMESTAMP,
    signup_deadline TIMESTAMP,
    host_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    recurring_template_id INTEGER REFERENCES recurring_event_templates(id) ON DELETE SET NULL,
    is_cancelled BOOLEAN DEFAULT false,
    event_status VARCHAR(20) DEFAULT 'scheduled' CHECK (event_status IN ('scheduled', 'live', 'finished')),
    signup_list_mode VARCHAR(20) DEFAULT 'signup_order' CHECK (signup_list_mode IN ('signup_order', 'random_order', 'bucket')),
    current_performer_id INTEGER REFERENCES signups(id) ON DELETE SET NULL,
    started_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Signups table
CREATE TABLE IF NOT EXISTS signups (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    performance_name VARCHAR(255) NOT NULL,
    notes TEXT,
    performance_type VARCHAR(50) NOT NULL CHECK (performance_type IN ('music', 'comedy', 'poetry', 'storytelling', 'other')),
    status VARCHAR(20) DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'waitlist', 'cancelled', 'performing', 'performed')),
    performance_order INTEGER,
    is_finished BOOLEAN DEFAULT false,
    finished_at TIMESTAMP,
    is_current_performer BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, user_id)
);

-- Event co-hosts table
CREATE TABLE IF NOT EXISTS event_cohosts (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    added_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, user_id)
);

-- Invitations table
CREATE TABLE IF NOT EXISTS invitations (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
    inviter_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    invitee_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('cohost', 'performer')),
    message TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    responded_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, invitee_id, type)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
CREATE INDEX IF NOT EXISTS idx_events_venue ON events(venue_id);
CREATE INDEX IF NOT EXISTS idx_events_host ON events(host_id);
CREATE INDEX IF NOT EXISTS idx_signups_event ON signups(event_id);
CREATE INDEX IF NOT EXISTS idx_signups_user ON signups(user_id);
CREATE INDEX IF NOT EXISTS idx_venues_owner ON venues(owner_id);
CREATE INDEX IF NOT EXISTS idx_invitations_invitee ON invitations(invitee_id);
CREATE INDEX IF NOT EXISTS idx_invitations_event ON invitations(event_id);

-- Sample data (optional)
-- INSERT INTO users (email, password, name, performer_type, bio) VALUES
-- ('john@example.com', '$2a$12$hash', 'John Doe', 'musician', 'Singer-songwriter from Boston'),
-- ('jane@example.com', '$2a$12$hash', 'Jane Smith', 'comedian', 'Stand-up comedian and host');

-- INSERT INTO venues (name, address, description, capacity, owner_id) VALUES
-- ('The Comedy Studio', '1238 Massachusetts Ave, Cambridge, MA', 'Premier comedy venue in Harvard Square', 50, 2),
-- ('Club Passim', '47 Palmer St, Cambridge, MA', 'Intimate folk music venue', 80, 1);