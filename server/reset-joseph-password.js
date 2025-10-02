// Script to reset Joseph's password to password123
const AWS = require('aws-sdk');
const crypto = require('crypto');

const dynamodb = new AWS.DynamoDB.DocumentClient({
  region: 'us-east-2'
});

const USERS_TABLE = 'boston-open-mics-api-prod-users';

// Password hashing function (same as in lambda)
const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hashedPassword = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex') + ':' + salt;
  return hashedPassword;
};

const resetJosephPassword = async () => {
  console.log('🔧 Resetting Joseph\'s password to "password123"...');

  try {
    const josephId = '7c844f36-e3b0-426c-a815-011b6acdd470';
    const newPassword = hashPassword('password123');

    await dynamodb.update({
      TableName: USERS_TABLE,
      Key: { id: josephId },
      UpdateExpression: 'SET password = :password, updated_at = :updated_at',
      ExpressionAttributeValues: {
        ':password': newPassword,
        ':updated_at': new Date().toISOString()
      }
    }).promise();

    console.log('✅ Joseph\'s password has been reset to "password123"');
    console.log('');
    console.log('Joseph can now login with:');
    console.log('- Email: finch749@gmail.com');
    console.log('- Password: password123');
    console.log('- Role: super_admin');

  } catch (error) {
    console.error('❌ Error resetting password:', error);
  }
};

resetJosephPassword();