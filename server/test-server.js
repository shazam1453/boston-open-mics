const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5002;

// File paths for persistence
const DATA_DIR = path.join(__dirname, 'test-data');
const VENUES_FILE = path.join(DATA_DIR, 'venues.json');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');
const SIGNUPS_FILE = path.join(DATA_DIR, 'signups.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Load data from files or use defaults
function loadData() {
  let venues = [];
  let events = [];
  let signups = [];
  
  try {
    if (fs.existsSync(VENUES_FILE)) {
      venues = JSON.parse(fs.readFileSync(VENUES_FILE, 'utf8'));
    }
  } catch (error) {
    console.log('Could not load venues, using defaults');
  }
  
  try {
    if (fs.existsSync(EVENTS_FILE)) {
      events = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8'));
    }
  } catch (error) {
    console.log('Could not load events, using defaults');
  }
  
  try {
    if (fs.existsSync(SIGNUPS_FILE)) {
      signups = JSON.parse(fs.readFileSync(SIGNUPS_FILE, 'utf8'));
    }
  } catch (error) {
    console.log('Could not load signups, using defaults');
  }
  
  return { venues, events, signups };
}

// Save data to files
function saveVenues(venues) {
  try {
    fs.writeFileSync(VENUES_FILE, JSON.stringify(venues, null, 2));
  } catch (error) {
    console.error('Could not save venues:', error);
  }
}

function saveEvents(events) {
  try {
    fs.writeFileSync(EVENTS_FILE, JSON.stringify(events, null, 2));
  } catch (error) {
    console.error('Could not save events:', error);
  }
}

function saveSignups(signups) {
  try {
    fs.writeFileSync(SIGNUPS_FILE, JSON.stringify(signups, null, 2));
  } catch (error) {
    console.error('Could not save signups:', error);
  }
}

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));

// Logging
app.use(morgan('combined'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Test routes
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working!' });
});

// Test login endpoint
app.get('/api/test-login', (req, res) => {
  res.json({
    availableUsers: Object.keys(mockUsers),
    testCredentials: {
      email: 'test@example.com',
      password: 'password'
    },
    mockUsers: mockUsers
  });
});

// Debug endpoint to check data
app.get('/api/debug', (req, res) => {
  res.json({
    venues: mockVenues,
    events: mockEvents,
    venueCount: mockVenues.length,
    eventCount: mockEvents.length,
    users: Object.keys(mockUsers),
    activeTokens: Object.keys(activeTokens)
  });
});

// Initialize data from files or defaults
const { venues: loadedVenues, events: loadedEvents, signups: loadedSignups } = loadData();

// Mock events data  
let mockEvents = loadedEvents.length > 0 ? loadedEvents : [
  {
    id: 1,
    title: 'Open Mic Night at The Comedy Studio',
    description: 'Weekly open mic for comedians and musicians. Come share your talent with a supportive audience! All skill levels welcome.',
    venue_name: 'The Comedy Studio',
    venue_address: '1238 Massachusetts Ave, Cambridge, MA',
    date: '2025-10-09',
    start_time: '20:00',
    end_time: '23:00',
    max_performers: 15,
    current_signups: 8,
    performance_length: 5,
    event_type: 'open-mic',
    signup_list_mode: 'signup_order',
    current_performer_id: null,
    recurring_template_id: null,
    signup_opens: '2025-10-02T09:00:00Z', // Opens 1 week before
    signup_deadline: '2025-10-09T18:00:00Z', // 2 hours before event
    host_id: 2,
    host_name: 'Event Host',
    host_email: 'host@example.com',
    event_status: 'scheduled',
    started_at: null
  },
  {
    id: 2,
    title: 'Folk Music Showcase',
    description: 'Acoustic performances welcome. A cozy evening of folk music in an intimate setting.',
    venue_name: 'Club Passim',
    venue_address: '47 Palmer St, Cambridge, MA',
    date: '2025-10-12',
    start_time: '19:30',
    end_time: '22:30',
    max_performers: 10,
    current_signups: 5,
    performance_length: 8,
    event_type: 'showcase',
    signup_list_mode: 'random_order',
    current_performer_id: null,
    recurring_template_id: null,
    signup_opens: '2025-10-05T10:00:00Z', // Opens 1 week before
    signup_deadline: '2025-10-12T12:00:00Z', // Day of event at noon
    host_id: 2,
    host_name: 'Event Host',
    host_email: 'host@example.com',
    event_status: 'scheduled',
    started_at: null
  },
  {
    id: 3,
    title: 'Poetry Slam Night',
    description: 'Express yourself through spoken word! Competitive poetry slam with prizes.',
    venue_name: 'The Cantab Lounge',
    venue_address: '738 Massachusetts Ave, Cambridge, MA',
    date: '2025-10-15',
    start_time: '21:00',
    end_time: '24:00',
    max_performers: 12,
    current_signups: 12,
    performance_length: 4,
    event_type: 'competition',
    signup_list_mode: 'signup_order',
    current_performer_id: null,
    recurring_template_id: null,
    signup_opens: '2025-10-01T12:00:00Z', // Opens 2 weeks before
    signup_deadline: '2025-10-14T23:59:00Z', // Day before event
    host_id: 2,
    host_name: 'Event Host',
    host_email: 'host@example.com',
    event_status: 'scheduled',
    started_at: null
  },
  {
    id: 4,
    title: 'Acoustic Jam Session',
    description: 'Bring your acoustic instruments and join us for a collaborative jam session.',
    venue_name: 'The Burren',
    venue_address: '247 Elm St, Somerville, MA',
    date: '2025-10-20',
    start_time: '14:00',
    end_time: '17:00',
    max_performers: 8,
    current_signups: 3,
    performance_length: 10,
    event_type: 'open-mic',
    signup_list_mode: 'random_order',
    current_performer_id: null,
    recurring_template_id: null,
    signup_opens: '2025-10-13T09:00:00Z', // Opens 1 week before
    signup_deadline: '2025-10-19T17:00:00Z', // Day before at 5pm
    host_id: 2,
    host_name: 'Event Host',
    host_email: 'host@example.com',
    event_status: 'scheduled',
    started_at: null
  },
  {
    id: 5,
    title: 'Comedy Open Mic - Future Event',
    description: 'Stand-up comedy open mic night. Signups open soon!',
    venue_name: 'Laugh Track Comedy Club',
    venue_address: '123 Funny St, Boston, MA',
    date: '2025-11-01',
    start_time: '20:00',
    end_time: '23:00',
    max_performers: 12,
    current_signups: 0,
    performance_length: 5,
    event_type: 'open-mic',
    signup_list_mode: 'bucket',
    current_performer_id: null,
    recurring_template_id: null,
    signup_opens: '2025-10-25T10:00:00Z', // Opens in the future
    signup_deadline: '2025-11-01T18:00:00Z',
    host_id: 2,
    host_name: 'Event Host',
    host_email: 'host@example.com',
    event_status: 'scheduled',
    started_at: null
  },
  {
    id: 6,
    title: 'Test Open Mic - Signups Open Now!',
    description: 'Perfect test event for trying out the signup system. All performers welcome!',
    venue_id: 1,
    venue_name: 'Test Venue',
    venue_address: '123 Test St, Boston, MA',
    date: '2025-10-05',
    start_time: '19:00',
    end_time: '22:00',
    max_performers: 10,
    current_signups: 3,
    performance_length: 5,
    event_type: 'open-mic',
    signup_list_mode: 'bucket',
    current_performer_id: null,
    recurring_template_id: null,
    signup_opens: '2025-09-28T09:00:00Z', // Already open
    signup_deadline: '2025-10-05T17:00:00Z', // 2 hours before event
    host_id: 1,
    host_name: 'Test User',
    host_email: 'test@example.com',
    event_status: 'scheduled',
    started_at: null
  },
  {
    id: 7,
    title: 'Past Open Mic Night',
    description: 'A completed open mic event for testing past performances.',
    venue_id: 1,
    venue_name: 'Test Venue',
    venue_address: '123 Test St, Boston, MA',
    date: '2025-09-25',
    start_time: '19:00',
    end_time: '22:00',
    max_performers: 10,
    current_signups: 5,
    performance_length: 5,
    event_type: 'open-mic',
    signup_list_mode: 'signup_order',
    current_performer_id: null,
    recurring_template_id: null,
    signup_opens: '2025-09-18T09:00:00Z',
    signup_deadline: '2025-09-25T17:00:00Z',
    host_id: 2,
    host_name: 'Event Host',
    host_email: 'host@example.com',
    event_status: 'finished',
    started_at: '2025-09-25T19:00:00Z'
  },
  {
    id: 8,
    title: 'Live Bucket Mic - Currently Running!',
    description: 'A bucket-style open mic that\'s currently live for testing the bucket interface.',
    venue_id: 1,
    venue_name: 'Test Venue',
    venue_address: '123 Test St, Boston, MA',
    date: '2025-10-02',
    start_time: '19:00',
    end_time: '22:00',
    max_performers: 8,
    current_signups: 4,
    performance_length: 5,
    event_type: 'open-mic',
    signup_list_mode: 'bucket',
    current_performer_id: 5,
    recurring_template_id: null,
    signup_opens: '2025-09-25T09:00:00Z',
    signup_deadline: '2025-10-02T17:00:00Z',
    host_id: 1,
    host_name: 'Test User',
    host_email: 'test@example.com',
    event_status: 'live',
    started_at: '2025-10-02T19:00:00Z'
  }
];

