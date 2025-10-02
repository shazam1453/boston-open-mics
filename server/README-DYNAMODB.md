# Boston Open Mics API - DynamoDB Deployment

This directory contains the serverless AWS Lambda deployment of the Boston Open Mics API using DynamoDB as the database.

## 🏗️ Architecture

- **AWS Lambda**: Serverless compute for API endpoints
- **API Gateway**: HTTP API routing and CORS handling
- **DynamoDB**: NoSQL database with pay-per-request billing
- **Node.js 18.x**: Runtime environment

## 📊 Database Schema

### Tables

1. **Users Table**
   - Primary Key: `id` (String)
   - Global Secondary Index: `EmailIndex` on `email`
   - Fields: id, name, email, password, phone, performer_type, bio, role, social media handles

2. **Venues Table**
   - Primary Key: `id` (String)
   - Global Secondary Index: `OwnerIndex` on `owner_id`
   - Fields: id, name, address, description, capacity, owner_id

3. **Events Table**
   - Primary Key: `id` (String)
   - Global Secondary Indexes: `DateIndex` on `date`, `HostIndex` on `host_id`
   - Fields: id, title, description, venue_id, date, times, max_performers, etc.

4. **Signups Table**
   - Primary Key: `id` (String)
   - Global Secondary Indexes: `EventIndex` on `event_id`, `UserIndex` on `user_id`
   - Fields: id, event_id, user_id, performance details, status, order

## 🚀 Deployment

### Prerequisites

1. **AWS CLI** configured with appropriate credentials
2. **Serverless Framework** installed globally
3. **Node.js 18+** installed

### Quick Deploy

```bash
# Install Serverless Framework
npm install -g serverless

# Deploy to production
./deploy.sh
```

### Manual Deploy

```bash
# Install dependencies
npm install

# Deploy to AWS
serverless deploy --stage prod

# Deploy to development
serverless deploy --stage dev
```

## 🔧 Configuration

### Environment Variables

The following environment variables are automatically set by the serverless deployment:

- `USERS_TABLE`: DynamoDB users table name
- `VENUES_TABLE`: DynamoDB venues table name
- `EVENTS_TABLE`: DynamoDB events table name
- `SIGNUPS_TABLE`: DynamoDB signups table name

### AWS Permissions

The Lambda function has the following DynamoDB permissions:
- Query, Scan, GetItem, PutItem, UpdateItem, DeleteItem
- Access to all tables and their indexes

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update user profile

### Events
- `GET /api/events` - List all events
- `GET /api/events/{id}` - Get event details
- `POST /api/events` - Create new event
- `PUT /api/events/{id}` - Update event
- `POST /api/events/{id}/randomize-order` - Randomize signup order

### Venues
- `GET /api/venues` - List all venues
- `POST /api/venues` - Create new venue

### Signups
- `GET /api/signups/event/{eventId}` - Get event signups
- `POST /api/signups` - Sign up for event
- `GET /api/signups/my-signups` - Get user's signups
- `PUT /api/signups/event/{eventId}/order` - Reorder signups
- `PUT /api/signups/{id}/finish` - Mark performance as finished
- `PUT /api/signups/{id}/unfinish` - Unmark performance as finished

### Admin (Role-based access)
- `GET /api/admin/users` - List all users
- `DELETE /api/admin/users/{id}` - Delete user
- `PUT /api/admin/users/{id}/role` - Update user role
- `GET /api/admin/events` - List all events
- `DELETE /api/admin/events/{id}` - Delete event
- `GET /api/admin/venues` - List all venues
- `DELETE /api/admin/venues/{id}` - Delete venue

### Utilities
- `GET /api/users/search` - Search users
- `POST /api/invitations/send` - Send email invitation
- `GET /health` - Health check

## 🔐 Security Features

- **Password Hashing**: Uses Node.js crypto with PBKDF2 and salt
- **JWT-like Tokens**: Secure token-based authentication
- **Role-based Access**: User, Moderator, Admin, Super Admin roles
- **CORS**: Configured for cross-origin requests
- **Input Validation**: Server-side validation for all endpoints

## 💰 Cost Estimation

### DynamoDB
- **Pay-per-request billing**: $1.25 per million read/write requests
- **Storage**: $0.25 per GB per month
- **Estimated monthly cost**: $1-5 for typical usage

### Lambda
- **Requests**: $0.20 per million requests
- **Duration**: $0.0000166667 per GB-second
- **Estimated monthly cost**: $1-3 for typical usage

### API Gateway
- **HTTP API**: $1.00 per million requests
- **Estimated monthly cost**: $1-2 for typical usage

**Total estimated monthly cost: $3-10**

## 🧪 Testing

### Local Testing
```bash
# Test Lambda function locally (without DynamoDB)
node test-lambda.js
```

### Production Testing
```bash
# Test health endpoint
curl https://your-api-id.execute-api.us-east-2.amazonaws.com/prod/health

# Test API endpoint
curl https://your-api-id.execute-api.us-east-2.amazonaws.com/prod/api/events
```

## 📝 Logs and Monitoring

- **CloudWatch Logs**: Automatic logging for all Lambda executions
- **CloudWatch Metrics**: Built-in metrics for Lambda and DynamoDB
- **X-Ray Tracing**: Optional distributed tracing (can be enabled)

## 🔄 Updates and Maintenance

### Updating the API
1. Make changes to `lambda-dynamodb.js`
2. Run `serverless deploy --stage prod`
3. Update client environment variables if needed

### Database Migrations
DynamoDB is schemaless, but for structural changes:
1. Update table definitions in `serverless.yml`
2. Deploy with `serverless deploy`
3. Run data migration scripts if needed

## 🚨 Troubleshooting

### Common Issues

1. **Permission Errors**: Ensure AWS credentials have DynamoDB and Lambda permissions
2. **Table Not Found**: Verify tables are created and names match environment variables
3. **CORS Issues**: Check API Gateway CORS configuration in serverless.yml
4. **Cold Starts**: First request may be slower due to Lambda cold start

### Debugging

1. Check CloudWatch Logs for detailed error messages
2. Use `serverless logs -f api --tail` to stream logs
3. Test endpoints individually with curl or Postman

## 📚 Additional Resources

- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [DynamoDB Documentation](https://docs.aws.amazon.com/dynamodb/)
- [Serverless Framework Documentation](https://www.serverless.com/framework/docs/)