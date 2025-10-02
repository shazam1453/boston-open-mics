const serverless = require('serverless-http');
const express = require('express');

const app = express();

// Basic middleware
app.use(express.json());

// Add CORS headers manually
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Routes
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Express + Lambda working!',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Boston Open Mics API is running!',
    timestamp: new Date().toISOString()
  });
});

// Mock data
const mockUsers = [
  {
    id: 1,
    name: 'John Doe',
    email: 'john@example.com',
    role: 'user'
  }
];

const activeTokens = {};

// Auth endpoints
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  const user = mockUsers.find(u => u.email === email);
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  
  const token = `token_${Date.now()}_${Math.random()}`;
  activeTokens[token] = user;
  
  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
});

// Events endpoint
app.get('/api/events', (req, res) => {
  res.json([
    {
      id: 1,
      title: 'Monday Night Open Mic',
      description: 'Weekly open mic night',
      venue_name: 'The Cantab Lounge',
      host_name: 'John Doe',
      date: '2024-10-28',
      start_time: '19:00:00',
      end_time: '22:00:00',
      current_signups: 0,
      max_performers: 15
    }
  ]);
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    message: 'Internal server error',
    error: err.message 
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    message: 'Route not found',
    path: req.originalUrl 
  });
});

module.exports.handler = serverless(app);