// Mock events endpoints
app.get('/api/events', (req, res) => {
  res.json(mockEvents);
});

// Get individual event by ID
app.get('/api/events/:id', (req, res) => {
  const eventId = parseInt(req.params.id);
  const event = mockEvents.find(e => e.id === eventId);
  
  if (!event) {
    return res.status(404).json({ message: 'Event not found' });
  }
  
  res.json(event);
});

// Get events by host
app.get('/api/events/host/:hostId', (req, res) => {
  const hostId = parseInt(req.params.hostId);
  const userEvents = mockEvents.filter(event => event.host_id === hostId);
  res.json(userEvents);
});

// Create event endpoint
app.post('/api/events', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  const token = authHeader.replace('Bearer ', '');
  const user = activeTokens[token];
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  const {
    title,
    description,
    venueId,
    date,
    startTime,
    endTime,
    maxPerformers,
    performanceLength,
    eventType,
    signupOpens,
    signupDeadline
  } = req.body;
  
  // Find venue name
  const venue = mockVenues.find(v => v.id === venueId);
  
  const newEvent = {
    id: Math.floor(Math.random() * 1000) + 100,
    title,
    description,
    venue_id: venueId,
    venue_name: venue?.name || 'Unknown Venue',
    venue_address: venue?.address || '',
    date,
    start_time: startTime,
    end_time: endTime,
    max_performers: maxPerformers,
    performance_length: performanceLength,
    event_type: eventType,
    signup_opens: signupOpens,
    signup_deadline: signupDeadline,
    host_id: user.id,
    host_name: user.name,
    current_signups: 0,
    created_at: new Date().toISOString()
  };
  
  // Add to mock events array
  mockEvents.push(newEvent);
  
  // Save to file
  saveEvents(mockEvents);
  
  res.status(201).json({
    message: 'Event created successfully',
    event: newEvent
  });
});

