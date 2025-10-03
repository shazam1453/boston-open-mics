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
const CONVERSATION_PARTICIPANTS_TABLE = process.env.CONVERSATION_PARTICIPANTS_TABLE;
const INVITATIONS_TABLE = process.env.INVITATIONS_TABLE;

// Token storage
const TOKENS_TABLE = process.env.TOKENS_TABLE;
const TOKEN_EXPIRATION_TIME = 60 * 60 * 1000; // 1 hour

// In-memory cache for performance (will be lost on cold starts, but that's ok)
const tokenCache = global.tokenCache || {};
global.tokenCache = tokenCache;

// Helper function to store token in DynamoDB
const storeToken = async (token, userData, expiresAt) => {
  // Always store in memory cache first
  tokenCache[token] = {
    user: userData,
    expiresAt: expiresAt,
    createdAt: Date.now()
  };
  
  try {
    const ttl = Math.floor(expiresAt / 1000); // TTL in seconds for DynamoDB
    
    await dynamodb.put({
      TableName: TOKENS_TABLE,
      Item: {
        token: token,
        user: userData,
        expiresAt: expiresAt,
        createdAt: Date.now(),
        ttl: ttl // DynamoDB will automatically delete expired items
      }
    }).promise();
    
    console.log('Token stored successfully in DynamoDB for user:', userData.email);
  } catch (error) {
    console.error('Failed to store token in DynamoDB, using memory only:', error);
    // Don't throw error - fallback to memory-only storage
    console.log('Token stored in memory cache for user:', userData.email);
  }
};

// Helper function to get token from DynamoDB or cache
const getToken = async (token) => {
  // First check memory cache
  if (tokenCache[token]) {
    const tokenData = tokenCache[token];
    if (tokenData.expiresAt > Date.now()) {
      return tokenData;
    } else {
      // Remove expired token from cache
      delete tokenCache[token];
    }
  }
  
  // Check DynamoDB
  try {
    const result = await dynamodb.get({
      TableName: TOKENS_TABLE,
      Key: { token: token }
    }).promise();
    
    if (result.Item) {
      const tokenData = {
        user: result.Item.user,
        expiresAt: result.Item.expiresAt,
        createdAt: result.Item.createdAt
      };
      
      // Check if token is expired
      if (tokenData.expiresAt > Date.now()) {
        // Cache for future requests
        tokenCache[token] = tokenData;
        return tokenData;
      } else {
        // Token is expired, delete it
        await deleteToken(token);
        return null;
      }
    }
  } catch (error) {
    console.error('Failed to get token from DynamoDB:', error);
  }
  
  return null;
};

