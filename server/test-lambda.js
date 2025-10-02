// Test script for the DynamoDB Lambda function
const { handler } = require('./lambda-dynamodb');

// Mock environment variables
process.env.USERS_TABLE = 'test-users';
process.env.VENUES_TABLE = 'test-venues';
process.env.EVENTS_TABLE = 'test-events';
process.env.SIGNUPS_TABLE = 'test-signups';

// Test health check
const testHealthCheck = async () => {
  console.log('🔍 Testing health check...');
  
  const event = {
    path: '/health',
    httpMethod: 'GET',
    headers: {},
    queryStringParameters: null,
    body: null
  };
  
  try {
    const result = await handler(event, {});
    console.log('✅ Health check response:', JSON.parse(result.body));
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
  }
};

// Test 404 route
const test404 = async () => {
  console.log('🔍 Testing 404 route...');
  
  const event = {
    path: '/nonexistent',
    httpMethod: 'GET',
    headers: {},
    queryStringParameters: null,
    body: null
  };
  
  try {
    const result = await handler(event, {});
    console.log('✅ 404 response:', JSON.parse(result.body));
  } catch (error) {
    console.error('❌ 404 test failed:', error.message);
  }
};

// Run tests
const runTests = async () => {
  console.log('🧪 Testing Lambda function locally...\n');
  
  await testHealthCheck();
  console.log('');
  await test404();
  
  console.log('\n✅ Local tests completed!');
  console.log('Note: DynamoDB operations will fail without proper AWS credentials and tables.');
};

runTests().catch(console.error);