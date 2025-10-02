// Script to check all users in the database
const AWS = require('aws-sdk');

const dynamodb = new AWS.DynamoDB.DocumentClient({
  region: 'us-east-2'
});

const USERS_TABLE = 'boston-open-mics-api-prod-users';

const checkUsers = async () => {
  console.log('🔍 Checking all users in database...');

  try {
    const result = await dynamodb.scan({
      TableName: USERS_TABLE
    }).promise();

    console.log(`📊 Found ${result.Items.length} users:`);
    console.log('');

    result.Items.forEach(user => {
      console.log(`👤 ${user.name} (${user.email})`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Updated: ${user.updated_at}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error checking users:', error);
  }
};

checkUsers();