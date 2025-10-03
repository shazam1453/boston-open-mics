const AWS = require('aws-sdk')

// Configure AWS DynamoDB
const dynamodb = new AWS.DynamoDB.DocumentClient({
  region: process.env.AWS_REGION || 'us-east-2'
})

const USERS_TABLE = 'boston-open-mics-api-prod-users'

async function checkUsersCount() {
  console.log('🔍 Checking users in database...\n')

  try {
    // Scan all users
    const result = await dynamodb.scan({
      TableName: USERS_TABLE
    }).promise()

    console.log(`📊 Total users in database: ${result.Items.length}`)
    
    if (result.Items.length > 0) {
      console.log('\n👥 Users found:')
      result.Items.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name} (${user.email}) - ${user.performer_type || 'no type'}`)
      })
      
      console.log('\n🔍 Testing search logic:')
      const testQuery = 'john'
      const queryLower = testQuery.toLowerCase()
      
      const matches = result.Items.filter(u => {
        const name = (u.name || '').toLowerCase()
        const email = (u.email || '').toLowerCase()
        const performerType = (u.performer_type || '').toLowerCase()
        
        const nameMatch = name.includes(queryLower)
        const emailMatch = email.includes(queryLower)
        const typeMatch = performerType.includes(queryLower)
        
        console.log(`Testing ${u.name}:`, {
          name: name,
          nameMatch,
          email: email,
          emailMatch,
          performerType: performerType,
          typeMatch,
          overallMatch: nameMatch || emailMatch || typeMatch
        })
        
        return nameMatch || emailMatch || typeMatch
      })
      
      console.log(`\n🎯 Search for "${testQuery}" would return ${matches.length} results`)
    } else {
      console.log('\n❌ No users found in database!')
      console.log('💡 You may need to run the seed script:')
      console.log('node seed-dynamodb.js')
    }

  } catch (error) {
    console.error('❌ Error checking users:', error.message)
  }
}

// Run the check
checkUsersCount().then(() => {
  console.log('\n✅ User count check complete!')
}).catch(error => {
  console.error('Check failed:', error)
  process.exit(1)
})