// Update event endpoint
app.put('/api/events/:id', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  const token = authHeader.replace('Bearer ', '');
  const user = activeTokens[token];
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  const eventId = parseInt(req.params.id);
  const eventIndex = mockEvents.findIndex(e => e.id === eventId);
  
  if (eventIndex === -1) {
    return res.status(404).json({ message: 'Event not found' });
  }
  
  const existingEvent = mockEvents[eventIndex];
  
  // Check if user owns this event
  if (existingEvent.host_id !== user.id) {
    return res.status(403).json({ message: 'Not authorized to update this event' });
  }
  
  const {
    title,
    description,
    venueId,
    date,
    startTime,
    endTime,
    maxPerformers,
    performanceLength,
    eventType,
    signupListMode,
    signupOpens,
    signupDeadline
  } = req.body;
  
  // Find venue name
  const venue = mockVenues.find(v => v.id === venueId);
  
  const updatedEvent = {
    ...existingEvent,
    title: title || existingEvent.title,
    description: description !== undefined ? description : existingEvent.description,
    venue_id: venueId || existingEvent.venue_id,
    venue_name: venue?.name || existingEvent.venue_name,
    venue_address: venue?.address || existingEvent.venue_address,
    date: date || existingEvent.date,
    start_time: startTime || existingEvent.start_time,
    end_time: endTime || existingEvent.end_time,
    max_performers: maxPerformers || existingEvent.max_performers,
    performance_length: performanceLength || existingEvent.performance_length,
    event_type: eventType || existingEvent.event_type,
    signup_list_mode: signupListMode || existingEvent.signup_list_mode,
    signup_opens: signupOpens !== undefined ? signupOpens : existingEvent.signup_opens,
    signup_deadline: signupDeadline !== undefined ? signupDeadline : existingEvent.signup_deadline,
    updated_at: new Date().toISOString()
  };
  
  mockEvents[eventIndex] = updatedEvent;
  
  // Save to file
  saveEvents(mockEvents);
  
  res.json({
    message: 'Event updated successfully',
    event: updatedEvent
  });
});

// Delete event endpoint
app.delete('/api/events/:id', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  const token = authHeader.replace('Bearer ', '');
  const user = activeTokens[token];
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  const eventId = parseInt(req.params.id);
  const eventIndex = mockEvents.findIndex(e => e.id === eventId);
  
  if (eventIndex === -1) {
    return res.status(404).json({ message: 'Event not found' });
  }
  
  const existingEvent = mockEvents[eventIndex];
  
  // Check if user owns this event
  if (existingEvent.host_id !== user.id) {
    return res.status(403).json({ message: 'Not authorized to delete this event' });
  }
  
  mockEvents.splice(eventIndex, 1);
  
  // Save to file
  saveEvents(mockEvents);
  
  res.json({ message: 'Event deleted successfully' });
});

// Mock users for testing
const mockUsers = {
  'test@example.com': {
    id: 1,
    email: 'test@example.com',
    name: 'Test User',
    performer_type: 'musician',
    bio: 'I love performing at open mics and hosting events!',
    role: 'user'
  },
  'host@example.com': {
    id: 2,
    email: 'host@example.com',
    name: 'Event Host',
    performer_type: 'comedian',
    bio: 'I run several venues in Boston and also perform comedy',
    role: 'user'
  },
  'admin@example.com': {
    id: 999,
    email: 'admin@example.com',
    name: 'God Mode Admin',
    performer_type: 'other',
    bio: 'System administrator with full access',
    role: 'super_admin'
  }
};

// Simple token to user mapping for testing
const activeTokens = {};

// Mock signups data
let mockSignups = loadedSignups.length > 0 ? loadedSignups : [
  // Signups for upcoming test event (event_id: 6)
  {
    id: 1,
    event_id: 6,
    user_id: 2,
    performance_name: 'Event Host',
    notes: 'Some observational humor about Boston',
    performance_type: 'comedy',
    status: 'confirmed',
    performance_order: 1,
    is_finished: false,
    is_current_performer: false,
    finished_at: null,
    created_at: '2025-09-29T10:00:00Z',
    user_name: 'Event Host'
  },
  {
    id: 2,
    event_id: 6,
    user_id: null,
    performance_name: 'Walk-in Singer - Acoustic Songs',
    notes: 'Original folk songs',
    performance_type: 'music',
    status: 'confirmed',
    performance_order: 2,
    is_finished: false,
    is_current_performer: false,
    finished_at: null,
    created_at: '2025-09-30T11:00:00Z',
    user_name: null
  },
  {
    id: 3,
    event_id: 6,
    user_id: 1,
    performance_name: 'Test User',
    notes: 'Testing the signup system',
    performance_type: 'music',
    status: 'confirmed',
    performance_order: 3,
    is_finished: false,
    is_current_performer: false,
    finished_at: null,
    created_at: '2025-10-01T12:00:00Z',
    user_name: 'Test User'
  },
  // Signups for past event (event_id: 7)
  {
    id: 4,
    event_id: 7,
    user_id: 1,
    performance_name: 'Test User',
    notes: 'My first open mic performance!',
    performance_type: 'music',
    status: 'performed',
    performance_order: 2,
    is_finished: true,
    is_current_performer: false,
    finished_at: '2025-09-25T19:30:00Z',
    created_at: '2025-09-20T15:00:00Z',
    user_name: 'Test User'
  },
  // Signups for live bucket event (event_id: 8)
  {
    id: 5,
    event_id: 8,
    user_id: 2,
    performance_name: 'Event Host',
    notes: 'Stand-up comedy set',
    performance_type: 'comedy',
    status: 'performing',
    performance_order: null,
    is_finished: false,
    is_current_performer: true,
    finished_at: null,
    created_at: '2025-09-28T14:00:00Z',
    user_name: 'Event Host'
  },
  {
    id: 6,
    event_id: 8,
    user_id: 1,
    performance_name: 'Test User',
    notes: 'Acoustic guitar songs',
    performance_type: 'music',
    status: 'confirmed',
    performance_order: null,
    is_finished: false,
    is_current_performer: false,
    finished_at: null,
    created_at: '2025-09-29T16:00:00Z',
    user_name: 'Test User'
  },
  {
    id: 7,
    event_id: 8,
    user_id: null,
    performance_name: 'Walk-in Poet - Spoken Word',
    notes: 'Original poetry about city life',
    performance_type: 'poetry',
    status: 'confirmed',
    performance_order: null,
    is_finished: false,
    is_current_performer: false,
    finished_at: null,
    created_at: '2025-10-01T18:00:00Z',
    user_name: null
  },
  {
    id: 8,
    event_id: 8,
    user_id: null,
    performance_name: 'Walk-in Comedian - Local Humor',
    notes: 'Boston-themed comedy',
    performance_type: 'comedy',
    status: 'performed',
    performance_order: null,
    is_finished: true,
    is_current_performer: false,
    finished_at: '2025-10-02T19:15:00Z',
    created_at: '2025-10-02T18:30:00Z',
    user_name: null
  },
  // Signups for upcoming events
  {
    id: 9,
    event_id: 1,
    user_id: 1,
    performance_name: 'Test User',
    notes: 'Trying out some new material',
    performance_type: 'music',
    status: 'confirmed',
    performance_order: 1,
    is_finished: false,
    is_current_performer: false,
    finished_at: null,
    created_at: '2025-10-02T08:00:00Z',
    user_name: 'Test User'
  }
];

