// Manual Lambda handler without serverless-http
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
    
    // Route handling
    if (path === '/health' && httpMethod === 'GET') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          status: 'OK',
          message: 'Lambda is working!',
          timestamp: new Date().toISOString()
        })
      };
    }
    
    if (path === '/api/test' && httpMethod === 'GET') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          message: 'Boston Open Mics API is running!',
          timestamp: new Date().toISOString()
        })
      };
    }
    
    if (path === '/api/events' && httpMethod === 'GET') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify([
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
        ])
      };
    }
    
    if (path === '/api/auth/login' && httpMethod === 'POST') {
      const { email, password } = requestBody;
      
      // Mock user
      const mockUser = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        role: 'user'
      };
      
      if (email === 'john@example.com') {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            token: `token_${Date.now()}`,
            user: mockUser
          })
        };
      } else {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({
            message: 'Invalid credentials'
          })
        };
      }
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