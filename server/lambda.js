const serverless = require('serverless-http');
const express = require('express');
const cors = require('cors');

const app = express();

// Basic middleware
app.use(cors());
app.use(express.json());

// In-memory data storage for Lambda (resets on each cold start)
let mockVenues = [
  {
    id: 1,
    name: 'The Cantab Lounge',
    address: '738 Massachusetts Ave, Cambridge, MA 02139',
    description: 'Historic venue with a great open mic scene',
    capacity: 100,
    owner_id: 1,
    created_at: '2024-10-01T19:00:00.000Z',
    updated_at: '2024-10-01T19:00:00.000Z'
  },
  {
    id: 2,
    name: 'Club Passim',
    address: '47 Palmer St, Cambridge, MA 02138',
    description: 'Intimate folk music venue',
    capacity: 80,
    owner_id: 2,
    created_at: '2024-10-01T19:00:00.000Z',
    updated_at: '2024-10-01T19:00:00.000Z'
  }
];

let mockEvents = [
  {
    id: 1,
    title: 'Monday Night Open Mic',
    description: 'Weekly open mic night featuring local talent',
    venue_id: 1,
    date: '2024-10-28',
    start_time: '19:00:00',
    end_time: '22:00:00',
    max_performers: 15,
    performance_length: 5,
    event_type: 'open-mic',
    signup_list_mode: 'signup_order',
    signup_opens: null,
    signup_deadline: null,
    host_id: 1,
    event_status: 'upcoming',
    created_at: '2024-10-01T19:00:00.000Z',
    updated_at: '2024-10-01T19:00:00.000Z'
  }
];

let mockSignups = [];

// Mock users data (in-memory for Lambda)
const mockUsers = [
  {
    id: 1,
    name: 'John Doe',
    email: 'john@example.com',
    password: '$2b$10$hash', // In real app, this would be properly hashed
    phone: '555-0123',
    performer_type: 'musician',
    bio: 'Local musician and open mic enthusiast',
    role: 'user',
    instagram_handle: 'johndoe_music',
    twitter_handle: 'johndoe',
    tiktok_handle: '',
    youtube_handle: 'johndoemusic',
    website_url: 'https://johndoe.com'
  },
  {
    id: 2,
    name: 'Jane Smith',
    email: 'jane@example.com',
    password: '$2b$10$hash',
    phone: '555-0124',
    performer_type: 'comedian',
    bio: 'Stand-up comedian and event host',
    role: 'admin',
    instagram_handle: 'janesmith_comedy',
    twitter_handle: 'janesmith',
    tiktok_handle: 'janesmith_comedy',
    youtube_handle: '',
    website_url: ''
  }
];

// Active tokens (in-memory for Lambda)
const activeTokens = {};

// Helper functions (no file saving in Lambda - data is ephemeral)
const saveData = () => {
  // In Lambda, data is stored in memory and resets on cold starts
  // For production, you'd use DynamoDB or another persistent storage
  console.log('Data saved to memory');
};

// Health check
app.get('/health', (req, res) => {
  try {
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      environment: 'lambda'
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/test', (req, res) => {
  try {
    res.json({ 
      message: 'Boston Open Mics API is running on AWS Lambda!',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Test endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Authentication endpoints
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  const user = mockUsers.find(u => u.email === email);
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  
  // In a real app, you'd verify the password hash
  const token = `token_${Date.now()}_${Math.random()}`;
  activeTokens[token] = user;
  
  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      performer_type: user.performer_type,
      bio: user.bio,
      phone: user.phone,
      instagram_handle: user.instagram_handle,
      twitter_handle: user.twitter_handle,
      tiktok_handle: user.tiktok_handle,
      youtube_handle: user.youtube_handle,
      website_url: user.website_url
    }
  });
});

app.post('/api/auth/register', (req, res) => {
  const { name, email, password, phone, performerType, bio } = req.body;
  
  if (mockUsers.find(u => u.email === email)) {
    return res.status(400).json({ message: 'User already exists' });
  }
  
  const newUser = {
    id: mockUsers.length + 1,
    name,
    email,
    password: '$2b$10$hash', // In real app, hash the password
    phone: phone || '',
    performer_type: performerType || '',
    bio: bio || '',
    role: 'user',
    instagram_handle: '',
    twitter_handle: '',
    tiktok_handle: '',
    youtube_handle: '',
    website_url: ''
  };
  
  mockUsers.push(newUser);
  
  const token = `token_${Date.now()}_${Math.random()}`;
  activeTokens[token] = newUser;
  
  res.status(201).json({
    token,
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      performer_type: newUser.performer_type,
      bio: newUser.bio,
      phone: newUser.phone,
      instagram_handle: newUser.instagram_handle,
      twitter_handle: newUser.twitter_handle,
      tiktok_handle: newUser.tiktok_handle,
      youtube_handle: newUser.youtube_handle,
      website_url: newUser.website_url
    }
  });
});

// Middleware to check authentication
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  const token = authHeader.replace('Bearer ', '');
  const user = activeTokens[token];
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  req.user = user;
  next();
};