// Mock auth endpoints
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  console.log('Login attempt:', { email, userExists: !!mockUsers[email] });
  
  if (password === 'password' && mockUsers[email]) {
    const token = `mock-jwt-token-${Date.now()}-${Math.random()}`;
    activeTokens[token] = mockUsers[email];
    
    console.log('Login successful for:', email);
    
    res.json({
      message: 'Login successful',
      token: token,
      user: mockUsers[email]
    });
  } else {
    console.log('Login failed for:', email);
    res.status(400).json({ message: 'Invalid credentials' });
  }
});

app.post('/api/auth/register', (req, res) => {
  const { email, name } = req.body;
  
  res.status(201).json({
    message: 'User created successfully',
    token: 'mock-jwt-token',
    user: {
      id: Math.floor(Math.random() * 1000) + 3,
      email,
      name,
      performer_type: req.body.performerType || null,
      bio: req.body.bio || null
    }
  });
});

// Mock protected route
app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  const token = authHeader.replace('Bearer ', '');
  const user = activeTokens[token];
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  res.json({ user });
});

// Update user profile
app.put('/api/auth/profile', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  const token = authHeader.replace('Bearer ', '');
  const user = activeTokens[token];
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  // Update user data
  const updates = req.body;
  const updatedUser = {
    ...user,
    name: updates.name || user.name,
    phone: updates.phone || user.phone,
    performer_type: updates.performerType || user.performer_type,
    bio: updates.bio || user.bio,
    instagram_handle: updates.instagramHandle || user.instagram_handle,
    twitter_handle: updates.twitterHandle || user.twitter_handle,
    tiktok_handle: updates.tiktokHandle || user.tiktok_handle,
    youtube_handle: updates.youtubeHandle || user.youtube_handle,
    website_url: updates.websiteUrl || user.website_url
  };
  
  // Update in mockUsers and activeTokens
  mockUsers[user.email] = updatedUser;
  activeTokens[token] = updatedUser;
  
  console.log('Profile updated for:', user.email, updates);
  
  res.json({
    message: 'Profile updated successfully',
    user: updatedUser
  });
});

// Mock venues data
let mockVenues = loadedVenues.length > 0 ? loadedVenues : [
  {
    id: 1,
    name: 'The Comedy Studio',
    address: '1238 Massachusetts Ave, Cambridge, MA',
    phone: '(617) 661-6507',
    email: 'info@thecomedystudio.com',
    description: 'Premier comedy venue in Harvard Square',
    capacity: 50,
    amenities: ['microphone', 'sound_system', 'stage_lighting'],
    owner_id: 2,
    owner_name: 'Event Host'
  },
  {
    id: 2,
    name: 'Club Passim',
    address: '47 Palmer St, Cambridge, MA',
    phone: '(617) 492-7679',
    email: 'info@clubpassim.org',
    description: 'Intimate folk music venue',
    capacity: 80,
    amenities: ['microphone', 'sound_system', 'piano'],
    owner_id: 2,
    owner_name: 'Event Host'
  }
];

// Mock venues endpoints
app.get('/api/venues', (req, res) => {
  res.json(mockVenues);
});

// Get venues by owner
app.get('/api/venues/owner/:ownerId', (req, res) => {
  const ownerId = parseInt(req.params.ownerId);
  const userVenues = mockVenues.filter(venue => venue.owner_id === ownerId);
  res.json(userVenues);
});

// Create venue endpoint
app.post('/api/venues', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  const token = authHeader.replace('Bearer ', '');
  const user = activeTokens[token];
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  const { name, address, phone, email, description, capacity, amenities } = req.body;
  
  const newVenue = {
    id: Math.floor(Math.random() * 1000) + 100,
    name,
    address,
    phone,
    email,
    description,
    capacity,
    amenities: amenities || [],
    owner_id: user.id,
    owner_name: user.name
  };
  
  // Add to mock venues array
  mockVenues.push(newVenue);
  
  // Save to file
  saveVenues(mockVenues);
  
  res.status(201).json({
    message: 'Venue created successfully',
    venue: newVenue
  });
});

// Mock recurring events endpoints
app.get('/api/recurring-events/venue/:venueId', (req, res) => {
  const mockTemplates = [
    {
      id: 1,
      venue_id: parseInt(req.params.venueId),
      venue_name: 'The Comedy Studio',
      title: 'Weekly Open Mic Night',
      description: 'Every Thursday night open mic',
      start_time: '20:00',
      end_time: '23:00',
      max_performers: 15,
      performance_length: 5,
      event_type: 'open-mic',
      day_of_week: 4, // Thursday
      signup_opens_hours_before: 168, // 1 week
      signup_deadline_hours_before: 2,
      is_active: true,
      created_by: 2,
      created_by_name: 'Event Host'
    }
  ];
  
  res.json(mockTemplates);
});

app.post('/api/recurring-events', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  const newTemplate = {
    id: Math.floor(Math.random() * 1000) + 10,
    ...req.body,
    is_active: true,
    created_by: 2,
    created_by_name: 'Event Host',
    created_at: new Date().toISOString()
  };
  
  res.status(201).json({
    message: 'Recurring event template created successfully',
    template: newTemplate
  });
});

