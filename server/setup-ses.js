const AWS = require('aws-sdk')

// Configure AWS SES
const ses = new AWS.SES({
  region: process.env.AWS_REGION || 'us-east-2',
  apiVersion: '2010-12-01'
})

async function setupSES() {
  console.log('🔧 Setting up AWS SES for Boston Open Mics...\n')

  try {
    // Check current SES sending quota and limits
    console.log('📊 Checking SES sending quota...')
    const quota = await ses.getSendQuota().promise()
    console.log(`Max 24 Hour Send: ${quota.Max24HourSend}`)
    console.log(`Max Send Rate: ${quota.MaxSendRate} emails/second`)
    console.log(`Sent Last 24h: ${quota.SentLast24Hours}\n`)

    // List verified email addresses
    console.log('📧 Checking verified email addresses...')
    const identities = await ses.listIdentities().promise()
    console.log('Verified identities:', identities.Identities)

    if (identities.Identities.length === 0) {
      console.log('\n⚠️  No verified email addresses found!')
      console.log('\n📝 To enable email sending, you need to:')
      console.log('1. Verify your sender email address in AWS SES')
      console.log('2. If in sandbox mode, verify recipient emails too')
      console.log('3. Request production access to send to any email\n')
      
      console.log('🔗 Useful AWS CLI commands:')
      console.log('aws ses verify-email-identity --email-address noreply@yourdomain.com')
      console.log('aws ses put-configuration-set --configuration-set Name=boston-open-mics')
      console.log('aws ses describe-account-sending-enabled')
    }

    // Check if we're in sandbox mode
    console.log('\n🏖️  Checking SES sandbox status...')
    try {
      const accountAttributes = await ses.getAccountSendingEnabled().promise()
      console.log('Sending enabled:', accountAttributes.Enabled)
    } catch (error) {
      console.log('Could not check account status:', error.message)
    }

    // Test email sending capability
    console.log('\n🧪 Testing email sending capability...')
    const testEmail = process.env.TEST_EMAIL || 'test@example.com'
    const fromEmail = process.env.FROM_EMAIL || 'noreply@bostonopenmic.com'
    
    console.log(`From: ${fromEmail}`)
    console.log(`To: ${testEmail}`)
    
    try {
      const result = await ses.sendEmail({
        Destination: {
          ToAddresses: [testEmail]
        },
        Message: {
          Body: {
            Html: {
              Charset: 'UTF-8',
              Data: `
                <h2>🎤 Boston Open Mics - SES Test</h2>
                <p>This is a test email to verify SES configuration.</p>
                <p>Timestamp: ${new Date().toISOString()}</p>
              `
            },
            Text: {
              Charset: 'UTF-8',
              Data: `Boston Open Mics - SES Test\n\nThis is a test email to verify SES configuration.\n\nTimestamp: ${new Date().toISOString()}`
            }
          },
          Subject: {
            Charset: 'UTF-8',
            Data: 'Boston Open Mics - SES Configuration Test'
          }
        },
        Source: fromEmail
      }).promise()
      
      console.log('✅ Test email sent successfully!')
      console.log('Message ID:', result.MessageId)
    } catch (error) {
      console.log('❌ Test email failed:', error.message)
      
      if (error.code === 'MessageRejected') {
        console.log('\n💡 Common solutions:')
        console.log('- Verify the sender email address in SES')
        console.log('- If in sandbox mode, verify the recipient email too')
        console.log('- Check that both sender and recipient are verified')
      }
    }

  } catch (error) {
    console.error('❌ Error setting up SES:', error.message)
  }
}

// Run the setup
setupSES().then(() => {
  console.log('\n🎯 SES setup check complete!')
}).catch(error => {
  console.error('Setup failed:', error)
  process.exit(1)
})