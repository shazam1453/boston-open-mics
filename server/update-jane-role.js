// Script to update Jane's role to super_admin
const AWS = require('aws-sdk');

const dynamodb = new AWS.DynamoDB.DocumentClient({
  region: 'us-east-2'
});

const USERS_TABLE = 'boston-open-mics-api-prod-users';

const updateJaneRole = async () => {
  console.log('🔧 Updating Jane\'s role to super_admin...');

  try {
    // First, find Jane's user ID
    const result = await dynamodb.query({
      TableName: USERS_TABLE,
      IndexName: 'EmailIndex',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': 'jane@example.com'
      }
    }).promise();

    if (result.Items.length === 0) {
      console.error('❌ Jane not found in database');
      return;
    }

    const jane = result.Items[0];
    console.log(`📝 Found Jane: ${jane.name} (${jane.id})`);
    console.log(`📝 Current role: ${jane.role}`);

    // Update her role to super_admin
    await dynamodb.update({
      TableName: USERS_TABLE,
      Key: { id: jane.id },
      UpdateExpression: 'SET #role = :role, updated_at = :updated_at',
      ExpressionAttributeNames: {
        '#role': 'role'
      },
      ExpressionAttributeValues: {
        ':role': 'super_admin',
        ':updated_at': new Date().toISOString()
      }
    }).promise();

    console.log('✅ Jane\'s role updated to super_admin successfully!');
    console.log('');
    console.log('Jane can now:');
    console.log('- Update user roles in the admin panel');
    console.log('- Delete her own account');
    console.log('- Access all super admin features');

  } catch (error) {
    console.error('❌ Error updating Jane\'s role:', error);
  }
};

updateJaneRole();