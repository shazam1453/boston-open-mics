const AWS = require('aws-sdk')

// Configure AWS SES
const ses = new AWS.SES({
  region: process.env.AWS_REGION || 'us-east-2',
  apiVersion: '2010-12-01'
})

async function setupDomainEmail() {
  console.log('🔧 Setting up email for bostonshowtime.com domain...\n')

  try {
    // Check current SES sending quota and limits
    console.log('📊 Checking SES sending quota...')
    const quota = await ses.getSendQuota().promise()
    console.log(`Max 24 Hour Send: ${quota.Max24HourSend}`)
    console.log(`Max Send Rate: ${quota.MaxSendRate} emails/second`)
    console.log(`Sent Last 24h: ${quota.SentLast24Hours}\n`)

    // List verified email addresses and domains
    console.log('📧 Checking verified identities...')
    const identities = await ses.listIdentities().promise()
    console.log('Verified identities:', identities.Identities)

    const domain = 'bostonshowtime.com'
    const fromEmail = 'noreply@bostonshowtime.com'

    // Check if domain is verified
    const isDomainVerified = identities.Identities.includes(domain)
    const isEmailVerified = identities.Identities.includes(fromEmail)

    console.log(`\n📋 Domain Status:`)
    console.log(`Domain (${domain}): ${isDomainVerified ? '✅ Verified' : '❌ Not Verified'}`)
    console.log(`Email (${fromEmail}): ${isEmailVerified ? '✅ Verified' : '❌ Not Verified'}`)

    if (!isDomainVerified && !isEmailVerified) {
      console.log('\n⚠️  Neither domain nor email is verified!')
      console.log('\n📝 To enable email sending, you need to:')
      console.log('1. Verify the domain bostonshowtime.com in AWS SES')
      console.log('2. Or verify the specific email noreply@bostonshowtime.com')
      console.log('3. If in sandbox mode, verify recipient emails too')
      console.log('4. Request production access to send to any email\n')
      
      console.log('🔗 AWS CLI commands to verify:')
      console.log(`aws ses verify-domain-identity --domain ${domain}`)
      console.log(`aws ses verify-email-identity --email-address ${fromEmail}`)
      
      // Try to verify the domain
      console.log('\n🚀 Attempting to verify domain...')
      try {
        const verifyResult = await ses.verifyDomainIdentity({
          Domain: domain
        }).promise()
        console.log('✅ Domain verification initiated!')
        console.log('📧 Verification Token:', verifyResult.VerificationToken)
        console.log('\n📝 Add this TXT record to your DNS:')
        console.log(`Name: _amazonses.${domain}`)
        console.log(`Value: ${verifyResult.VerificationToken}`)
      } catch (error) {
        console.log('❌ Failed to initiate domain verification:', error.message)
      }
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
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background: #2563eb; color: white; padding: 20px; text-align: center;">
                    <h1>🎤 Boston Showtime</h1>
                  </div>
                  <div style="padding: 20px; background: #f9f9f9;">
                    <h2>Email Configuration Test</h2>
                    <p>This is a test email to verify that the Boston Showtime email service is working correctly with the domain <strong>bostonshowtime.com</strong>.</p>
                    <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
                    <p><strong>From:</strong> ${fromEmail}</p>
                    <p><strong>Domain:</strong> ${domain}</p>
                  </div>
                  <div style="padding: 20px; text-align: center; color: #666; font-size: 14px;">
                    <p>Boston Showtime Platform<br>
                    Supporting the local music community</p>
                  </div>
                </div>
              `
            },
            Text: {
              Charset: 'UTF-8',
              Data: `Boston Showtime - Email Configuration Test\n\nThis is a test email to verify that the Boston Showtime email service is working correctly with the domain bostonshowtime.com.\n\nTimestamp: ${new Date().toISOString()}\nFrom: ${fromEmail}\nDomain: ${domain}\n\nBoston Showtime Platform\nSupporting the local music community`
            }
          },
          Subject: {
            Charset: 'UTF-8',
            Data: 'Boston Showtime - Email Configuration Test'
          }
        },
        Source: fromEmail
      }).promise()
      
      console.log('✅ Test email sent successfully!')
      console.log('📧 Message ID:', result.MessageId)
      console.log('\n🎯 Email system is ready to use!')
    } catch (error) {
      console.log('❌ Test email failed:', error.message)
      
      if (error.code === 'MessageRejected') {
        console.log('\n💡 Common solutions:')
        console.log('- Verify the domain bostonshowtime.com in SES')
        console.log('- Or verify the sender email noreply@bostonshowtime.com')
        console.log('- If in sandbox mode, verify the recipient email too')
        console.log('- Check that DNS records are properly configured')
      }
      
      if (error.code === 'ConfigurationSetDoesNotExist') {
        console.log('- Configuration set issue - this is usually fine for basic sending')
      }
    }

  } catch (error) {
    console.error('❌ Error setting up domain email:', error.message)
  }
}

// Run the setup
setupDomainEmail().then(() => {
  console.log('\n🎯 Domain email setup check complete!')
}).catch(error => {
  console.error('Setup failed:', error)
  process.exit(1)
})