// Helper function to delete token from DynamoDB and cache
const deleteToken = async (token) => {
  // Remove from cache
  delete tokenCache[token];
  
  // Remove from DynamoDB
  try {
    await dynamodb.delete({
      TableName: TOKENS_TABLE,
      Key: { token: token }
    }).promise();
  } catch (error) {
    console.error('Failed to delete token from DynamoDB:', error);
  }
};

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
    
    // Helper function to authenticate (now async)
    const authenticate = async () => {
      const authHeader = headers.Authorization || headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('No auth header or invalid format');
        return null;
      }
      
      const token = authHeader.replace('Bearer ', '');
      const tokenData = await getToken(token);
      
      if (!tokenData) {
        console.log('Token not found or expired:', token.substring(0, 20) + '...');
        return null;
      }
      
      console.log('Authentication successful for user:', tokenData.user?.email || 'unknown');
      return tokenData.user;
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
              'POST /api/auth/refresh-token',
              'DELETE /api/auth/delete-account'
            ],
            events: [
              'GET /api/events',
              'GET /api/events/{id}',
              'POST /api/events',
              'PUT /api/events/{id}',
              'GET /api/events/host/{hostId}',
              'POST /api/events/{id}/randomize-order'
            ],
            venues: [
              'GET /api/venues',
              'POST /api/venues',
              'PUT /api/venues/{id}',
              'DELETE /api/venues/{id}',
              'GET /api/venues/owner/{ownerId}'
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
              'GET /api/invitations/my-invitations',
              'GET /api/invitations/event/{eventId}',
              'POST /api/invitations',
              'PATCH /api/invitations/{id}/respond',
              'DELETE /api/invitations/{id}',
              'POST /api/invitations/send'
            ],
            chat: [
              'GET /api/chat/conversations',
              'POST /api/chat/conversations',
              'GET /api/chat/conversations/{id}/messages',
              'POST /api/chat/conversations/{id}/messages',
              'PUT /api/chat/messages/{id}/read',
              'POST /api/events/{id}/chat/create',
              'GET /api/events/{id}/chat',
              'POST /api/events/{id}/chat/join',
              'POST /api/events/{id}/chat/leave'
            ],
            'host-management': [
              'DELETE /api/events/{id}/performers/{signupId}/remove',
              'POST /api/events/{id}/walk-ins'
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
      const expiresAt = Date.now() + TOKEN_EXPIRATION_TIME;
      
      // Store token in DynamoDB
      await storeToken(token, newUser, expiresAt);
      console.log('Created new token for user:', newUser.email, 'expires at:', new Date(expiresAt));
      
      const { password: _, ...userResponse } = newUser;
      
      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({
          token,
          user: userResponse,
          expiresAt: new Date(expiresAt).toISOString(),
          expiresIn: TOKEN_EXPIRATION_TIME / 1000 // seconds
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
      const expiresAt = Date.now() + TOKEN_EXPIRATION_TIME;
      
      // Store token in DynamoDB
      await storeToken(token, user, expiresAt);
      console.log('Created new token for user:', user.email, 'expires at:', new Date(expiresAt));
      
      const { password: _, ...userResponse } = user;
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          token,
          user: userResponse,
          expiresAt: new Date(expiresAt).toISOString(),
          expiresIn: TOKEN_EXPIRATION_TIME / 1000 // seconds
        })
      };
    }
    
    if (path === '/api/auth/profile' && httpMethod === 'GET') {
      const user = await authenticate();
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
      const user = await authenticate();
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
      const user = await authenticate();
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
        Object.keys(tokenCache).forEach(async (token) => {
          if (tokenCache[token].user && tokenCache[token].user.id === user.id) {
            await deleteToken(token);
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
        Object.keys(tokenCache).forEach(async (token) => {
          if (tokenCache[token].user && tokenCache[token].user.id === user.id) {
            await deleteToken(token);
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
    
    // Token refresh endpoint
    if (path === '/api/auth/refresh-token' && httpMethod === 'POST') {
      const user = await authenticate();
      if (!user) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Unauthorized - token expired or invalid' })
        };
      }
      
      try {
        // Find the current token
        const currentTokenKey = Object.keys(tokenCache).find(token => 
          tokenCache[token].user && tokenCache[token].user.id === user.id
        );
        
        if (currentTokenKey) {
          // Extend the current token's expiration
          const newExpiresAt = Date.now() + TOKEN_EXPIRATION_TIME;
          tokenCache[currentTokenKey].expiresAt = newExpiresAt;
          
          // Update in DynamoDB
          try {
            await dynamodb.update({
              TableName: TOKENS_TABLE,
              Key: { token: currentTokenKey },
              UpdateExpression: 'SET expiresAt = :expiresAt, #ttl = :ttl',
              ExpressionAttributeNames: { '#ttl': 'ttl' },
              ExpressionAttributeValues: { 
                ':expiresAt': newExpiresAt,
                ':ttl': Math.floor(newExpiresAt / 1000)
              }
            }).promise();
          } catch (error) {
            console.error('Failed to update token expiration in DB:', error);
          }
          
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ 
              message: 'Token refreshed successfully',
              expiresAt: new Date(newExpiresAt).toISOString(),
              expiresIn: TOKEN_EXPIRATION_TIME / 1000 // seconds
            })
          };
        } else {
          return {
            statusCode: 401,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Token not found' })
          };
        }
      } catch (error) {
        console.error('Error refreshing token:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Failed to refresh token' })
        };
      }
    }
    
    // Delete own account endpoint
    if (path === '/api/auth/delete-account' && httpMethod === 'DELETE') {
      const user = await authenticate();
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
        Object.keys(tokenCache).forEach(async (token) => {
          if (tokenCache[token].user && tokenCache[token].user.id === user.id) {
            await deleteToken(token);
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
      const user = await authenticate();
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
      const user = await authenticate();
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
    
    // Get venues by owner
    if (path.match(/^\/api\/venues\/owner\/[^\/]+$/) && httpMethod === 'GET') {
      const ownerId = path.split('/')[4];
      
      try {
        const result = await dynamodb.scan({
          TableName: VENUES_TABLE,
          FilterExpression: 'owner_id = :owner_id',
          ExpressionAttributeValues: {
            ':owner_id': ownerId
          }
        }).promise();
        
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(result.Items || [])
        };
      } catch (error) {
        console.error('Error getting venues by owner:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Failed to get venues' })
        };
      }
    }
    
    // Get events by host
    if (path.match(/^\/api\/events\/host\/[^\/]+$/) && httpMethod === 'GET') {
      const hostId = path.split('/')[4];
      
      try {
        const result = await dynamodb.scan({
          TableName: EVENTS_TABLE,
          FilterExpression: 'host_id = :host_id',
          ExpressionAttributeValues: {
            ':host_id': hostId
          }
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
      } catch (error) {
        console.error('Error getting events by host:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Failed to get events' })
        };
      }
    }
    
    // Update venue
    if (path.match(/^\/api\/venues\/[^\/]+$/) && httpMethod === 'PUT') {
      const user = await authenticate();
      if (!user) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Unauthorized' })
        };
      }
      
      const venueId = path.split('/')[3];
      
      // Check if venue exists and user is owner
      const venueResult = await dynamodb.get({
        TableName: VENUES_TABLE,
        Key: { id: venueId }
      }).promise();
      
      if (!venueResult.Item) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Venue not found' })
        };
      }
      
      if (venueResult.Item.owner_id !== user.id && user.role !== 'admin' && user.role !== 'super_admin') {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'You can only edit your own venues' })
        };
      }
      
      const { name, address, description, capacity, phone, email } = requestBody;
      
      const updatedVenue = {
        ...venueResult.Item,
        name: name || venueResult.Item.name,
        address: address || venueResult.Item.address,
        description: description !== undefined ? description : venueResult.Item.description,
        capacity: capacity !== undefined ? (capacity ? parseInt(capacity) : null) : venueResult.Item.capacity,
        phone: phone !== undefined ? phone : venueResult.Item.phone,
        email: email !== undefined ? email : venueResult.Item.email,
        updated_at: new Date().toISOString()
      };
      
      await dynamodb.put({
        TableName: VENUES_TABLE,
        Item: updatedVenue
      }).promise();
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ venue: updatedVenue })
      };
    }
    
    // Delete venue
    if (path.match(/^\/api\/venues\/[^\/]+$/) && httpMethod === 'DELETE') {
      const user = await authenticate();
      if (!user) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Unauthorized' })
        };
      }
      
      const venueId = path.split('/')[3];
      
      // Check if venue exists and user is owner
      const venueResult = await dynamodb.get({
        TableName: VENUES_TABLE,
        Key: { id: venueId }
      }).promise();
      
      if (!venueResult.Item) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Venue not found' })
        };
      }
      
      if (venueResult.Item.owner_id !== user.id && user.role !== 'admin' && user.role !== 'super_admin') {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'You can only delete your own venues' })
        };
      }
      
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
      const user = await authenticate();
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
      const user = await authenticate();
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
      const user = await authenticate();
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
      const user = await authenticate();
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
      
      try {
        // Scan users table and filter in JavaScript for case-insensitive search
        console.log('Searching users with query:', query);
        const result = await dynamodb.scan({
          TableName: USERS_TABLE
        }).promise();
        
        console.log('Total users found:', result.Items.length);
        
        const queryLower = query.toLowerCase();
        const filteredUsers = result.Items.filter(u => {
          const name = (u.name || '').toLowerCase();
          const email = (u.email || '').toLowerCase();
          const performerType = (u.performer_type || '').toLowerCase();
          
          const matches = name.includes(queryLower) || 
                         email.includes(queryLower) || 
                         performerType.includes(queryLower);
          
          if (matches) {
            console.log('Match found:', { name: u.name, email: u.email, performer_type: u.performer_type });
          }
          
          return matches;
        });
        
        console.log('Filtered users:', filteredUsers.length);
        
        const results = filteredUsers
          .filter(u => u.id !== user.id) // Exclude current user from results
          .map(u => ({
            id: u.id,
            name: u.name,
            email: u.email,
            performer_type: u.performer_type
          }))
          .slice(0, 20); // Limit to 20 results
        
        console.log('Final results:', results.length);
        
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(results)
        };
      } catch (error) {
        console.error('User search error:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Search failed', error: error.message })
        };
      }
    }
    
    // Reorder signups endpoint
    if (path.match(/^\/api\/signups\/reorder\/[^\/]+$/) && httpMethod === 'PUT') {
      const user = await authenticate();
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
      const user = await authenticate();
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
      const user = await authenticate();
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
      
      // Update token with new user data while preserving expiration
      const userTokenKey = Object.keys(tokenCache).find(token => 
        tokenCache[token].user && tokenCache[token].user.id === user.id
      );
      if (userTokenKey && tokenCache[userTokenKey]) {
        tokenCache[userTokenKey].user = updatedUserResult.Item;
        // Also update in DynamoDB
        try {
          await dynamodb.update({
            TableName: TOKENS_TABLE,
            Key: { token: userTokenKey },
            UpdateExpression: 'SET #user = :user',
            ExpressionAttributeNames: { '#user': 'user' },
            ExpressionAttributeValues: { ':user': updatedUserResult.Item }
          }).promise();
        } catch (error) {
          console.error('Failed to update token in DB:', error);
        }
      }
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ user: userResponse })
      };
    }
    
    // Event update endpoint
    if (path.match(/^\/api\/events\/[^\/]+$/) && httpMethod === 'PUT') {
      const user = await authenticate();
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
      const user = await authenticate();
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
      const user = await authenticate();
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
      const user = await authenticate();
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
      const user = await authenticate();
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
      const user = await authenticate();
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
      const user = await authenticate();
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
      const user = await authenticate();
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
      const user = await authenticate();
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
      const user = await authenticate();
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
      const user = await authenticate();
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
      const user = await authenticate();
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
      const user = await authenticate();
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

    // ===== INVITATION ENDPOINTS =====
    
    // Get user's invitations
    if (path === '/api/invitations/my-invitations' && httpMethod === 'GET') {
      const user = await authenticate();
      if (!user) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Unauthorized' })
        };
      }

      try {
        const result = await dynamodb.query({
          TableName: INVITATIONS_TABLE,
          IndexName: 'InviteeIndex',
          KeyConditionExpression: 'invitee_id = :userId',
          ExpressionAttributeValues: {
            ':userId': user.id
          }
        }).promise();

        // TODO: Enhance with event and user details
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(result.Items || [])
        };
      } catch (error) {
        console.error('Error fetching invitations:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Failed to fetch invitations' })
        };
      }
    }

    // Get invitations for an event
    if (path.match(/^\/api\/invitations\/event\/(.+)$/) && httpMethod === 'GET') {
      const user = await authenticate();
      if (!user) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Unauthorized' })
        };
      }

      const eventId = path.match(/^\/api\/invitations\/event\/(.+)$/)[1];

      try {
        // TODO: Add authorization check to ensure user is host or cohost
        const result = await dynamodb.query({
          TableName: INVITATIONS_TABLE,
          IndexName: 'EventIndex',
          KeyConditionExpression: 'event_id = :eventId',
          ExpressionAttributeValues: {
            ':eventId': eventId
          }
        }).promise();

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(result.Items || [])
        };
      } catch (error) {
        console.error('Error fetching event invitations:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Failed to fetch event invitations' })
        };
      }
    }

    // Create invitation
    if (path === '/api/invitations' && httpMethod === 'POST') {
      const user = await authenticate();
      if (!user) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Unauthorized' })
        };
      }

      const { eventId, inviteeId, type, message } = requestBody;

      // Validate required fields
      if (!eventId || !inviteeId || !type) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Missing required fields' })
        };
      }

      if (!['cohost', 'performer'].includes(type)) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Type must be cohost or performer' })
        };
      }

      try {
        // Check if invitation already exists
        const existingResult = await dynamodb.scan({
          TableName: INVITATIONS_TABLE,
          FilterExpression: 'event_id = :eventId AND invitee_id = :inviteeId AND #type = :type AND #status = :status',
          ExpressionAttributeNames: {
            '#type': 'type',
            '#status': 'status'
          },
          ExpressionAttributeValues: {
            ':eventId': eventId,
            ':inviteeId': inviteeId,
            ':type': type,
            ':status': 'pending'
          }
        }).promise();

        if (existingResult.Items && existingResult.Items.length > 0) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'An invitation of this type already exists for this user and event' })
          };
        }

        // Create invitation
        const invitation = {
          id: uuidv4(),
          event_id: eventId,
          inviter_id: user.id,
          invitee_id: inviteeId,
          type: type,
          message: message || null,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        await dynamodb.put({
          TableName: INVITATIONS_TABLE,
          Item: invitation
        }).promise();

        return {
          statusCode: 201,
          headers: corsHeaders,
          body: JSON.stringify(invitation)
        };
      } catch (error) {
        console.error('Error creating invitation:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Failed to create invitation' })
        };
      }
    }

    // Respond to invitation
    if (path.match(/^\/api\/invitations\/(.+)\/respond$/) && httpMethod === 'PATCH') {
      const user = await authenticate();
      if (!user) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Unauthorized' })
        };
      }

      const invitationId = path.match(/^\/api\/invitations\/(.+)\/respond$/)[1];
      const { status } = requestBody;

      if (!['accepted', 'declined'].includes(status)) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Status must be accepted or declined' })
        };
      }

      try {
        // Get invitation
        const invitationResult = await dynamodb.get({
          TableName: INVITATIONS_TABLE,
          Key: { id: invitationId }
        }).promise();

        if (!invitationResult.Item) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Invitation not found' })
          };
        }

        const invitation = invitationResult.Item;

        if (invitation.invitee_id !== user.id) {
          return {
            statusCode: 403,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Unauthorized to respond to this invitation' })
          };
        }

        if (invitation.status !== 'pending') {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Invitation already responded to' })
          };
        }

        // Update invitation
        const updatedInvitation = {
          ...invitation,
          status: status,
          responded_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        await dynamodb.put({
          TableName: INVITATIONS_TABLE,
          Item: updatedInvitation
        }).promise();

        // TODO: If accepted, add user to appropriate role (cohost or performer)
        // This would require integration with Events/Signups tables

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(updatedInvitation)
        };
      } catch (error) {
        console.error('Error responding to invitation:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Failed to respond to invitation' })
        };
      }
    }

    // Delete invitation
    if (path.match(/^\/api\/invitations\/(.+)$/) && httpMethod === 'DELETE') {
      const user = await authenticate();
      if (!user) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Unauthorized' })
        };
      }

      const invitationId = path.match(/^\/api\/invitations\/(.+)$/)[1];

      try {
        // Get invitation to verify ownership
        const invitationResult = await dynamodb.get({
          TableName: INVITATIONS_TABLE,
          Key: { id: invitationId }
        }).promise();

        if (!invitationResult.Item) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Invitation not found' })
          };
        }

        const invitation = invitationResult.Item;

        if (invitation.inviter_id !== user.id && invitation.invitee_id !== user.id) {
          return {
            statusCode: 403,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Unauthorized to delete this invitation' })
          };
        }

        await dynamodb.delete({
          TableName: INVITATIONS_TABLE,
          Key: { id: invitationId }
        }).promise();

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Invitation deleted successfully' })
        };
      } catch (error) {
        console.error('Error deleting invitation:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Failed to delete invitation' })
        };
      }
    }

    // ===== CHAT ENDPOINTS =====
    
    // Get user's conversations (both direct and group chats)
    if (path === '/api/chat/conversations' && httpMethod === 'GET') {
      const user = await authenticate();
      if (!user) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Unauthorized' })
        };
      }

      try {
        const allConversations = [];

        // Get direct conversations where user is participant_1
        const conversations1 = await dynamodb.query({
          TableName: CONVERSATIONS_TABLE,
          IndexName: 'Participant1Index',
          KeyConditionExpression: 'participant_1_id = :userId',
          FilterExpression: 'attribute_not_exists(#type) OR #type = :directType',
          ExpressionAttributeNames: {
            '#type': 'type'
          },
          ExpressionAttributeValues: {
            ':userId': user.id,
            ':directType': 'direct'
          }
        }).promise();

        // Get direct conversations where user is participant_2
        const conversations2 = await dynamodb.query({
          TableName: CONVERSATIONS_TABLE,
          IndexName: 'Participant2Index',
          KeyConditionExpression: 'participant_2_id = :userId',
          FilterExpression: 'attribute_not_exists(#type) OR #type = :directType',
          ExpressionAttributeNames: {
            '#type': 'type'
          },
          ExpressionAttributeValues: {
            ':userId': user.id,
            ':directType': 'direct'
          }
        }).promise();

        // Get group conversations where user is a participant
        const userParticipations = await dynamodb.query({
          TableName: CONVERSATION_PARTICIPANTS_TABLE,
          IndexName: 'UserIndex',
          KeyConditionExpression: 'user_id = :userId',
          ExpressionAttributeValues: {
            ':userId': user.id
          }
        }).promise();

        // Get group conversation details
        const groupConversations = await Promise.all(
          userParticipations.Items.map(async (participation) => {
            const conv = await dynamodb.get({
              TableName: CONVERSATIONS_TABLE,
              Key: { id: participation.conversation_id }
            }).promise();
            return conv.Item;
          })
        );

        // Combine all conversations
        const directConversations = [...conversations1.Items, ...conversations2.Items];
        const validGroupConversations = groupConversations.filter(conv => conv);
        
        // Process direct conversations
        const directConversationsWithDetails = await Promise.all(
          directConversations.map(async (conv) => {
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
              type: 'direct',
              other_user: otherUser.Item || { id: otherUserId, name: 'Unknown User' },
              last_message: lastMessage,
              display_name: otherUser.Item?.name || 'Unknown User'
            };
          })
        );

        // Process group conversations
        const groupConversationsWithDetails = await Promise.all(
          validGroupConversations.map(async (conv) => {
            // Get participant count
            const participants = await dynamodb.query({
              TableName: CONVERSATION_PARTICIPANTS_TABLE,
              IndexName: 'ConversationIndex',
              KeyConditionExpression: 'conversation_id = :conversationId',
              ExpressionAttributeValues: {
                ':conversationId': conv.id
              }
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

            // Get event details if it's an event group chat
            let eventDetails = null;
            if (conv.event_id) {
              const event = await dynamodb.get({
                TableName: EVENTS_TABLE,
                Key: { id: conv.event_id }
              }).promise();
              eventDetails = event.Item;
            }

            return {
              ...conv,
              type: 'group',
              participant_count: participants.Items.length,
              last_message: lastMessage,
              display_name: conv.title || `Group Chat (${participants.Items.length} members)`,
              event: eventDetails
            };
          })
        );

        // Combine and sort all conversations
        const allConversationsWithDetails = [
          ...directConversationsWithDetails,
          ...groupConversationsWithDetails
        ];

        // Remove duplicates and sort by last activity
        const uniqueConversations = allConversationsWithDetails.filter((conv, index, self) => 
          index === self.findIndex(c => c.id === conv.id)
        );

        uniqueConversations.sort((a, b) => 
          new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)
        );

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(uniqueConversations)
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
      const user = await authenticate();
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
      const user = await authenticate();
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

        // Check authorization based on conversation type
        let isAuthorized = false;
        
        if (conversation.Item.type === 'group') {
          // For group chats, check if user is a participant
          const participantResult = await dynamodb.query({
            TableName: CONVERSATION_PARTICIPANTS_TABLE,
            IndexName: 'ConversationIndex',
            KeyConditionExpression: 'conversation_id = :conversationId',
            FilterExpression: 'user_id = :userId',
            ExpressionAttributeValues: {
              ':conversationId': conversationId,
              ':userId': user.id
            }
          }).promise();
          
          isAuthorized = participantResult.Items.length > 0;
        } else {
          // For direct messages, check participant_1_id and participant_2_id
          isAuthorized = (conversation.Item.participant_1_id === user.id || 
                         conversation.Item.participant_2_id === user.id);
        }

        if (!isAuthorized) {
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
      const user = await authenticate();
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
      const user = await authenticate();
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

    // ===== ENHANCED HOST MANAGEMENT ENDPOINTS =====

    // Remove performer from event (host only)
    if (path.match(/^\/api\/events\/[^\/]+\/performers\/[^\/]+\/remove$/) && httpMethod === 'DELETE') {
      const user = await authenticate();
      if (!user) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Unauthorized' })
        };
      }

      try {
        const eventId = path.split('/')[3];
        const signupId = path.split('/')[5];

        // Check if user is the event host
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

        const event = eventResult.Item;
        if (event.host_id !== user.id) {
          return {
            statusCode: 403,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Only event hosts can remove performers' })
          };
        }

        // Get the signup to remove
        const signupResult = await dynamodb.get({
          TableName: SIGNUPS_TABLE,
          Key: { id: signupId }
        }).promise();

        if (!signupResult.Item) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Signup not found' })
          };
        }

        const signup = signupResult.Item;
        if (signup.event_id !== eventId) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Signup does not belong to this event' })
          };
        }

        // Remove the signup
        await dynamodb.delete({
          TableName: SIGNUPS_TABLE,
          Key: { id: signupId }
        }).promise();

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ 
            message: 'Performer removed successfully',
            removedSignup: signup
          })
        };
      } catch (error) {
        console.error('Error removing performer:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Failed to remove performer' })
        };
      }
    }

    // Add walk-in performer (host only)
    if (path.match(/^\/api\/events\/[^\/]+\/walk-ins$/) && httpMethod === 'POST') {
      const user = await authenticate();
      if (!user) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Unauthorized' })
        };
      }

      try {
        const eventId = path.split('/')[3];
        const { performerName, performanceName, performanceType, notes } = requestBody;

        console.log('Walk-in request data:', { eventId, performerName, performanceName, performanceType, notes });

        if (!performerName) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Performer name is required' })
          };
        }

        // Check if user is the event host
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

        const event = eventResult.Item;
        if (event.host_id !== user.id) {
          return {
            statusCode: 403,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Only event hosts can add walk-in performers' })
          };
        }

        // Get current signups to determine order
        const signupsResult = await dynamodb.query({
          TableName: SIGNUPS_TABLE,
          IndexName: 'EventIndex',
          KeyConditionExpression: 'event_id = :eventId',
          ExpressionAttributeValues: {
            ':eventId': eventId
          }
        }).promise();

        const maxOrder = signupsResult.Items.length > 0 
          ? Math.max(...signupsResult.Items.map(s => s.performance_order || 0))
          : 0;

        // Create walk-in signup
        const walkInSignup = {
          id: uuidv4(),
          event_id: eventId,
          user_id: null, // Walk-ins don't have user accounts
          performer_name: performerName,
          performance_name: performanceName || performerName, // Use performer name as fallback
          performance_type: performanceType || 'music',
          notes: notes || '',
          performance_order: maxOrder + 1,
          is_walk_in: true,
          signed_up_at: new Date().toISOString(),
          is_finished: false,
          is_current_performer: false,
          status: 'confirmed', // Add status field that might be required
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        console.log('Creating walk-in signup:', walkInSignup);

        await dynamodb.put({
          TableName: SIGNUPS_TABLE,
          Item: walkInSignup
        }).promise();

        console.log('Walk-in signup created successfully');

        return {
          statusCode: 201,
          headers: corsHeaders,
          body: JSON.stringify({ 
            message: 'Walk-in performer added successfully',
            signup: walkInSignup
          })
        };
      } catch (error) {
        console.error('Error adding walk-in performer:', error);
        console.error('Error details:', error.message);
        console.error('Error stack:', error.stack);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ 
            message: 'Failed to add walk-in performer',
            error: error.message 
          })
        };
      }
    }

    // Delete conversation (direct messages only)
    if (path.match(/^\/api\/chat\/conversations\/[^\/]+$/) && httpMethod === 'DELETE') {
      const user = await authenticate();
      if (!user) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Unauthorized' })
        };
      }

      const conversationId = path.split('/')[4];

      try {
        // Get conversation to verify ownership
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

        // Only allow deletion of direct messages by participants
        if (conversation.Item.type === 'group') {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Cannot delete group chats. Use leave instead.' })
          };
        }

        // Verify user is a participant
        if (conversation.Item.participant_1_id !== user.id && 
            conversation.Item.participant_2_id !== user.id) {
          return {
            statusCode: 403,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Access denied' })
          };
        }

        // Delete all messages in the conversation
        const messagesResult = await dynamodb.query({
          TableName: MESSAGES_TABLE,
          IndexName: 'ConversationIndex',
          KeyConditionExpression: 'conversation_id = :conversationId',
          ExpressionAttributeValues: {
            ':conversationId': conversationId
          }
        }).promise();

        // Delete messages in batches
        if (messagesResult.Items.length > 0) {
          const deleteRequests = messagesResult.Items.map(message => ({
            DeleteRequest: {
              Key: { id: message.id }
            }
          }));

          for (let i = 0; i < deleteRequests.length; i += 25) {
            const batch = deleteRequests.slice(i, i + 25);
            await dynamodb.batchWrite({
              RequestItems: {
                [MESSAGES_TABLE]: batch
              }
            }).promise();
          }
        }

        // Delete the conversation
        await dynamodb.delete({
          TableName: CONVERSATIONS_TABLE,
          Key: { id: conversationId }
        }).promise();

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Conversation deleted successfully' })
        };
      } catch (error) {
        console.error('Error deleting conversation:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Failed to delete conversation' })
        };
      }
    }

    // ===== EVENT GROUP CHAT ENDPOINTS =====

    // Create event group chat (host only)
    if (path.match(/^\/api\/events\/[^\/]+\/chat\/create$/) && httpMethod === 'POST') {
      const user = await authenticate();
      if (!user) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Unauthorized' })
        };
      }

      try {
        const eventId = path.split('/')[3];

        // Check if user is the event host
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

        const event = eventResult.Item;
        if (event.host_id !== user.id) {
          return {
            statusCode: 403,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Only event hosts can create group chats' })
          };
        }

        // Check if group chat already exists
        const existingChatResult = await dynamodb.query({
          TableName: CONVERSATIONS_TABLE,
          IndexName: 'EventIndex',
          KeyConditionExpression: 'event_id = :eventId',
          ExpressionAttributeValues: {
            ':eventId': eventId
          }
        }).promise();

        if (existingChatResult.Items.length > 0) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Group chat already exists for this event' })
          };
        }

        // Create group chat with event title and date
        const eventDate = new Date(event.date).toLocaleDateString('en-US', { 
          weekday: 'short', 
          month: 'short', 
          day: 'numeric' 
        });
        const groupChatId = uuidv4();
        const groupChat = {
          id: groupChatId,
          type: 'group',
          event_id: eventId,
          title: `${event.title} - ${eventDate}`,
          created_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_message_id: null,
          last_message_at: null
        };

        await dynamodb.put({
          TableName: CONVERSATIONS_TABLE,
          Item: groupChat
        }).promise();

        // Add the event host as the first participant
        const hostParticipant = {
          id: uuidv4(),
          conversation_id: groupChatId,
          user_id: user.id,
          joined_at: new Date().toISOString(),
          role: 'admin'
        };

        await dynamodb.put({
          TableName: CONVERSATION_PARTICIPANTS_TABLE,
          Item: hostParticipant
        }).promise();

        return {
          statusCode: 201,
          headers: corsHeaders,
          body: JSON.stringify({ 
            message: 'Group chat created successfully',
            conversation: groupChat
          })
        };
      } catch (error) {
        console.error('Error creating event group chat:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Failed to create event group chat' })
        };
      }
    }

    // Get event group chat
    if (path.match(/^\/api\/events\/[^\/]+\/chat$/) && httpMethod === 'GET') {
      const user = await authenticate();
      if (!user) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Unauthorized' })
        };
      }

      try {
        const eventId = path.split('/')[3];

        // Find the group chat for this event
        const chatResult = await dynamodb.query({
          TableName: CONVERSATIONS_TABLE,
          IndexName: 'EventIndex',
          KeyConditionExpression: 'event_id = :eventId',
          ExpressionAttributeValues: {
            ':eventId': eventId
          }
        }).promise();

        if (chatResult.Items.length === 0) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Event group chat not found' })
          };
        }

        const groupChat = chatResult.Items[0];

        // Check if user is a participant
        const participantResult = await dynamodb.query({
          TableName: CONVERSATION_PARTICIPANTS_TABLE,
          IndexName: 'ConversationIndex',
          KeyConditionExpression: 'conversation_id = :conversationId',
          FilterExpression: 'user_id = :userId',
          ExpressionAttributeValues: {
            ':conversationId': groupChat.id,
            ':userId': user.id
          }
        }).promise();

        if (participantResult.Items.length === 0) {
          return {
            statusCode: 403,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'You are not a participant in this group chat' })
          };
        }

        // Get all participants
        const allParticipants = await dynamodb.query({
          TableName: CONVERSATION_PARTICIPANTS_TABLE,
          IndexName: 'ConversationIndex',
          KeyConditionExpression: 'conversation_id = :conversationId',
          ExpressionAttributeValues: {
            ':conversationId': groupChat.id
          }
        }).promise();

        // Get participant user details
        const participantUsers = [];
        for (const participant of allParticipants.Items) {
          const userResult = await dynamodb.get({
            TableName: USERS_TABLE,
            Key: { id: participant.user_id }
          }).promise();
          if (userResult.Item) {
            participantUsers.push({
              id: userResult.Item.id,
              name: userResult.Item.name,
              email: userResult.Item.email,
              role: participant.role || 'member'
            });
          }
        }

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            conversation: {
              ...groupChat,
              participants: participantUsers,
              participant_count: participantUsers.length
            }
          })
        };
      } catch (error) {
        console.error('Error fetching event group chat:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Failed to fetch event group chat' })
        };
      }
    }

    // Join event group chat
    if (path.match(/^\/api\/events\/[^\/]+\/chat\/join$/) && httpMethod === 'POST') {
      const user = await authenticate();
      if (!user) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Unauthorized' })
        };
      }

      try {
        const eventId = path.split('/')[3];

        // Check if user is signed up for the event or is the host
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

        const event = eventResult.Item;
        const isHost = event.host_id === user.id;

        // Check if user has a signup for this event
        let hasSignup = false;
        if (!isHost) {
          const signupResult = await dynamodb.query({
            TableName: SIGNUPS_TABLE,
            IndexName: 'EventIndex',
            KeyConditionExpression: 'event_id = :eventId',
            FilterExpression: 'user_id = :userId',
            ExpressionAttributeValues: {
              ':eventId': eventId,
              ':userId': user.id
            }
          }).promise();
          hasSignup = signupResult.Items.length > 0;
        }

        if (!isHost && !hasSignup) {
          return {
            statusCode: 403,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'You must be signed up for this event to join the group chat' })
          };
        }

        // Find the group chat for this event
        const chatResult = await dynamodb.query({
          TableName: CONVERSATIONS_TABLE,
          IndexName: 'EventIndex',
          KeyConditionExpression: 'event_id = :eventId',
          ExpressionAttributeValues: {
            ':eventId': eventId
          }
        }).promise();

        if (chatResult.Items.length === 0) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Event group chat not found' })
          };
        }

        const groupChat = chatResult.Items[0];

        // Check if user is already a participant
        const existingParticipant = await dynamodb.query({
          TableName: CONVERSATION_PARTICIPANTS_TABLE,
          IndexName: 'ConversationIndex',
          KeyConditionExpression: 'conversation_id = :conversationId',
          FilterExpression: 'user_id = :userId',
          ExpressionAttributeValues: {
            ':conversationId': groupChat.id,
            ':userId': user.id
          }
        }).promise();

        if (existingParticipant.Items.length > 0) {
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Already a participant in this group chat' })
          };
        }

        // Add user as participant
        const participant = {
          id: uuidv4(),
          conversation_id: groupChat.id,
          user_id: user.id,
          joined_at: new Date().toISOString(),
          role: isHost ? 'admin' : 'member'
        };

        await dynamodb.put({
          TableName: CONVERSATION_PARTICIPANTS_TABLE,
          Item: participant
        }).promise();

        // Send a system message about the user joining
        const joinMessage = {
          id: uuidv4(),
          conversation_id: groupChat.id,
          sender_id: 'system',
          message_text: `${user.name} joined the group chat`,
          timestamp: new Date().toISOString(),
          message_type: 'system'
        };

        await dynamodb.put({
          TableName: MESSAGES_TABLE,
          Item: joinMessage
        }).promise();

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ 
            message: 'Successfully joined group chat',
            conversation: groupChat
          })
        };
      } catch (error) {
        console.error('Error joining event group chat:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Failed to join event group chat' })
        };
      }
    }

    // Leave event group chat
    if (path.match(/^\/api\/events\/[^\/]+\/chat\/leave$/) && httpMethod === 'POST') {
      const user = await authenticate();
      if (!user) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Unauthorized' })
        };
      }

      try {
        const eventId = path.split('/')[3];

        // Find the group chat for this event
        const chatResult = await dynamodb.query({
          TableName: CONVERSATIONS_TABLE,
          IndexName: 'EventIndex',
          KeyConditionExpression: 'event_id = :eventId',
          ExpressionAttributeValues: {
            ':eventId': eventId
          }
        }).promise();

        if (chatResult.Items.length === 0) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Event group chat not found' })
          };
        }

        const groupChat = chatResult.Items[0];

        // Find user's participation
        const participantResult = await dynamodb.query({
          TableName: CONVERSATION_PARTICIPANTS_TABLE,
          IndexName: 'ConversationIndex',
          KeyConditionExpression: 'conversation_id = :conversationId',
          FilterExpression: 'user_id = :userId',
          ExpressionAttributeValues: {
            ':conversationId': groupChat.id,
            ':userId': user.id
          }
        }).promise();

        if (participantResult.Items.length === 0) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'You are not a participant in this group chat' })
          };
        }

        const participant = participantResult.Items[0];

        // Remove participant
        await dynamodb.delete({
          TableName: CONVERSATION_PARTICIPANTS_TABLE,
          Key: { id: participant.id }
        }).promise();

        // Send a system message about the user leaving
        const leaveMessage = {
          id: uuidv4(),
          conversation_id: groupChat.id,
          sender_id: 'system',
          message_text: `${user.name} left the group chat`,
          timestamp: new Date().toISOString(),
          message_type: 'system'
        };

        await dynamodb.put({
          TableName: MESSAGES_TABLE,
          Item: leaveMessage
        }).promise();

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Successfully left group chat' })
        };
      } catch (error) {
        console.error('Error leaving event group chat:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Failed to leave event group chat' })
        };
      }
    }

    // Delete event group chat (admin only)
    if (path.match(/^\/api\/events\/[^\/]+\/chat\/delete$/) && httpMethod === 'DELETE') {
      const user = await authenticate();
      if (!user) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Unauthorized' })
        };
      }

      try {
        const eventId = path.split('/')[3];

        // Get the event group chat
        const existingChatResult = await dynamodb.query({
          TableName: CONVERSATIONS_TABLE,
          IndexName: 'EventIndex',
          KeyConditionExpression: 'event_id = :eventId',
          ExpressionAttributeValues: {
            ':eventId': eventId
          }
        }).promise();

        if (existingChatResult.Items.length === 0) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Group chat not found' })
          };
        }

        const groupChat = existingChatResult.Items[0];

        // Check if user is admin (creator) of the group chat
        if (groupChat.created_by !== user.id) {
          return {
            statusCode: 403,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Only group chat admins can delete the group chat' })
          };
        }

        // Delete all messages in the conversation
        const messagesResult = await dynamodb.query({
          TableName: MESSAGES_TABLE,
          IndexName: 'ConversationIndex',
          KeyConditionExpression: 'conversation_id = :conversationId',
          ExpressionAttributeValues: {
            ':conversationId': groupChat.id
          }
        }).promise();

        // Delete messages in batches
        if (messagesResult.Items.length > 0) {
          const deleteRequests = messagesResult.Items.map(message => ({
            DeleteRequest: {
              Key: { id: message.id }
            }
          }));

          // DynamoDB batch write can handle up to 25 items at a time
          for (let i = 0; i < deleteRequests.length; i += 25) {
            const batch = deleteRequests.slice(i, i + 25);
            await dynamodb.batchWrite({
              RequestItems: {
                [MESSAGES_TABLE]: batch
              }
            }).promise();
          }
        }

        // Delete all participants
        const participantsResult = await dynamodb.query({
          TableName: CONVERSATION_PARTICIPANTS_TABLE,
          IndexName: 'ConversationIndex',
          KeyConditionExpression: 'conversation_id = :conversationId',
          ExpressionAttributeValues: {
            ':conversationId': groupChat.id
          }
        }).promise();

        if (participantsResult.Items.length > 0) {
          const deleteParticipantRequests = participantsResult.Items.map(participant => ({
            DeleteRequest: {
              Key: { id: participant.id }
            }
          }));

          // Delete participants in batches
          for (let i = 0; i < deleteParticipantRequests.length; i += 25) {
            const batch = deleteParticipantRequests.slice(i, i + 25);
            await dynamodb.batchWrite({
              RequestItems: {
                [CONVERSATION_PARTICIPANTS_TABLE]: batch
              }
            }).promise();
          }
        }

        // Finally, delete the conversation itself
        await dynamodb.delete({
          TableName: CONVERSATIONS_TABLE,
          Key: { id: groupChat.id }
        }).promise();

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Group chat deleted successfully' })
        };
      } catch (error) {
        console.error('Error deleting event group chat:', error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Failed to delete event group chat' })
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