// Events endpoints
app.get('/api/events', (req, res) => {
  const eventsWithDetails = mockEvents.map(event => {
    const venue = mockVenues.find(v => v.id === event.venue_id);
    const host = mockUsers.find(u => u.id === event.host_id);
    const eventSignups = mockSignups.filter(s => s.event_id === event.id);
    
    return {
      ...event,
      venue_name: venue?.name || 'Unknown Venue',
      host_name: host?.name || 'Unknown Host',
      current_signups: eventSignups.length
    };
  });
  
  res.json(eventsWithDetails);
});

app.get('/api/events/:id', (req, res) => {
  const eventId = parseInt(req.params.id);
  const event = mockEvents.find(e => e.id === eventId);
  
  if (!event) {
    return res.status(404).json({ message: 'Event not found' });
  }
  
  const venue = mockVenues.find(v => v.id === event.venue_id);
  const host = mockUsers.find(u => u.id === event.host_id);
  const eventSignups = mockSignups.filter(s => s.event_id === event.id);
  
  const eventWithDetails = {
    ...event,
    venue_name: venue?.name || 'Unknown Venue',
    host_name: host?.name || 'Unknown Host',
    current_signups: eventSignups.length
  };
  
  res.json(eventWithDetails);
});

app.post('/api/events', authenticateToken, (req, res) => {
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

  const newEvent = {
    id: mockEvents.length + 1,
    title,
    description: description || '',
    venue_id: parseInt(venueId),
    date,
    start_time: startTime,
    end_time: endTime,
    max_performers: parseInt(maxPerformers),
    performance_length: parseInt(performanceLength),
    event_type: eventType,
    signup_list_mode: signupListMode || 'signup_order',
    signup_opens: signupOpens || null,
    signup_deadline: signupDeadline || null,
    host_id: req.user.id,
    event_status: 'upcoming',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  mockEvents.push(newEvent);
  saveData();

  res.status(201).json(newEvent);
});

// Venues endpoints
app.get('/api/venues', (req, res) => {
  res.json(mockVenues);
});

app.post('/api/venues', authenticateToken, (req, res) => {
  const { name, address, description, capacity } = req.body;
  
  const newVenue = {
    id: mockVenues.length + 1,
    name,
    address,
    description: description || '',
    capacity: capacity ? parseInt(capacity) : null,
    owner_id: req.user.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  mockVenues.push(newVenue);
  saveData();
  
  res.status(201).json(newVenue);
});

// Signups endpoints
app.get('/api/signups/event/:eventId', (req, res) => {
  const eventId = parseInt(req.params.eventId);
  const eventSignups = mockSignups.filter(s => s.event_id === eventId);
  
  const signupsWithUserInfo = eventSignups.map(signup => {
    const user = mockUsers.find(u => u.id === signup.user_id);
    return {
      ...signup,
      user_name: user?.name || 'Unknown User'
    };
  });
  
  res.json(signupsWithUserInfo);
});

app.post('/api/signups', authenticateToken, (req, res) => {
  const { eventId, performanceName, performanceType, notes } = req.body;
  
  const event = mockEvents.find(e => e.id === parseInt(eventId));
  if (!event) {
    return res.status(404).json({ message: 'Event not found' });
  }
  
  // Check if user already signed up
  const existingSignup = mockSignups.find(s => 
    s.event_id === parseInt(eventId) && s.user_id === req.user.id
  );
  
  if (existingSignup) {
    return res.status(400).json({ message: 'Already signed up for this event' });
  }
  
  const newSignup = {
    id: mockSignups.length + 1,
    event_id: parseInt(eventId),
    user_id: req.user.id,
    performance_name: performanceName,
    performance_type: performanceType,
    notes: notes || '',
    status: 'confirmed',
    performance_order: null,
    is_current_performer: false,
    is_finished: false,
    finished_at: null,
    individual_performance_length: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  mockSignups.push(newSignup);
  saveData();
  
  res.status(201).json({
    message: 'Successfully signed up for event',
    signup: newSignup
  });
});

// User search endpoint
app.get('/api/users/search', authenticateToken, (req, res) => {
  const query = req.query.q;
  if (!query || query.length < 2) {
    return res.json([]);
  }
  
  const results = mockUsers.filter(user => 
    user.name.toLowerCase().includes(query.toLowerCase()) ||
    user.email.toLowerCase().includes(query.toLowerCase())
  ).map(user => ({
    id: user.id,
    name: user.name,
    email: user.email,
    performer_type: user.performer_type
  }));
  
  res.json(results);
});

// Profile endpoints
app.get('/api/auth/profile', authenticateToken, (req, res) => {
  res.json({
    id: req.user.id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role,
    performer_type: req.user.performer_type,
    bio: req.user.bio,
    phone: req.user.phone,
    instagram_handle: req.user.instagram_handle,
    twitter_handle: req.user.twitter_handle,
    tiktok_handle: req.user.tiktok_handle,
    youtube_handle: req.user.youtube_handle,
    website_url: req.user.website_url
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(500).json({ 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Export the serverless handler
module.exports.handler = serverless(app);