// Generate events from recurring template
app.post('/api/recurring-events/:id/generate', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  const templateId = parseInt(req.params.id);
  const numberOfEvents = req.body.numberOfEvents || 4;
  
  // Find venue for the template
  const venue = mockVenues.find(v => v.id === 1); // Default to first venue for demo
  
  // Generate mock events
  const generatedEvents = [];
  const today = new Date();
  
  for (let i = 0; i < numberOfEvents; i++) {
    const eventDate = new Date(today);
    eventDate.setDate(eventDate.getDate() + (i * 7)); // Weekly events
    
    const newEvent = {
      id: Math.floor(Math.random() * 1000) + 200,
      title: 'Weekly Open Mic Night',
      description: 'Generated from recurring template',
      venue_id: venue?.id || 1,
      venue_name: venue?.name || 'Test Venue',
      venue_address: venue?.address || 'Test Address',
      date: eventDate.toISOString().split('T')[0],
      start_time: '20:00',
      end_time: '23:00',
      max_performers: 15,
      performance_length: 5,
      event_type: 'open-mic',
      signup_opens: new Date(eventDate.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      signup_deadline: new Date(eventDate.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      host_id: 2,
      host_name: 'Event Host',
      current_signups: 0,
      recurring_template_id: templateId,
      created_at: new Date().toISOString()
    };
    
    generatedEvents.push(newEvent);
    mockEvents.push(newEvent);
  }
  
  // Save to file
  saveEvents(mockEvents);
  
  res.json({
    message: `Generated ${generatedEvents.length} events successfully`,
    events: generatedEvents
  });
});

// Mock signups endpoints
app.get('/api/signups/my-signups', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  const token = authHeader.replace('Bearer ', '');
  const user = activeTokens[token];
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  const userSignups = mockSignups
    .filter(signup => signup.user_id === user.id)
    .map(signup => {
      const event = mockEvents.find(e => e.id === signup.event_id);
      return {
        ...signup,
        event_title: event?.title || 'Unknown Event',
        event_date: event?.date || null,
        venue_name: event?.venue_name || 'Unknown Venue'
      };
    });
  res.json(userSignups);
});

app.get('/api/signups/event/:eventId', (req, res) => {
  const eventId = parseInt(req.params.eventId);
  const eventSignups = mockSignups.filter(signup => signup.event_id === eventId);
  res.json(eventSignups);
});

app.post('/api/signups', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  const token = authHeader.replace('Bearer ', '');
  const user = activeTokens[token];
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  const { eventId, performanceName, notes, performanceType } = req.body;
  
  // Check if user already signed up
  const existingSignup = mockSignups.find(signup => 
    signup.event_id === eventId && signup.user_id === user.id
  );
  
  if (existingSignup) {
    return res.status(400).json({ message: 'User already signed up for this event' });
  }
  
  // Check event capacity
  const event = mockEvents.find(e => e.id === eventId);
  if (!event) {
    return res.status(404).json({ message: 'Event not found' });
  }
  
  const eventSignups = mockSignups.filter(signup => signup.event_id === eventId);
  if (eventSignups.length >= event.max_performers) {
    return res.status(400).json({ message: 'Event is full' });
  }
  
  // Create new signup
  const newSignup = {
    id: Math.max(...mockSignups.map(s => s.id), 0) + 1,
    event_id: eventId,
    user_id: user.id,
    performance_name: performanceName,
    notes: notes || null,
    performance_type: performanceType,
    status: 'confirmed',
    performance_order: null,
    is_finished: false,
    finished_at: null,
    created_at: new Date().toISOString(),
    user_name: user.name
  };
  
  mockSignups.push(newSignup);
  saveSignups(mockSignups);
  
  res.status(201).json({
    message: 'Signup created successfully',
    signup: newSignup
  });
});

app.delete('/api/signups/event/:eventId', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  const token = authHeader.replace('Bearer ', '');
  const user = activeTokens[token];
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  const eventId = parseInt(req.params.eventId);
  const signupIndex = mockSignups.findIndex(signup => 
    signup.event_id === eventId && signup.user_id === user.id
  );
  
  if (signupIndex === -1) {
    return res.status(404).json({ message: 'Signup not found' });
  }
  
  mockSignups.splice(signupIndex, 1);
  saveSignups(mockSignups);
  
  res.json({ message: 'Signup cancelled successfully' });
});

// Event management endpoints
app.post('/api/events/:id/start', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  const token = authHeader.replace('Bearer ', '');
  const user = activeTokens[token];
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  const eventId = parseInt(req.params.id);
  const eventIndex = mockEvents.findIndex(e => e.id === eventId);
  
  if (eventIndex === -1) {
    return res.status(404).json({ message: 'Event not found' });
  }
  
  const event = mockEvents[eventIndex];
  
  if (event.host_id !== user.id) {
    return res.status(403).json({ message: 'Not authorized to start this event' });
  }
  
  if (event.event_status !== 'scheduled') {
    return res.status(400).json({ message: 'Event is not in scheduled status' });
  }
  
  event.event_status = 'live';
  event.started_at = new Date().toISOString();
  
  saveEvents(mockEvents);
  
  res.json({
    message: 'Event started successfully',
    event: event
  });
});

app.post('/api/events/:id/finish', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  const token = authHeader.replace('Bearer ', '');
  const user = activeTokens[token];
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  const eventId = parseInt(req.params.id);
  const eventIndex = mockEvents.findIndex(e => e.id === eventId);
  
  if (eventIndex === -1) {
    return res.status(404).json({ message: 'Event not found' });
  }
  
  const event = mockEvents[eventIndex];
  
  if (event.host_id !== user.id) {
    return res.status(403).json({ message: 'Not authorized to finish this event' });
  }
  
  if (event.event_status !== 'live') {
    return res.status(400).json({ message: 'Event is not live' });
  }
  
  event.event_status = 'finished';
  
  saveEvents(mockEvents);
  
  res.json({
    message: 'Event finished successfully',
    event: event
  });
});

