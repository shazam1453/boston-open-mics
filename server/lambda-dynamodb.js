const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// Use AWS SDK from Lambda runtime environment (no bundling needed)
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

// Table names from environment variables
const USERS_TABLE = process.env.USERS_TABLE;
const VENUES_TABLE = process.env.VENUES_TABLE;
const EVENTS_TABLE = process.env.EVENTS_TABLE;
const SIGNUPS_TABLE = process.env.SIGNUPS_TABLE;

// Active tokens (in memory - in production, use Redis or DynamoDB)
const activeTokens = global.activeTokens || {};
global.activeTokens = activeTokens;

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
    
    // Helper function to authenticate
    const authenticate = () => {
      const authHeader = headers.Authorization || headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
      }
      
      const token = authHeader.replace('Bearer ', '');
      return activeTokens[token] || null;
    };
    
    // Health check
    if (path === '/health' && httpMethod === 'GET') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          status: 'OK',
          message: 'Boston Open Mics API with DynamoDB!',
          timestamp: new Date().toISOString(),
          version: 'dynamodb-v1.0',
          tables: {
            users: USERS_TABLE,
            venues: VENUES_TABLE,
            events: EVENTS_TABLE,
            signups: SIGNUPS_TABLE
          }
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
          version: 'dynamodb-v1.0',
          status: 'running',
          timestamp: new Date().toISOString(),
          database: 'DynamoDB',
          endpoints: {
            auth: [
              'POST /api/auth/login',
              'POST /api/auth/register',
              'GET /api/auth/profile',
              'GET /api/auth/me',
              'PUT /api/auth/profile',
              'DELETE /api/auth/delete-account'
            ],
            events: [
              'GET /api/events',
              'GET /api/events/{id}',
              'POST /api/events',
              'PUT /api/events/{id}',
              'POST /api/events/{id}/randomize-order'
            ],
            venues: [
              'GET /api/venues',
              'POST /api/venues'
            ],
            signups: [
              'GET /api/signups/event/{eventId}',
              'POST /api/signups',
              'GET /api/signups/my-signups',
              'PUT /api/signups/event/{eventId}/order',
              'PUT /api/signups/{id}/finish',
              'PUT /api/signups/{id}/unfinish'
            ],
            users: [
              'GET /api/users/search'
            ],
            admin: [
              'GET /api/admin/users',
              'DELETE /api/admin/users/{id}',
              'PUT /api/admin/users/{id}/role',
              'GET /api/admin/events',
              'DELETE /api/admin/events/{id}',
              'GET /api/admin/venues',
              'DELETE /api/admin/venues/{id}'
            ],
            invitations: [
              'POST /api/invitations/send'
            ]
          }
        })
      };
    }
    
    // Auth endpoints
    if (path === '/api/auth/register' && httpMethod === 'POST') {
      const { name, email, password, phone, performerType, bio } = requestBody;
      
      // Check if user already exists
      const existingUser = await dynamodb.query({
        TableName: USERS_TABLE,
        IndexName: 'EmailIndex',
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: {
          ':email': email
        }
      }).promise();
      
      if (existingUser.Items.length > 0) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'User already exists' })
        };
      }
      
      // Hash password using Node.js crypto
      const salt = crypto.randomBytes(16).toString('hex');
      const hashedPassword = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex') + ':' + salt;
      
      const newUser = {
        id: uuidv4(),
        name,
        email,
        password: hashedPassword,
        phone: phone || '',
        performer_type: performerType || '',
        bio: bio || '',
        role: 'user',
        instagram_handle: '',
        twitter_handle: '',
        tiktok_handle: '',
        youtube_handle: '',
        website_url: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      await dynamodb.put({
        TableName: USERS_TABLE,
        Item: newUser
      }).promise();
      
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
    
    if (path === '/api/auth/login' && httpMethod === 'POST') {
      const { email, password } = requestBody;
      
      const result = await dynamodb.query({
        TableName: USERS_TABLE,
        IndexName: 'EmailIndex',
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: {
          ':email': email
        }
      }).promise();
      
      if (result.Items.length === 0) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Invalid credentials' })
        };
      }
      
      const user = result.Items[0];
      // Verify password using Node.js crypto
      const [hash, salt] = user.password.split(':');
      const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
      const passwordMatch = hash === verifyHash;
      
      if (!passwordMatch) {
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
    
    // Delete own account endpoint
    if (path === '/api/auth/delete-account' && httpMethod === 'DELETE') {
      const user = authenticate();
      if (!user) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Unauthorized' })
        };
      }
      
      // Only super admins can delete their own accounts
      if (user.role !== 'super_admin') {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Only super admins can delete their own accounts' })
        };
      }
      
      try {
        // Delete the user from DynamoDB
        await dynamodb.delete({
          TableName: USERS_TABLE,
          Key: { id: user.id }
        }).promise();
        
        // Remove all active tokens for this user
        Object.keys(activeTokens).forEach(token => {
          if (activeTokens[token].id === user.id) {
            delete activeTokens[token];
          }
        });
        
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ 
            message: 'Account deleted successfully',
            deletedAt: new Date().toISOString()
          })
        };
      } catch (error) {
        console.error('Error deleting account:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Failed to delete account' })
        };
      }
    }
    
    // Events endpoints
    if (path === '/api/events' && httpMethod === 'GET') {
      const result = await dynamodb.scan({
        TableName: EVENTS_TABLE
      }).promise();
      
      // Enrich events with venue and host info
      const eventsWithDetails = await Promise.all(result.Items.map(async (event) => {
        const [venueResult, hostResult, signupsResult] = await Promise.all([
          dynamodb.get({
            TableName: VENUES_TABLE,
            Key: { id: event.venue_id }
          }).promise(),
          dynamodb.get({
            TableName: USERS_TABLE,
            Key: { id: event.host_id }
          }).promise(),
          dynamodb.query({
            TableName: SIGNUPS_TABLE,
            IndexName: 'EventIndex',
            KeyConditionExpression: 'event_id = :event_id',
            ExpressionAttributeValues: {
              ':event_id': event.id
            }
          }).promise()
        ]);
        
        return {
          ...event,
          venue_name: venueResult.Item?.name || 'Unknown Venue',
          host_name: hostResult.Item?.name || 'Unknown Host',
          current_signups: signupsResult.Items.length
        };
      }));
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(eventsWithDetails)
      };
    }
    
    if (path.match(/^\/api\/events\/[^\/]+$/) && httpMethod === 'GET') {
      const eventId = path.split('/')[3];
      
      const result = await dynamodb.get({
        TableName: EVENTS_TABLE,
        Key: { id: eventId }
      }).promise();
      
      if (!result.Item) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Event not found' })
        };
      }
      
      const event = result.Item;
      
      // Get venue, host, and signups info
      const [venueResult, hostResult, signupsResult] = await Promise.all([
        dynamodb.get({
          TableName: VENUES_TABLE,
          Key: { id: event.venue_id }
        }).promise(),
        dynamodb.get({
          TableName: USERS_TABLE,
          Key: { id: event.host_id }
        }).promise(),
        dynamodb.query({
          TableName: SIGNUPS_TABLE,
          IndexName: 'EventIndex',
          KeyConditionExpression: 'event_id = :event_id',
          ExpressionAttributeValues: {
            ':event_id': eventId
          }
        }).promise()
      ]);
      
      const eventWithDetails = {
        ...event,
        venue_name: venueResult.Item?.name || 'Unknown Venue',
        host_name: hostResult.Item?.name || 'Unknown Host',
        current_signups: signupsResult.Items.length
      };
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(eventWithDetails)
      };
    }
    
    if (path === '/api/events' && httpMethod === 'POST') {
      const user = authenticate();
      if (!user) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Unauthorized' })
        };
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
      } = requestBody;

      const newEvent = {
        id: uuidv4(),
        title,
        description: description || '',
        venue_id: venueId.toString(),
        date,
        start_time: startTime,
        end_time: endTime,
        max_performers: parseInt(maxPerformers),
        performance_length: parseInt(performanceLength),
        event_type: eventType,
        signup_list_mode: signupListMode || 'signup_order',
        signup_opens: signupOpens || null,
        signup_deadline: signupDeadline || null,
        host_id: user.id,
        event_status: 'upcoming',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await dynamodb.put({
        TableName: EVENTS_TABLE,
        Item: newEvent
      }).promise();

      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({ event: newEvent })
      };
    }
    
    // Venues endpoints
    if (path === '/api/venues' && httpMethod === 'GET') {
      const result = await dynamodb.scan({
        TableName: VENUES_TABLE
      }).promise();
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(result.Items)
      };
    }
    
    if (path === '/api/venues' && httpMethod === 'POST') {
      const user = authenticate();
      if (!user) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Unauthorized' })
        };
      }
      
      const { name, address, description, capacity } = requestBody;
      
      const newVenue = {
        id: uuidv4(),
        name,
        address,
        description: description || '',
        capacity: capacity ? parseInt(capacity) : null,
        owner_id: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      await dynamodb.put({
        TableName: VENUES_TABLE,
        Item: newVenue
      }).promise();
      
      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify(newVenue)
      };
    }
    
    // Signups endpoints
    if (path.match(/^\/api\/signups\/event\/[^\/]+$/) && httpMethod === 'GET') {
      const eventId = path.split('/')[4];
      
      const result = await dynamodb.query({
        TableName: SIGNUPS_TABLE,
        IndexName: 'EventIndex',
        KeyConditionExpression: 'event_id = :event_id',
        ExpressionAttributeValues: {
          ':event_id': eventId
        }
      }).promise();
      
      // Enrich with user info
      const signupsWithUserInfo = await Promise.all(result.Items.map(async (signup) => {
        const userResult = await dynamodb.get({
          TableName: USERS_TABLE,
          Key: { id: signup.user_id }
        }).promise();
        
        return {
          ...signup,
          user_name: userResult.Item?.name || 'Unknown User'
        };
      }));
      
      // Sort by performance_order, then by created_at
      signupsWithUserInfo.sort((a, b) => {
        if (a.performance_order && b.performance_order) {
          return a.performance_order - b.performance_order;
        }
        if (a.performance_order) return -1;
        if (b.performance_order) return 1;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
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
      
      // Check if event exists
      const eventResult = await dynamodb.get({
        TableName: EVENTS_TABLE,
        Key: { id: eventId.toString() }
      }).promise();
      
      if (!eventResult.Item) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Event not found' })
        };
      }
      
      // Check if user already signed up
      const existingSignup = await dynamodb.query({
        TableName: SIGNUPS_TABLE,
        IndexName: 'EventIndex',
        KeyConditionExpression: 'event_id = :event_id',
        FilterExpression: 'user_id = :user_id',
        ExpressionAttributeValues: {
          ':event_id': eventId.toString(),
          ':user_id': user.id
        }
      }).promise();
      
      if (existingSignup.Items.length > 0) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Already signed up for this event' })
        };
      }
      
      const newSignup = {
        id: uuidv4(),
        event_id: eventId.toString(),
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
      
      await dynamodb.put({
        TableName: SIGNUPS_TABLE,
        Item: newSignup
      }).promise();
      
      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({
          message: 'Successfully signed up for event',
          signup: newSignup
        })
      };
    }
    
    if (path === '/api/signups/my' && httpMethod === 'GET') {
      const user = authenticate();
      if (!user) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Unauthorized' })
        };
      }
      
      const result = await dynamodb.query({
        TableName: SIGNUPS_TABLE,
        IndexName: 'UserIndex',
        KeyConditionExpression: 'user_id = :user_id',
        ExpressionAttributeValues: {
          ':user_id': user.id
        }
      }).promise();
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(result.Items)
      };
    }
    
    if (path === '/api/signups/my-signups' && httpMethod === 'GET') {
      const user = authenticate();
      if (!user) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Unauthorized' })
        };
      }
      
      const result = await dynamodb.query({
        TableName: SIGNUPS_TABLE,
        IndexName: 'UserIndex',
        KeyConditionExpression: 'user_id = :user_id',
        ExpressionAttributeValues: {
          ':user_id': user.id
        }
      }).promise();
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(result.Items)
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
      
      // Scan users table for matches (in production, use a search index)
      const result = await dynamodb.scan({
        TableName: USERS_TABLE,
        FilterExpression: 'contains(#name, :query) OR contains(email, :query)',
        ExpressionAttributeNames: {
          '#name': 'name'
        },
        ExpressionAttributeValues: {
          ':query': query.toLowerCase()
        }
      }).promise();
      
      const results = result.Items.map(u => ({
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
    
    // Reorder signups endpoint
    if (path.match(/^\/api\/signups\/reorder\/[^\/]+$/) && httpMethod === 'PUT') {
      const user = authenticate();
      if (!user) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Unauthorized' })
        };
      }
      
      const eventId = path.split('/')[4];
      const { signupIds } = requestBody;
      
      // Update performance order for each signup
      const updatePromises = signupIds.map((signupId, index) => {
        return dynamodb.update({
          TableName: SIGNUPS_TABLE,
          Key: { id: signupId },
          UpdateExpression: 'SET performance_order = :order, updated_at = :updated_at',
          ExpressionAttributeValues: {
            ':order': index + 1,
            ':updated_at': new Date().toISOString()
          }
        }).promise();
      });
      
      await Promise.all(updatePromises);
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Performance order updated successfully' })
      };
    }
    
    // Alternative reorder endpoint for events
    if (path.match(/^\/api\/signups\/event\/[^\/]+\/order$/) && httpMethod === 'PUT') {
      const user = authenticate();
      if (!user) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Unauthorized' })
        };
      }
      
      const eventId = path.split('/')[4];
      const { signupIds } = requestBody;
      
      // Update performance order for each signup
      const updatePromises = signupIds.map((signupId, index) => {
        return dynamodb.update({
          TableName: SIGNUPS_TABLE,
          Key: { id: signupId },
          UpdateExpression: 'SET performance_order = :order, updated_at = :updated_at',
          ExpressionAttributeValues: {
            ':order': index + 1,
            ':updated_at': new Date().toISOString()
          }
        }).promise();
      });
      
      await Promise.all(updatePromises);
      
      // Get updated signups
      const updatedSignupsResult = await dynamodb.query({
        TableName: SIGNUPS_TABLE,
        IndexName: 'EventIndex',
        KeyConditionExpression: 'event_id = :event_id',
        ExpressionAttributeValues: {
          ':event_id': eventId
        }
      }).promise();
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ signups: updatedSignupsResult.Items })
      };
    }
    
    // Profile update endpoint
    if (path === '/api/auth/profile' && httpMethod === 'PUT') {
      const user = authenticate();
      if (!user) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Unauthorized' })
        };
      }
      
      const updates = requestBody;
      const allowedFields = ['name', 'phone', 'performer_type', 'bio', 'instagram_handle', 'twitter_handle', 'tiktok_handle', 'youtube_handle', 'website_url'];
      
      // Filter only allowed fields
      const filteredUpdates = {};
      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
          filteredUpdates[key] = updates[key];
        }
      });
      
      if (Object.keys(filteredUpdates).length === 0) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'No valid fields to update' })
        };
      }
      
      // Build update expression
      const updateExpressions = [];
      const expressionAttributeValues = {};
      const expressionAttributeNames = {};
      
      Object.keys(filteredUpdates).forEach(key => {
        updateExpressions.push(`#${key} = :${key}`);
        expressionAttributeValues[`:${key}`] = filteredUpdates[key];
        expressionAttributeNames[`#${key}`] = key;
      });
      
      updateExpressions.push('#updated_at = :updated_at');
      expressionAttributeValues[':updated_at'] = new Date().toISOString();
      expressionAttributeNames['#updated_at'] = 'updated_at';
      
      await dynamodb.update({
        TableName: USERS_TABLE,
        Key: { id: user.id },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeValues: expressionAttributeValues,
        ExpressionAttributeNames: expressionAttributeNames
      }).promise();
      
      // Get updated user
      const updatedUserResult = await dynamodb.get({
        TableName: USERS_TABLE,
        Key: { id: user.id }
      }).promise();
      
      const { password: _, ...userResponse } = updatedUserResult.Item;
      
      // Update token
      activeTokens[Object.keys(activeTokens).find(token => activeTokens[token].id === user.id)] = updatedUserResult.Item;
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ user: userResponse })
      };
    }
    
    // Event update endpoint
    if (path.match(/^\/api\/events\/[^\/]+$/) && httpMethod === 'PUT') {
      const user = authenticate();
      if (!user) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Unauthorized' })
        };
      }
      
      const eventId = path.split('/')[3];
      
      // Check if event exists and user is host
      const eventResult = await dynamodb.get({
        TableName: EVENTS_TABLE,
        Key: { id: eventId }
      }).promise();
      
      if (!eventResult.Item) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Event not found' })
        };
      }
      
      if (eventResult.Item.host_id !== user.id && user.role !== 'admin' && user.role !== 'super_admin') {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Not authorized to update this event' })
        };
      }
      
      const updates = requestBody;
      const allowedFields = ['title', 'description', 'venue_id', 'date', 'start_time', 'end_time', 'max_performers', 'performance_length', 'event_type', 'signup_list_mode', 'signup_opens', 'signup_deadline'];
      
      // Filter only allowed fields
      const filteredUpdates = {};
      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
          filteredUpdates[key] = updates[key];
        }
      });
      
      if (Object.keys(filteredUpdates).length === 0) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'No valid fields to update' })
        };
      }
      
      // Build update expression
      const updateExpressions = [];
      const expressionAttributeValues = {};
      const expressionAttributeNames = {};
      
      Object.keys(filteredUpdates).forEach(key => {
        updateExpressions.push(`#${key} = :${key}`);
        expressionAttributeValues[`:${key}`] = filteredUpdates[key];
        expressionAttributeNames[`#${key}`] = key;
      });
      
      updateExpressions.push('#updated_at = :updated_at');
      expressionAttributeValues[':updated_at'] = new Date().toISOString();
      expressionAttributeNames['#updated_at'] = 'updated_at';
      
      await dynamodb.update({
        TableName: EVENTS_TABLE,
        Key: { id: eventId },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeValues: expressionAttributeValues,
        ExpressionAttributeNames: expressionAttributeNames
      }).promise();
      
      // Get updated event
      const updatedEventResult = await dynamodb.get({
        TableName: EVENTS_TABLE,
        Key: { id: eventId }
      }).promise();
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ event: updatedEventResult.Item })
      };
    }
    
    // Admin endpoints
    if (path === '/api/admin/users' && httpMethod === 'GET') {
      const user = authenticate();
      if (!user || !['admin', 'super_admin', 'moderator'].includes(user.role)) {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Admin access required' })
        };
      }
      
      const result = await dynamodb.scan({
        TableName: USERS_TABLE
      }).promise();
      
      const users = result.Items.map(u => {
        const { password: _, ...userWithoutPassword } = u;
        return userWithoutPassword;
      });
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(users)
      };
    }
    
    if (path.match(/^\/api\/admin\/users\/[^\/]+$/) && httpMethod === 'DELETE') {
      const user = authenticate();
      if (!user || !['admin', 'super_admin'].includes(user.role)) {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Admin access required' })
        };
      }
      
      const userId = path.split('/')[4];
      
      await dynamodb.delete({
        TableName: USERS_TABLE,
        Key: { id: userId }
      }).promise();
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'User deleted successfully' })
      };
    }
    
    if (path.match(/^\/api\/admin\/users\/[^\/]+\/role$/) && httpMethod === 'PUT') {
      const user = authenticate();
      if (!user || user.role !== 'super_admin') {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Super admin access required' })
        };
      }
      
      const userId = path.split('/')[4];
      const { role } = requestBody;
      
      const validRoles = ['user', 'moderator', 'admin', 'super_admin'];
      if (!validRoles.includes(role)) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Invalid role' })
        };
      }
      
      await dynamodb.update({
        TableName: USERS_TABLE,
        Key: { id: userId },
        UpdateExpression: 'SET #role = :role, updated_at = :updated_at',
        ExpressionAttributeNames: {
          '#role': 'role'
        },
        ExpressionAttributeValues: {
          ':role': role,
          ':updated_at': new Date().toISOString()
        }
      }).promise();
      
      const updatedUserResult = await dynamodb.get({
        TableName: USERS_TABLE,
        Key: { id: userId }
      }).promise();
      
      const { password: _, ...userResponse } = updatedUserResult.Item;
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ user: userResponse })
      };
    }
    
    if (path === '/api/admin/events' && httpMethod === 'GET') {
      const user = authenticate();
      if (!user || !['admin', 'super_admin', 'moderator'].includes(user.role)) {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Admin access required' })
        };
      }
      
      const result = await dynamodb.scan({
        TableName: EVENTS_TABLE
      }).promise();
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(result.Items)
      };
    }
    
    if (path.match(/^\/api\/admin\/events\/[^\/]+$/) && httpMethod === 'DELETE') {
      const user = authenticate();
      if (!user || !['admin', 'super_admin'].includes(user.role)) {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Admin access required' })
        };
      }
      
      const eventId = path.split('/')[4];
      
      await dynamodb.delete({
        TableName: EVENTS_TABLE,
        Key: { id: eventId }
      }).promise();
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Event deleted successfully' })
      };
    }
    
    if (path === '/api/admin/venues' && httpMethod === 'GET') {
      const user = authenticate();
      if (!user || !['admin', 'super_admin', 'moderator'].includes(user.role)) {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Admin access required' })
        };
      }
      
      const result = await dynamodb.scan({
        TableName: VENUES_TABLE
      }).promise();
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(result.Items)
      };
    }
    
    if (path.match(/^\/api\/admin\/venues\/[^\/]+$/) && httpMethod === 'DELETE') {
      const user = authenticate();
      if (!user || !['admin', 'super_admin'].includes(user.role)) {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Admin access required' })
        };
      }
      
      const venueId = path.split('/')[4];
      
      await dynamodb.delete({
        TableName: VENUES_TABLE,
        Key: { id: venueId }
      }).promise();
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Venue deleted successfully' })
      };
    }
    
    // Signup management endpoints
    if (path.match(/^\/api\/signups\/[^\/]+\/finish$/) && httpMethod === 'PUT') {
      const user = authenticate();
      if (!user) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Unauthorized' })
        };
      }
      
      const signupId = path.split('/')[3];
      
      await dynamodb.update({
        TableName: SIGNUPS_TABLE,
        Key: { id: signupId },
        UpdateExpression: 'SET is_finished = :finished, finished_at = :finished_at, updated_at = :updated_at',
        ExpressionAttributeValues: {
          ':finished': true,
          ':finished_at': new Date().toISOString(),
          ':updated_at': new Date().toISOString()
        }
      }).promise();
      
      const updatedSignupResult = await dynamodb.get({
        TableName: SIGNUPS_TABLE,
        Key: { id: signupId }
      }).promise();
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ signup: updatedSignupResult.Item })
      };
    }
    
    if (path.match(/^\/api\/signups\/[^\/]+\/unfinish$/) && httpMethod === 'PUT') {
      const user = authenticate();
      if (!user) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Unauthorized' })
        };
      }
      
      const signupId = path.split('/')[3];
      
      await dynamodb.update({
        TableName: SIGNUPS_TABLE,
        Key: { id: signupId },
        UpdateExpression: 'SET is_finished = :finished, finished_at = :finished_at, updated_at = :updated_at',
        ExpressionAttributeValues: {
          ':finished': false,
          ':finished_at': null,
          ':updated_at': new Date().toISOString()
        }
      }).promise();
      
      const updatedSignupResult = await dynamodb.get({
        TableName: SIGNUPS_TABLE,
        Key: { id: signupId }
      }).promise();
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ signup: updatedSignupResult.Item })
      };
    }
    
    // Event randomize order endpoint
    if (path.match(/^\/api\/events\/[^\/]+\/randomize-order$/) && httpMethod === 'POST') {
      const user = authenticate();
      if (!user) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Unauthorized' })
        };
      }
      
      const eventId = path.split('/')[3];
      
      // Get all signups for the event
      const signupsResult = await dynamodb.query({
        TableName: SIGNUPS_TABLE,
        IndexName: 'EventIndex',
        KeyConditionExpression: 'event_id = :event_id',
        ExpressionAttributeValues: {
          ':event_id': eventId
        }
      }).promise();
      
      // Randomize the order
      const signups = signupsResult.Items;
      for (let i = signups.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [signups[i], signups[j]] = [signups[j], signups[i]];
      }
      
      // Update performance order for each signup
      const updatePromises = signups.map((signup, index) => {
        return dynamodb.update({
          TableName: SIGNUPS_TABLE,
          Key: { id: signup.id },
          UpdateExpression: 'SET performance_order = :order, updated_at = :updated_at',
          ExpressionAttributeValues: {
            ':order': index + 1,
            ':updated_at': new Date().toISOString()
          }
        }).promise();
      });
      
      await Promise.all(updatePromises);
      
      // Get updated signups
      const updatedSignupsResult = await dynamodb.query({
        TableName: SIGNUPS_TABLE,
        IndexName: 'EventIndex',
        KeyConditionExpression: 'event_id = :event_id',
        ExpressionAttributeValues: {
          ':event_id': eventId
        }
      }).promise();
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ signups: updatedSignupsResult.Items })
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