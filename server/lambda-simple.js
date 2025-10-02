// Simple Boston Open Mics API for AWS Lambda (without external dependencies)
exports.handler = async (event, context) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  const { path, httpMethod, body, queryStringParameters, headers } = event;
  
  // CORS headers
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  };
  
  // Handle OPTIONS requests
  if (httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }
  
  try {
    // Parse body if it exists
    let requestBody = {};
    if (body) {
      try {
        requestBody = JSON.parse(body);
      } catch (e) {
        requestBody = {};
      }
    }
    
    // Simple UUID generator (no external dependency)
    const generateId = () => {
      return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    };
    
    // Simple password hashing (for demo - in production use proper crypto)
    const hashPassword = (password) => {
      // Simple hash for demo - in production use proper crypto
      return 'hashed_' + Buffer.from(password).toString('base64');
    };
    
    const verifyPassword = (password, hash) => {
      return hashPassword(password) === hash;
    };
    
    // Mock data (in production, this would come from DynamoDB)
    const mockUsers = [
      {
        id: 'user_1',
        name: 'John Doe',
        email: 'john@example.com',
        password: hashPassword('password123'),
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
        id: 'user_2',
        name: 'Jane Smith',
        email: 'jane@example.com',
        password: hashPassword('password123'),
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
    
    const mockVenues = [
      {
        id: 'venue_1',
        name: 'The Cantab Lounge',
        address: '738 Massachusetts Ave, Cambridge, MA 02139',
        description: 'Historic venue with a great open mic scene',
        capacity: 100,
        owner_id: 'user_1',
        created_at: '2024-10-01T19:00:00.000Z',
        updated_at: '2024-10-01T19:00:00.000Z'
      },
      {
        id: 'venue_2',
        name: 'Club Passim',
        address: '47 Palmer St, Cambridge, MA 02138',
        description: 'Intimate folk music venue',
        capacity: 80,
        owner_id: 'user_2',
        created_at: '2024-10-01T19:00:00.000Z',
        updated_at: '2024-10-01T19:00:00.000Z'
      }
    ];
    
    const mockEvents = [
      {
        id: 'event_1',
        title: 'Monday Night Open Mic',
        description: 'Weekly open mic night featuring local talent',
        venue_id: 'venue_1',
        date: '2025-10-06',
        start_time: '19:00:00',
        end_time: '22:00:00',
        max_performers: 15,
        performance_length: 5,
        event_type: 'open-mic',
        signup_list_mode: 'signup_order',
        signup_opens: null,
        signup_deadline: null,
        host_id: 'user_1',
        event_status: 'upcoming',
        created_at: '2024-10-01T19:00:00.000Z',
        updated_at: '2024-10-01T19:00:00.000Z'
      },
      {
        id: 'event_2',
        title: 'Comedy Showcase',
        description: 'Monthly comedy showcase',
        venue_id: 'venue_2',
        date: '2025-10-15',
        start_time: '20:00:00',
        end_time: '23:00:00',
        max_performers: 10,
        performance_length: 7,
        event_type: 'showcase',
        signup_list_mode: 'random_order',
        signup_opens: null,
        signup_deadline: null,
        host_id: 'user_2',
        event_status: 'upcoming',
        created_at: '2024-10-01T19:00:00.000Z',
        updated_at: '2024-10-01T19:00:00.000Z'
      }
    ];
    
    let mockSignups = [
      {
        id: 'signup_1',
        event_id: 'event_1',
        user_id: 'user_1',
        performance_name: 'Acoustic Set',
        performance_type: 'music',
        notes: 'Playing original songs',
        status: 'confirmed',
        performance_order: 1,
        is_current_performer: false,
        is_finished: false,
        finished_at: null,
        individual_performance_length: null,
        created_at: '2024-10-01T19:00:00.000Z',
        updated_at: '2024-10-01T19:00:00.000Z'
      }
    ];
    
    // Active tokens (in memory)
    const activeTokens = global.activeTokens || {};
    global.activeTokens = activeTokens;
    
    // Helper function to authenticate
    const authenticate = () => {
      const authHeader = headers.Authorization || headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
      }
      
      const token = authHeader.replace('Bearer ', '');
      return activeTokens[token] || null;
    };
    
    // Routes
    
    // Health check
    if (path === '/health' && httpMethod === 'GET') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          status: 'OK',
          message: 'Boston Open Mics API is running!',
          timestamp: new Date().toISOString(),
          version: 'simple-v1.0'
        })
      };
    }
    
    // API info endpoint
    if (path === '/api' && httpMethod === 'GET') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          name: 'Boston Open Mics API',
          version: 'simple-v1.0',
          status: 'running',
          timestamp: new Date().toISOString(),
          endpoints: {
            auth: [
              'POST /api/auth/login',
              'POST /api/auth/register',
              'GET /api/auth/profile',
              'GET /api/auth/me'
            ],
            events: [
              'GET /api/events',
              'GET /api/events/{id}'
            ],
            venues: [
              'GET /api/venues'
            ],
            signups: [
              'GET /api/signups/event/{eventId}',
              'POST /api/signups'
            ],
            users: [
              'GET /api/users/search'
            ]
          }
        })
      };
    }
    
    // Auth endpoints
    if (path === '/api/auth/login' && httpMethod === 'POST') {
      const { email, password } = requestBody;
      
      const user = mockUsers.find(u => u.email === email);
      if (!user || !verifyPassword(password, user.password)) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Invalid credentials' })
        };
      }
      
      const token = `token_${Date.now()}_${Math.random()}`;
      activeTokens[token] = user;
      
      const { password: _, ...userResponse } = user;
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          token,
          user: userResponse
        })
      };
    }
    
    if (path === '/api/auth/register' && httpMethod === 'POST') {
      const { name, email, password, phone, performerType, bio } = requestBody;
      
      if (mockUsers.find(u => u.email === email)) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'User already exists' })
        };
      }
      
      const newUser = {
        id: generateId(),
        name,
        email,
        password: hashPassword(password),
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
      
      const { password: _, ...userResponse } = newUser;
      
      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({
          token,
          user: userResponse
        })
      };
    }
    
    if (path === '/api/auth/profile' && httpMethod === 'GET') {
      const user = authenticate();
      if (!user) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Unauthorized' })
        };
      }
      
      const { password: _, ...userResponse } = user;
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(userResponse)
      };
    }
    
    if (path === '/api/auth/me' && httpMethod === 'GET') {
      const user = authenticate();
      if (!user) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Unauthorized' })
        };
      }
      
      const { password: _, ...userResponse } = user;
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ user: userResponse })
      };
    }
    
    // Events endpoints
    if (path === '/api/events' && httpMethod === 'GET') {
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
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(eventsWithDetails)
      };
    }
    
    if (path.match(/^\/api\/events\/[^\/]+$/) && httpMethod === 'GET') {
      const eventId = path.split('/')[3];
      const event = mockEvents.find(e => e.id === eventId);
      
      if (!event) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Event not found' })
        };
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
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(eventWithDetails)
      };
    }
    
    // Venues endpoints
    if (path === '/api/venues' && httpMethod === 'GET') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(mockVenues)
      };
    }
    
    // Signups endpoints
    if (path.match(/^\/api\/signups\/event\/[^\/]+$/) && httpMethod === 'GET') {
      const eventId = path.split('/')[4];
      const eventSignups = mockSignups.filter(s => s.event_id === eventId);
      
      const signupsWithUserInfo = eventSignups.map(signup => {
        const user = mockUsers.find(u => u.id === signup.user_id);
        return {
          ...signup,
          user_name: user?.name || 'Unknown User'
        };
      });
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(signupsWithUserInfo)
      };
    }
    
    if (path === '/api/signups' && httpMethod === 'POST') {
      const user = authenticate();
      if (!user) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Unauthorized' })
        };
      }
      
      const { eventId, performanceName, performanceType, notes } = requestBody;
      
      const event = mockEvents.find(e => e.id === eventId);
      if (!event) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Event not found' })
        };
      }
      
      // Check if user already signed up
      const existingSignup = mockSignups.find(s => 
        s.event_id === eventId && s.user_id === user.id
      );
      
      if (existingSignup) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Already signed up for this event' })
        };
      }
      
      const newSignup = {
        id: generateId(),
        event_id: eventId,
        user_id: user.id,
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
      
      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({
          message: 'Successfully signed up for event',
          signup: newSignup
        })
      };
    }
    
    // User search endpoint
    if (path === '/api/users/search' && httpMethod === 'GET') {
      const user = authenticate();
      if (!user) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Unauthorized' })
        };
      }
      
      const query = queryStringParameters?.q;
      if (!query || query.length < 2) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify([])
        };
      }
      
      const results = mockUsers.filter(u => 
        u.name.toLowerCase().includes(query.toLowerCase()) ||
        u.email.toLowerCase().includes(query.toLowerCase())
      ).map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        performer_type: u.performer_type
      }));
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(results)
      };
    }
    
    // Invitation endpoint
    if (path === '/api/invitations/send' && httpMethod === 'POST') {
      const user = authenticate();
      if (!user) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Unauthorized' })
        };
      }
      
      const { email, inviterName, inviterEmail, type, message } = requestBody;
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Invalid email format' })
        };
      }
      
      // Log invitation (in production, would send actual email)
      console.log('📧 Invitation Email Would Be Sent:');
      console.log(`To: ${email}`);
      console.log(`From: ${inviterName} (${inviterEmail})`);
      console.log(`Type: ${type}`);
      console.log(`Message: ${message}`);
      console.log('---');
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          message: 'Invitation sent successfully',
          email,
          type,
          sentAt: new Date().toISOString()
        })
      };
    }
    
    // 404 for unmatched routes
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Route not found',
        path: path,
        method: httpMethod
      })
    };
    
  } catch (error) {
    console.error('Lambda error:', error);
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Internal server error',
        error: error.message
      })
    };
  }
};