// Set current performer (bucket mode)
app.post('/api/events/:id/set-current-performer', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  const token = authHeader.replace('Bearer ', '');
  const user = activeTokens[token];
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  const eventId = parseInt(req.params.id);
  const { signupId } = req.body;
  
  const eventIndex = mockEvents.findIndex(e => e.id === eventId);
  
  if (eventIndex === -1) {
    return res.status(404).json({ message: 'Event not found' });
  }
  
  const event = mockEvents[eventIndex];
  
  if (event.host_id !== user.id) {
    return res.status(403).json({ message: 'Not authorized to manage this event' });
  }
  
  if (event.event_status !== 'live') {
    return res.status(400).json({ message: 'Event must be live to set current performer' });
  }
  
  // Clear previous current performer
  mockSignups.forEach(signup => {
    if (signup.event_id === eventId) {
      signup.is_current_performer = false;
    }
  });
  
  // Set new current performer
  const signupIndex = mockSignups.findIndex(s => s.id === signupId);
  if (signupIndex !== -1) {
    mockSignups[signupIndex].is_current_performer = true;
    mockSignups[signupIndex].status = 'performing';
  }
  
  event.current_performer_id = signupId;
  saveEvents(mockEvents);
  saveSignups(mockSignups);
  
  res.json({
    message: 'Current performer set successfully',
    event: event
  });
});

// Randomize performer order (random mode)
app.post('/api/events/:id/randomize-order', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  const token = authHeader.replace('Bearer ', '');
  const user = activeTokens[token];
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  const eventId = parseInt(req.params.id);
  const event = mockEvents.find(e => e.id === eventId);
  
  if (!event) {
    return res.status(404).json({ message: 'Event not found' });
  }
  
  if (event.host_id !== user.id) {
    return res.status(403).json({ message: 'Not authorized to manage this event' });
  }
  
  const eventSignups = mockSignups.filter(signup => signup.event_id === eventId);
  
  // Shuffle the signups and assign new order
  const shuffled = [...eventSignups].sort(() => Math.random() - 0.5);
  shuffled.forEach((signup, index) => {
    const signupIndex = mockSignups.findIndex(s => s.id === signup.id);
    if (signupIndex !== -1) {
      mockSignups[signupIndex].performance_order = index + 1;
    }
  });
  
  saveSignups(mockSignups);
  
  res.json({
    message: 'Performer order randomized successfully',
    signups: shuffled
  });
});

// Search users for co-host selection
app.get('/api/users/search', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  const token = authHeader.replace('Bearer ', '');
  const user = activeTokens[token];
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  const { q } = req.query;
  if (!q || q.length < 2) {
    return res.json([]);
  }
  
  const searchTerm = q.toLowerCase();
  const matchingUsers = Object.values(mockUsers)
    .filter(u => 
      u.id !== user.id && // Don't include current user
      (u.name.toLowerCase().includes(searchTerm) || 
       u.email.toLowerCase().includes(searchTerm))
    )
    .map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      performer_type: u.performer_type
    }));
  
  res.json(matchingUsers);
});

// Add co-host to event
app.post('/api/events/:id/cohosts', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  const token = authHeader.replace('Bearer ', '');
  const user = activeTokens[token];
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  const eventId = parseInt(req.params.id);
  const { userId } = req.body;
  
  const event = mockEvents.find(e => e.id === eventId);
  if (!event) {
    return res.status(404).json({ message: 'Event not found' });
  }
  
  if (event.host_id !== user.id) {
    return res.status(403).json({ message: 'Not authorized to manage this event' });
  }
  
  const cohostUser = Object.values(mockUsers).find(u => u.id === userId);
  if (!cohostUser) {
    return res.status(404).json({ message: 'User not found' });
  }
  
  // Initialize cohosts array if it doesn't exist
  if (!event.cohosts) {
    event.cohosts = [];
  }
  
  // Check if user is already a co-host
  if (event.cohosts.some(c => c.user_id === userId)) {
    return res.status(400).json({ message: 'User is already a co-host' });
  }
  
  const newCohost = {
    id: Math.max(...(event.cohosts.map(c => c.id) || [0]), 0) + 1,
    event_id: eventId,
    user_id: userId,
    user_name: cohostUser.name,
    user_email: cohostUser.email,
    added_by: user.id,
    created_at: new Date().toISOString()
  };
  
  event.cohosts.push(newCohost);
  saveEvents(mockEvents);
  
  res.json({
    message: 'Co-host added successfully',
    cohost: newCohost
  });
});

// Remove co-host from event
app.delete('/api/events/:id/cohosts/:cohostId', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  const token = authHeader.replace('Bearer ', '');
  const user = activeTokens[token];
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  const eventId = parseInt(req.params.id);
  const cohostId = parseInt(req.params.cohostId);
  
  const event = mockEvents.find(e => e.id === eventId);
  if (!event) {
    return res.status(404).json({ message: 'Event not found' });
  }
  
  if (event.host_id !== user.id) {
    return res.status(403).json({ message: 'Not authorized to manage this event' });
  }
  
  if (!event.cohosts) {
    return res.status(404).json({ message: 'Co-host not found' });
  }
  
  const cohostIndex = event.cohosts.findIndex(c => c.id === cohostId);
  if (cohostIndex === -1) {
    return res.status(404).json({ message: 'Co-host not found' });
  }
  
  event.cohosts.splice(cohostIndex, 1);
  saveEvents(mockEvents);
  
  res.json({ message: 'Co-host removed successfully' });
});

// Performer management endpoints
app.put('/api/signups/:id/finish', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  const token = authHeader.replace('Bearer ', '');
  const user = activeTokens[token];
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  const signupId = parseInt(req.params.id);
  const signupIndex = mockSignups.findIndex(s => s.id === signupId);
  
  if (signupIndex === -1) {
    return res.status(404).json({ message: 'Signup not found' });
  }
  
  const signup = mockSignups[signupIndex];
  signup.is_finished = true;
  signup.finished_at = new Date().toISOString();
  
  saveSignups(mockSignups);
  
  res.json({
    message: 'Performer marked as finished',
    signup: signup
  });
});

