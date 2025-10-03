const AWS = require('aws-sdk')

// Configure AWS SES
const ses = new AWS.SES({
  region: process.env.AWS_REGION || 'us-east-2',
  apiVersion: '2010-12-01'
})

async function checkEmailStatus() {
  console.log('🔍 Checking Boston Showtime email verification status...\n')

  try {
    // List verified identities
    const identities = await ses.listIdentities().promise()
    console.log('📧 All verified identities:', identities.Identities)

    const domain = 'bostonshowtime.com'
    const fromEmail = 'noreply@bostonshowtime.com'

    // Check verification status
    const verificationAttributes = await ses.getIdentityVerificationAttributes({
      Identities: [domain, fromEmail]
    }).promise()

    console.log('\n📋 Verification Status:')
    
    if (verificationAttributes.VerificationAttributes[domain]) {
      const domainStatus = verificationAttributes.VerificationAttributes[domain]
      console.log(`Domain (${domain}):`, domainStatus.VerificationStatus)
      if (domainStatus.VerificationToken) {
        console.log(`  Verification Token: ${domainStatus.VerificationToken}`)
      }
    } else {
      console.log(`Domain (${domain}): Not initiated`)
    }

    if (verificationAttributes.VerificationAttributes[fromEmail]) {
      const emailStatus = verificationAttributes.VerificationAttributes[fromEmail]
      console.log(`Email (${fromEmail}):`, emailStatus.VerificationStatus)
    } else {
      console.log(`Email (${fromEmail}): Not initiated`)
    }

    // Check if we can send emails
    const canSend = identities.Identities.includes(domain) || identities.Identities.includes(fromEmail)
    
    console.log(`\n🚀 Email sending status: ${canSend ? '✅ Ready' : '❌ Not ready'}`)

    if (canSend) {
      console.log('\n🎯 Email system is ready! You can now:')
      console.log('- Send password reset emails')
      console.log('- Send event invitations')
      console.log('- Send event reminders')
      console.log('\nRun: node test-email.js to test all email templates')
    } else {
      console.log('\n⏳ Waiting for verification...')
      console.log('Make sure you have added the DNS TXT record:')
      console.log('Name: _amazonses.bostonshowtime.com')
      console.log('Value: K3xYEj68fdTunN7vRTTX4rEbUvUBsOWkPRCCtIDwZqU=')
    }

    // Check sending quota
    const quota = await ses.getSendQuota().promise()
    console.log(`\n📊 Sending Limits:`)
    console.log(`Max 24 Hour Send: ${quota.Max24HourSend}`)
    console.log(`Max Send Rate: ${quota.MaxSendRate} emails/second`)
    console.log(`Sent Last 24h: ${quota.SentLast24Hours}`)

  } catch (error) {
    console.error('❌ Error checking email status:', error.message)
  }
}

// Run the check
checkEmailStatus().then(() => {
  console.log('\n✅ Email status check complete!')
}).catch(error => {
  console.error('Check failed:', error)
  process.exit(1)
})