const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// Import email and token services
const emailService = require('./services/emailService');
const tokenService = require('./services/tokenService');

// Use AWS SDK from Lambda runtime environment (no bundling needed)
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const ses = new AWS.SES({ region: process.env.SES_REGION || 'us-east-2' });

// Table names from environment variables
const USERS_TABLE = process.env.USERS_TABLE;
const VENUES_TABLE = process.env.VENUES_TABLE;
const EVENTS_TABLE = process.env.EVENTS_TABLE;
const SIGNUPS_TABLE = process.env.SIGNUPS_TABLE;
const CONVERSATIONS_TABLE = process.env.CONVERSATIONS_TABLE;
const MESSAGES_TABLE = process.env.MESSAGES_TABLE;

// Active tokens (in memory - in production, use Redis or DynamoDB)
const activeTokens = global.activeTokens || {};
global.activeTokens = activeTokens;

// Email helper function
const sendEmail = async (to, subject, htmlBody, textBody) => {
  const fromEmail = process.env.SES_FROM_EMAIL || 'noreply@bostonopenmic.com';
  
  const params = {
    Source: fromEmail,
    Destination: {
      ToAddresses: [to]
    },
    Message: {
      Subject: {
        Data: subject,
        Charset: 'UTF-8'
      },
      Body: {
        Html: {
          Data: htmlBody,
          Charset: 'UTF-8'
        },
        Text: {
          Data: textBody,
          Charset: 'UTF-8'
        }
      }
    }
  };

  try {
    const result = await ses.sendEmail(params).promise();
    console.log('✅ Email sent successfully:', result.MessageId);
    return { success: true, messageId: result.MessageId };
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    return { success: false, error: error.message };
  }
};

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
              'PUT /api/auth/change-password',
              'POST /api/auth/request-password-reset',
              'POST /api/auth/reset-password',
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
            ],
            chat: [
              'GET /api/chat/conversations',
              'POST /api/chat/conversations',
              'GET /api/chat/conversations/{id}/messages',
              'POST /api/chat/conversations/{id}/messages',
              'PUT /api/chat/messages/{id}/read'
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
    
    // Change password endpoint (for logged-in users)
    if (path === '/api/auth/change-password' && httpMethod === 'PUT') {
      const user = authenticate();
      if (!user) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Unauthorized' })
        };
      }
      
      const { currentPassword, newPassword } = requestBody;
      
      if (!currentPassword || !newPassword) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Current password and new password are required' })
        };
      }
      
      if (newPassword.length < 6) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'New password must be at least 6 characters long' })
        };
      }
      
      try {
        // Get current user from database to verify current password
        const userResult = await dynamodb.get({
          TableName: USERS_TABLE,
          Key: { id: user.id }
        }).promise();
        
        if (!userResult.Item) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'User not found' })
          };
        }
        
        // Verify current password
        const [hash, salt] = userResult.Item.password.split(':');
        const verifyHash = crypto.pbkdf2Sync(currentPassword, salt, 10000, 64, 'sha512').toString('hex');
        
        if (hash !== verifyHash) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Current password is incorrect' })
          };
        }
        
        // Hash new password
        const newSalt = crypto.randomBytes(16).toString('hex');
        const newHashedPassword = crypto.pbkdf2Sync(newPassword, newSalt, 10000, 64, 'sha512').toString('hex') + ':' + newSalt;
        
        // Update password in database
        await dynamodb.update({
          TableName: USERS_TABLE,
          Key: { id: user.id },
          UpdateExpression: 'SET password = :password, updated_at = :updated_at',
          ExpressionAttributeValues: {
            ':password': newHashedPassword,
            ':updated_at': new Date().toISOString()
          }
        }).promise();
        
        // Invalidate all tokens for this user (force re-login)
        Object.keys(activeTokens).forEach(token => {
          if (activeTokens[token].id === user.id) {
            delete activeTokens[token];
          }
        });
        
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ 
            message: 'Password changed successfully. Please log in again.',
            changedAt: new Date().toISOString()
          })
        };
      } catch (error) {
        console.error('Error changing password:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Failed to change password' })
        };
      }
    }
    
    // Request password reset endpoint (sends email)
    if (path === '/api/auth/request-password-reset' && httpMethod === 'POST') {
      const { email } = requestBody;
      
      if (!email) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Email is required' })
        };
      }
      
      try {
        // Find user by email
        const result = await dynamodb.query({
          TableName: USERS_TABLE,
          IndexName: 'EmailIndex',
          KeyConditionExpression: 'email = :email',
          ExpressionAttributeValues: {
            ':email': email
          }
        }).promise();
        
        // Always return success to prevent email enumeration attacks
        if (result.Items.length === 0) {
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ 
              message: 'If an account with that email exists, a password reset link has been sent.'
            })
          };
        }
        
        const user = result.Items[0];
        
        // Generate reset token
        const resetToken = tokenService.generateResetToken();
        tokenService.storeResetToken(email, resetToken);
        
        // Send password reset email
        const emailResult = await emailService.sendPasswordResetEmail(
          user.email,
          user.name,
          resetToken
        );
        
        if (!emailResult.success) {
          console.error('Failed to send password reset email:', emailResult.error);
          return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Failed to send password reset email' })
          };
        }
        
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ 
            message: 'If an account with that email exists, a password reset link has been sent.',
            emailSent: true
          })
        };
      } catch (error) {
        console.error('Error requesting password reset:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Failed to process password reset request' })
        };
      }
    }

    // Reset password with token endpoint
    if (path === '/api/auth/reset-password' && httpMethod === 'POST') {
      const { token, newPassword } = requestBody;
      
      if (!token || !newPassword) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Token and new password are required' })
        };
      }
      
      if (newPassword.length < 6) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'New password must be at least 6 characters long' })
        };
      }
      
      try {
        // Validate reset token
        const tokenValidation = tokenService.validateResetToken(token);
        if (!tokenValidation.valid) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ message: tokenValidation.error })
          };
        }
        
        const email = tokenValidation.email;
        
        // Find user by email
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
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'User not found' })
          };
        }
        
        const user = result.Items[0];
        
        // Hash new password
        const salt = crypto.randomBytes(16).toString('hex');
        const hashedPassword = crypto.pbkdf2Sync(newPassword, salt, 10000, 64, 'sha512').toString('hex') + ':' + salt;
        
        // Update password in database
        await dynamodb.update({
          TableName: USERS_TABLE,
          Key: { id: user.id },
          UpdateExpression: 'SET password = :password, updated_at = :updated_at',
          ExpressionAttributeValues: {
            ':password': hashedPassword,
            ':updated_at': new Date().toISOString()
          }
        }).promise();
        
        // Invalidate all tokens for this user
        Object.keys(activeTokens).forEach(token => {
          if (activeTokens[token].id === user.id) {
            delete activeTokens[token];
          }
        });
        
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ 
            message: 'Password reset successfully. You can now log in with your new password.',
            resetAt: new Date().toISOString()
          })
        };
      } catch (error) {
        console.error('Error resetting password:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Failed to reset password' })
        };
      }
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
    
    // Test email endpoint (for development/testing)
    if (path === '/api/test-email' && httpMethod === 'POST') {
      const user = authenticate();
      if (!user) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Unauthorized' })
        };
      }
      
      const { email } = requestBody;
      const testEmail = email || user.email;
      
      try {
        const result = await emailService.sendTestEmail(testEmail);
        
        if (!result.success) {
          return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ 
              message: 'Failed to send test email',
              error: result.error
            })
          };
        }
        
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ 
            message: 'Test email sent successfully',
            to: testEmail,
            messageId: result.messageId
          })
        };
      } catch (error) {
        console.error('Error sending test email:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Failed to send test email' })
        };
      }
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
      
      // Create email content based on invitation type
      let subject, htmlBody, textBody;
      
      if (type === 'event_invitation') {
        subject = `🎤 You're Invited to Perform at Boston Open Mic!`;
        htmlBody = `
          <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center;">
                <h1 style="margin: 0; font-size: 28px;">🎤 Boston Open Mics</h1>
                <p style="margin: 10px 0 0 0; font-size: 16px;">You're Invited to Perform!</p>
              </div>
              
              <div style="padding: 30px; background: #f9f9f9;">
                <h2 style="color: #333; margin-top: 0;">Hi there!</h2>
                <p style="color: #666; line-height: 1.6; font-size: 16px;">
                  <strong>${inviterName}</strong> has invited you to perform at an upcoming open mic event!
                </p>
                
                <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
                  <p style="margin: 0; color: #333; font-style: italic;">"${message}"</p>
                </div>
                
                <p style="color: #666; line-height: 1.6;">
                  Boston Open Mics is the premier platform for discovering and participating in open mic events 
                  throughout the Boston area. Join our community of talented performers!
                </p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="https://boston-mic-list.netlify.app/register" 
                     style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; 
                            border-radius: 5px; font-weight: bold; display: inline-block;">
                    Join Boston Open Mics
                  </a>
                </div>
                
                <p style="color: #999; font-size: 14px; text-align: center; margin-top: 30px;">
                  Questions? Reply to this email or contact ${inviterName} at ${inviterEmail}
                </p>
              </div>
              
              <div style="background: #333; color: #999; padding: 20px; text-align: center; font-size: 12px;">
                <p style="margin: 0;">© 2025 Boston Open Mics. Connecting performers across Boston.</p>
              </div>
            </body>
          </html>
        `;
        textBody = `
🎤 Boston Open Mics - You're Invited to Perform!

Hi there!

${inviterName} has invited you to perform at an upcoming open mic event!

"${message}"

Boston Open Mics is the premier platform for discovering and participating in open mic events throughout the Boston area. Join our community of talented performers!

Join us at: https://boston-mic-list.netlify.app/register

Questions? Reply to this email or contact ${inviterName} at ${inviterEmail}

© 2025 Boston Open Mics. Connecting performers across Boston.
        `;
      } else {
        // Generic invitation
        subject = `Invitation from ${inviterName} - Boston Open Mics`;
        htmlBody = `
          <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #667eea; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0;">🎤 Boston Open Mics</h1>
              </div>
              <div style="padding: 30px;">
                <h2>Hi there!</h2>
                <p><strong>${inviterName}</strong> has sent you an invitation:</p>
                <blockquote style="border-left: 4px solid #667eea; padding-left: 20px; margin: 20px 0; font-style: italic;">
                  ${message}
                </blockquote>
                <p>Visit Boston Open Mics to learn more: <a href="https://boston-mic-list.netlify.app">https://boston-mic-list.netlify.app</a></p>
                <p style="color: #666; font-size: 14px;">Questions? Contact ${inviterName} at ${inviterEmail}</p>
              </div>
            </body>
          </html>
        `;
        textBody = `
Boston Open Mics - Invitation from ${inviterName}

Hi there!

${inviterName} has sent you an invitation:

"${message}"

Visit Boston Open Mics to learn more: https://boston-mic-list.netlify.app

Questions? Contact ${inviterName} at ${inviterEmail}
        `;
      }
      
      // Send the email using AWS SES
      const emailResult = await sendEmail(email, subject, htmlBody, textBody);
      
      if (!emailResult.success) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({
            message: 'Failed to send invitation email',
            error: emailResult.error
          })
        };
      }
      
      // Log successful invitation
      console.log('✅ Invitation email sent successfully:');
      console.log(`To: ${email}`);
      console.log(`From: ${inviterName} (${inviterEmail})`);
      console.log(`Type: ${type}`);
      console.log(`Message ID: ${emailResult.messageId}`);
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          message: 'Invitation sent successfully',
          email,
          type,
          messageId: emailResult.messageId,
          sentAt: new Date().toISOString()
        })
      };
    }

    // ===== CHAT ENDPOINTS =====
    
    // Get user's conversations
    if (path === '/api/chat/conversations' && httpMethod === 'GET') {
      const user = authenticate();
      if (!user) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Unauthorized' })
        };
      }

      try {
        // Get conversations where user is participant_1
        const conversations1 = await dynamodb.query({
          TableName: CONVERSATIONS_TABLE,
          IndexName: 'Participant1Index',
          KeyConditionExpression: 'participant_1_id = :userId',
          ExpressionAttributeValues: {
            ':userId': user.id
          }
        }).promise();

        // Get conversations where user is participant_2
        const conversations2 = await dynamodb.query({
          TableName: CONVERSATIONS_TABLE,
          IndexName: 'Participant2Index',
          KeyConditionExpression: 'participant_2_id = :userId',
          ExpressionAttributeValues: {
            ':userId': user.id
          }
        }).promise();

        // Combine and deduplicate conversations
        const allConversations = [...conversations1.Items, ...conversations2.Items];
        const uniqueConversations = allConversations.filter((conv, index, self) => 
          index === self.findIndex(c => c.id === conv.id)
        );

        // Get other participant details for each conversation
        const conversationsWithDetails = await Promise.all(
          uniqueConversations.map(async (conv) => {
            const otherUserId = conv.participant_1_id === user.id ? 
              conv.participant_2_id : conv.participant_1_id;
            
            // Get other user details
            const otherUser = await dynamodb.get({
              TableName: USERS_TABLE,
              Key: { id: otherUserId }
            }).promise();

            // Get last message if exists
            let lastMessage = null;
            if (conv.last_message_id) {
              const lastMsg = await dynamodb.get({
                TableName: MESSAGES_TABLE,
                Key: { id: conv.last_message_id }
              }).promise();
              lastMessage = lastMsg.Item || null;
            }

            return {
              ...conv,
              other_user: otherUser.Item || { id: otherUserId, name: 'Unknown User' },
              last_message: lastMessage
            };
          })
        );

        // Sort by last activity
        conversationsWithDetails.sort((a, b) => 
          new Date(b.updated_at) - new Date(a.updated_at)
        );

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(conversationsWithDetails)
        };
      } catch (error) {
        console.error('Error fetching conversations:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Failed to fetch conversations' })
        };
      }
    }

    // Start a new conversation
    if (path === '/api/chat/conversations' && httpMethod === 'POST') {
      const user = authenticate();
      if (!user) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Unauthorized' })
        };
      }

      const { other_user_id } = requestBody;
      
      if (!other_user_id) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'other_user_id is required' })
        };
      }

      if (other_user_id === user.id) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Cannot start conversation with yourself' })
        };
      }

      try {
        // Check if conversation already exists
        const existingConv1 = await dynamodb.query({
          TableName: CONVERSATIONS_TABLE,
          IndexName: 'Participant1Index',
          KeyConditionExpression: 'participant_1_id = :userId',
          FilterExpression: 'participant_2_id = :otherUserId',
          ExpressionAttributeValues: {
            ':userId': user.id,
            ':otherUserId': other_user_id
          }
        }).promise();

        const existingConv2 = await dynamodb.query({
          TableName: CONVERSATIONS_TABLE,
          IndexName: 'Participant1Index',
          KeyConditionExpression: 'participant_1_id = :otherUserId',
          FilterExpression: 'participant_2_id = :userId',
          ExpressionAttributeValues: {
            ':userId': user.id,
            ':otherUserId': other_user_id
          }
        }).promise();

        if (existingConv1.Items.length > 0) {
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify(existingConv1.Items[0])
          };
        }

        if (existingConv2.Items.length > 0) {
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify(existingConv2.Items[0])
          };
        }

        // Create new conversation
        const conversationId = uuidv4();
        const now = new Date().toISOString();

        const conversation = {
          id: conversationId,
          participant_1_id: user.id,
          participant_2_id: other_user_id,
          created_at: now,
          updated_at: now,
          last_message_id: null
        };

        await dynamodb.put({
          TableName: CONVERSATIONS_TABLE,
          Item: conversation
        }).promise();

        return {
          statusCode: 201,
          headers: corsHeaders,
          body: JSON.stringify(conversation)
        };
      } catch (error) {
        console.error('Error creating conversation:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Failed to create conversation' })
        };
      }
    }

    // Get messages for a conversation
    if (path.match(/^\/api\/chat\/conversations\/[^\/]+\/messages$/) && httpMethod === 'GET') {
      const user = authenticate();
      if (!user) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Unauthorized' })
        };
      }

      const conversationId = path.split('/')[4];
      const limit = parseInt(queryStringParameters?.limit || '50');
      const lastMessageId = queryStringParameters?.lastMessageId;

      try {
        // Verify user is part of this conversation
        const conversation = await dynamodb.get({
          TableName: CONVERSATIONS_TABLE,
          Key: { id: conversationId }
        }).promise();

        if (!conversation.Item) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Conversation not found' })
          };
        }

        if (conversation.Item.participant_1_id !== user.id && 
            conversation.Item.participant_2_id !== user.id) {
          return {
            statusCode: 403,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Access denied' })
          };
        }

        // Get messages for this conversation
        let queryParams = {
          TableName: MESSAGES_TABLE,
          IndexName: 'ConversationIndex',
          KeyConditionExpression: 'conversation_id = :conversationId',
          ExpressionAttributeValues: {
            ':conversationId': conversationId
          },
          ScanIndexForward: false, // Most recent first
          Limit: limit
        };

        if (lastMessageId) {
          // For pagination - get messages before this timestamp
          const lastMessage = await dynamodb.get({
            TableName: MESSAGES_TABLE,
            Key: { id: lastMessageId }
          }).promise();
          
          if (lastMessage.Item) {
            queryParams.ExclusiveStartKey = {
              conversation_id: conversationId,
              timestamp: lastMessage.Item.timestamp,
              id: lastMessageId
            };
          }
        }

        const messages = await dynamodb.query(queryParams).promise();

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            messages: messages.Items.reverse(), // Oldest first for display
            hasMore: !!messages.LastEvaluatedKey
          })
        };
      } catch (error) {
        console.error('Error fetching messages:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Failed to fetch messages' })
        };
      }
    }

    // Send a message
    if (path.match(/^\/api\/chat\/conversations\/[^\/]+\/messages$/) && httpMethod === 'POST') {
      const user = authenticate();
      if (!user) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Unauthorized' })
        };
      }

      const conversationId = path.split('/')[4];
      const { message_text } = requestBody;

      if (!message_text || message_text.trim().length === 0) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'message_text is required' })
        };
      }

      if (message_text.length > 1000) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Message too long (max 1000 characters)' })
        };
      }

      try {
        // Verify user is part of this conversation
        const conversation = await dynamodb.get({
          TableName: CONVERSATIONS_TABLE,
          Key: { id: conversationId }
        }).promise();

        if (!conversation.Item) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Conversation not found' })
          };
        }

        if (conversation.Item.participant_1_id !== user.id && 
            conversation.Item.participant_2_id !== user.id) {
          return {
            statusCode: 403,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Access denied' })
          };
        }

        // Create message
        const messageId = uuidv4();
        const now = new Date().toISOString();
        const recipientId = conversation.Item.participant_1_id === user.id ? 
          conversation.Item.participant_2_id : conversation.Item.participant_1_id;

        const message = {
          id: messageId,
          conversation_id: conversationId,
          sender_id: user.id,
          recipient_id: recipientId,
          message_text: message_text.trim(),
          timestamp: now,
          read_at: null
        };

        // Save message
        await dynamodb.put({
          TableName: MESSAGES_TABLE,
          Item: message
        }).promise();

        // Update conversation's last message
        await dynamodb.update({
          TableName: CONVERSATIONS_TABLE,
          Key: { id: conversationId },
          UpdateExpression: 'SET last_message_id = :messageId, updated_at = :updatedAt',
          ExpressionAttributeValues: {
            ':messageId': messageId,
            ':updatedAt': now
          }
        }).promise();

        return {
          statusCode: 201,
          headers: corsHeaders,
          body: JSON.stringify(message)
        };
      } catch (error) {
        console.error('Error sending message:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Failed to send message' })
        };
      }
    }

    // Mark message as read
    if (path.match(/^\/api\/chat\/messages\/[^\/]+\/read$/) && httpMethod === 'PUT') {
      const user = authenticate();
      if (!user) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Unauthorized' })
        };
      }

      const messageId = path.split('/')[4];

      try {
        // Get message
        const message = await dynamodb.get({
          TableName: MESSAGES_TABLE,
          Key: { id: messageId }
        }).promise();

        if (!message.Item) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Message not found' })
          };
        }

        // Only recipient can mark as read
        if (message.Item.recipient_id !== user.id) {
          return {
            statusCode: 403,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Access denied' })
          };
        }

        // Mark as read
        await dynamodb.update({
          TableName: MESSAGES_TABLE,
          Key: { id: messageId },
          UpdateExpression: 'SET read_at = :readAt',
          ExpressionAttributeValues: {
            ':readAt': new Date().toISOString()
          }
        }).promise();

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Message marked as read' })
        };
      } catch (error) {
        console.error('Error marking message as read:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Failed to mark message as read' })
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