app.put('/api/signups/:id/unfinish', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  const token = authHeader.replace('Bearer ', '');
  const user = activeTokens[token];
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  const signupId = parseInt(req.params.id);
  const signupIndex = mockSignups.findIndex(s => s.id === signupId);
  
  if (signupIndex === -1) {
    return res.status(404).json({ message: 'Signup not found' });
  }
  
  const signup = mockSignups[signupIndex];
  signup.is_finished = false;
  signup.finished_at = null;
  
  saveSignups(mockSignups);
  
  res.json({
    message: 'Performer unmarked as finished',
    signup: signup
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// Admin endpoints
const isAdmin = (user) => {
  return user && (user.role === 'admin' || user.role === 'super_admin');
};

const isModerator = (user) => {
  return user && (user.role === 'moderator' || user.role === 'admin' || user.role === 'super_admin');
};

const isSuperAdmin = (user) => {
  return user && user.role === 'super_admin';
};

// Get all users (admin only)
app.get('/api/admin/users', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  const token = authHeader.replace('Bearer ', '');
  const user = activeTokens[token];
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  if (!isAdmin(user)) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  
  res.json(Object.values(mockUsers));
});

// Delete user (admin only)
app.delete('/api/admin/users/:id', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  const token = authHeader.replace('Bearer ', '');
  const user = activeTokens[token];
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  if (!isAdmin(user)) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  
  const userId = parseInt(req.params.id);
  const targetUser = Object.values(mockUsers).find(u => u.id === userId);
  
  if (!targetUser) {
    return res.status(404).json({ message: 'User not found' });
  }
  
  // Role-based deletion restrictions
  if (targetUser.role === 'super_admin' && targetUser.id !== user.id) {
    return res.status(403).json({ message: 'Cannot delete other super admin users' });
  }
  
  if (targetUser.role === 'admin' && user.role !== 'super_admin' && targetUser.id !== user.id) {
    return res.status(403).json({ message: 'Only super admins can delete admin users' });
  }
  
  if ((targetUser.role === 'moderator' || targetUser.role === 'admin') && !isModerator(user)) {
    return res.status(403).json({ message: 'Insufficient permissions to delete this user' });
  }
  
  // Remove user from mockUsers object
  const userEmail = Object.keys(mockUsers).find(email => mockUsers[email].id === userId);
  if (userEmail) {
    delete mockUsers[userEmail];
  }
  
  // Remove user's active tokens
  Object.keys(activeTokens).forEach(token => {
    if (activeTokens[token].id === userId) {
      delete activeTokens[token];
    }
  });
  
  res.json({ message: 'User deleted successfully' });
});

// Get all events (admin only)
app.get('/api/admin/events', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  const token = authHeader.replace('Bearer ', '');
  const user = activeTokens[token];
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  if (!isAdmin(user)) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  
  res.json(mockEvents);
});

// Delete event (admin only)
app.delete('/api/admin/events/:id', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  const token = authHeader.replace('Bearer ', '');
  const user = activeTokens[token];
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  if (!isAdmin(user)) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  
  const eventId = parseInt(req.params.id);
  const eventIndex = mockEvents.findIndex(e => e.id === eventId);
  
  if (eventIndex === -1) {
    return res.status(404).json({ message: 'Event not found' });
  }
  
  // Remove event
  mockEvents.splice(eventIndex, 1);
  
  // Remove related signups
  mockSignups = mockSignups.filter(s => s.event_id !== eventId);
  
  res.json({ message: 'Event deleted successfully' });
});

// Get all venues (admin only)
app.get('/api/admin/venues', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  const token = authHeader.replace('Bearer ', '');
  const user = activeTokens[token];
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  if (!isAdmin(user)) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  
  res.json(mockVenues);
});

// Delete venue (admin only)
app.delete('/api/admin/venues/:id', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  const token = authHeader.replace('Bearer ', '');
  const user = activeTokens[token];
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  if (!isAdmin(user)) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  
  const venueId = parseInt(req.params.id);
  const venueIndex = mockVenues.findIndex(v => v.id === venueId);
  
  if (venueIndex === -1) {
    return res.status(404).json({ message: 'Venue not found' });
  }
  
  // Remove venue
  mockVenues.splice(venueIndex, 1);
  
  // Remove related events
  mockEvents = mockEvents.filter(e => e.venue_id !== venueId);
  
  res.json({ message: 'Venue deleted successfully' });
});

// Update user role (super admin only)
app.put('/api/admin/users/:id/role', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  const token = authHeader.replace('Bearer ', '');
  const user = activeTokens[token];
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  if (!isSuperAdmin(user)) {
    return res.status(403).json({ message: 'Super admin access required' });
  }
  
  const userId = parseInt(req.params.id);
  const { role } = req.body;
  
  if (!['user', 'moderator', 'admin', 'super_admin'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }
  
  const targetUser = Object.values(mockUsers).find(u => u.id === userId);
  
  if (!targetUser) {
    return res.status(404).json({ message: 'User not found' });
  }
  
  // Prevent changing own role
  if (targetUser.id === user.id) {
    return res.status(403).json({ message: 'Cannot change your own role' });
  }
  
  // Update user role in mockUsers object
  const userEmail = Object.keys(mockUsers).find(email => mockUsers[email].id === userId);
  if (userEmail) {
    mockUsers[userEmail].role = role;
    
    // Update active tokens if user is logged in
    Object.keys(activeTokens).forEach(token => {
      if (activeTokens[token].id === userId) {
        activeTokens[token].role = role;
      }
    });
  }
  
  res.json({ 
    message: 'User role updated successfully',
    user: mockUsers[userEmail]
  });
});

// Mock invites data
let mockInvites = [];
let inviteIdCounter = 1;

