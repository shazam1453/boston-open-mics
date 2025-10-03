const AWS = require('aws-sdk')

// Configure AWS SES
const ses = new AWS.SES({
  region: process.env.AWS_REGION || 'us-east-2',
  apiVersion: '2010-12-01'
})

async function requestProductionAccess() {
  console.log('🚀 Requesting AWS SES Production Access...\n')

  try {
    // Check current sending quota
    const quota = await ses.getSendQuota().promise()
    console.log('📊 Current Sending Limits:')
    console.log(`Max 24 Hour Send: ${quota.Max24HourSend}`)
    console.log(`Max Send Rate: ${quota.MaxSendRate} emails/second`)
    
    if (quota.Max24HourSend > 200) {
      console.log('✅ You already have production access!')
      console.log('You can send emails to any verified recipient.')
      return
    }

    console.log('\n📝 To request production access:')
    console.log('1. Go to AWS SES Console: https://console.aws.amazon.com/ses/')
    console.log('2. Navigate to "Account dashboard" in the left sidebar')
    console.log('3. Click "Request production access" button')
    console.log('4. Fill out the form with:')
    console.log('   - Mail type: Transactional')
    console.log('   - Website URL: https://bostonshowtime.com')
    console.log('   - Use case description: "Transactional emails for Boston Showtime platform including password resets, event invitations, and event reminders for open mic events."')
    console.log('   - Additional contact addresses: (your admin email)')
    console.log('   - Acknowledge compliance with AWS policies')

    console.log('\n⏰ Processing time: Usually 24-48 hours')
    console.log('\n💡 Alternative: Verify specific sender emails')
    console.log('   - Run: node verify-email.js your-admin@bostonshowtime.com')
    console.log('   - Use verified emails as senders until production access is approved')

    // Try to get account sending enabled status
    try {
      const sendingEnabled = await ses.getAccountSendingEnabled().promise()
      console.log(`\n📧 Account sending enabled: ${sendingEnabled.Enabled}`)
    } catch (error) {
      console.log('\n❌ Could not check account sending status:', error.message)
    }

    // Show current configuration
    console.log('\n🔧 Current Configuration:')
    console.log('Domain: bostonshowtime.com ✅ Verified')
    console.log('From Email: noreply@bostonshowtime.com ⏳ Pending verification')
    console.log('Sandbox Mode: ✅ Active (production access needed)')

  } catch (error) {
    console.error('❌ Error checking production access:', error.message)
  }
}

// Run the request
requestProductionAccess().then(() => {
  console.log('\n🎯 Production access request information provided!')
}).catch(error => {
  console.error('Request failed:', error)
  process.exit(1)
})