// Send invite to user (host only)
app.post('/api/events/:id/invites', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  const token = authHeader.replace('Bearer ', '');
  const user = activeTokens[token];
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  const eventId = parseInt(req.params.id);
  const { userId } = req.body;
  
  const event = mockEvents.find(e => e.id === eventId);
  if (!event) {
    return res.status(404).json({ message: 'Event not found' });
  }
  
  // Check if user is host or co-host
  const isAuthorized = event.host_id === user.id || 
    (event.cohosts && event.cohosts.some(cohost => cohost.user_id === user.id));
  
  if (!isAuthorized) {
    return res.status(403).json({ message: 'Not authorized to send invites for this event' });
  }
  
  const targetUser = Object.values(mockUsers).find(u => u.id === userId);
  if (!targetUser) {
    return res.status(404).json({ message: 'User not found' });
  }
  
  // Check if invite already exists
  const existingInvite = mockInvites.find(i => i.event_id === eventId && i.user_id === userId);
  if (existingInvite) {
    return res.status(400).json({ message: 'User already invited to this event' });
  }
  
  const invite = {
    id: inviteIdCounter++,
    event_id: eventId,
    user_id: userId,
    user_name: targetUser.name,
    user_email: targetUser.email,
    status: 'pending',
    invited_by: user.id,
    invited_at: new Date().toISOString()
  };
  
  mockInvites.push(invite);
  
  res.json({
    message: 'Invite sent successfully',
    invite
  });
});

// Get invites for an event (host only)
app.get('/api/events/:id/invites', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  const token = authHeader.replace('Bearer ', '');
  const user = activeTokens[token];
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  const eventId = parseInt(req.params.id);
  const event = mockEvents.find(e => e.id === eventId);
  
  if (!event) {
    return res.status(404).json({ message: 'Event not found' });
  }
  
  // Check if user is host or co-host
  const isAuthorized = event.host_id === user.id || 
    (event.cohosts && event.cohosts.some(cohost => cohost.user_id === user.id));
  
  if (!isAuthorized) {
    return res.status(403).json({ message: 'Not authorized to view invites for this event' });
  }
  
  const eventInvites = mockInvites.filter(i => i.event_id === eventId);
  res.json(eventInvites);
});

// Respond to invite
app.put('/api/invites/:id/respond', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  const token = authHeader.replace('Bearer ', '');
  const user = activeTokens[token];
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  const inviteId = parseInt(req.params.id);
  const { response, performanceName, notes } = req.body;
  
  const invite = mockInvites.find(i => i.id === inviteId);
  if (!invite) {
    return res.status(404).json({ message: 'Invite not found' });
  }
  
  if (invite.user_id !== user.id) {
    return res.status(403).json({ message: 'Not authorized to respond to this invite' });
  }
  
  if (invite.status !== 'pending') {
    return res.status(400).json({ message: 'Invite has already been responded to' });
  }
  
  // Update invite
  invite.status = response;
  invite.responded_at = new Date().toISOString();
  if (performanceName) invite.performance_name = performanceName;
  if (notes) invite.notes = notes;
  
  // If accepted, create a signup
  if (response === 'accepted') {
    const signup = {
      id: mockSignups.length + 1,
      event_id: invite.event_id,
      user_id: user.id,
      performance_name: performanceName || `${user.name}'s Performance`,
      notes: notes || '',
      performance_type: 'music', // Default
      status: 'confirmed',
      performance_order: null,
      is_finished: false,
      is_current_performer: false,
      finished_at: null,
      created_at: new Date().toISOString(),
      user_name: user.name
    };
    
    mockSignups.push(signup);
  }
  
  res.json({
    message: `Invite ${response} successfully`,
    invite
  });
});

// Update performer order and lengths (host only)
app.put('/api/events/:id/performer-order', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  const token = authHeader.replace('Bearer ', '');
  const user = activeTokens[token];
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  const eventId = parseInt(req.params.id);
  const { performerOrder } = req.body;
  
  const event = mockEvents.find(e => e.id === eventId);
  if (!event) {
    return res.status(404).json({ message: 'Event not found' });
  }
  
  // Check if user is host or co-host
  const isAuthorized = event.host_id === user.id || 
    (event.cohosts && event.cohosts.some(cohost => cohost.user_id === user.id));
  
  if (!isAuthorized) {
    return res.status(403).json({ message: 'Not authorized to manage this event' });
  }
  
  // Update performer order and lengths
  performerOrder.forEach(({ signupId, order, performanceLength }) => {
    const signup = mockSignups.find(s => s.id === signupId && s.event_id === eventId);
    if (signup) {
      signup.performance_order = order;
      if (performanceLength !== undefined) {
        signup.individual_performance_length = performanceLength;
      }
    }
  });
  
  // Return updated signups for this event
  const eventSignups = mockSignups.filter(s => s.event_id === eventId && s.status === 'confirmed');
  
  res.json({
    message: 'Performer order updated successfully',
    signups: eventSignups
  });
});

// Update individual performer length (host only)
app.put('/api/signups/:id/performance-length', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  const token = authHeader.replace('Bearer ', '');
  const user = activeTokens[token];
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  const signupId = parseInt(req.params.id);
  const { performanceLength } = req.body;
  
  const signup = mockSignups.find(s => s.id === signupId);
  if (!signup) {
    return res.status(404).json({ message: 'Signup not found' });
  }
  
  const event = mockEvents.find(e => e.id === signup.event_id);
  if (!event) {
    return res.status(404).json({ message: 'Event not found' });
  }
  
  // Check if user is host or co-host
  const isAuthorized = event.host_id === user.id || 
    (event.cohosts && event.cohosts.some(cohost => cohost.user_id === user.id));
  
  if (!isAuthorized) {
    return res.status(403).json({ message: 'Not authorized to manage this event' });
  }
  
  signup.individual_performance_length = performanceLength;
  
  res.json({
    message: 'Performance length updated successfully',
    signup
  });
});

// Send invitation email
app.post('/api/invitations/send', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  const token = authHeader.replace('Bearer ', '');
  const user = activeTokens[token];
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  const { email, inviterName, inviterEmail, type, message } = req.body;
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }
  
  // In a real application, this would send an actual email
  // For now, we'll just log it and return success
  console.log('📧 Invitation Email Would Be Sent:');
  console.log(`To: ${email}`);
  console.log(`From: ${inviterName} (${inviterEmail})`);
  console.log(`Type: ${type}`);
  console.log(`Message: ${message}`);
  console.log('---');
  
  // Simulate email sending delay
  setTimeout(() => {
    res.json({
      message: 'Invitation sent successfully',
      email,
      type,
      sentAt: new Date().toISOString()
    });
  }, 500);
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 Test server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🧪 API test: http://localhost:${PORT}/api/test`);
});

module.exports = app;