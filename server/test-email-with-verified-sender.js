const AWS = require('aws-sdk')

// Configure AWS SES
const ses = new AWS.SES({
  region: process.env.AWS_REGION || 'us-east-2',
  apiVersion: '2010-12-01'
})

async function testEmailWithVerifiedSender() {
  console.log('🧪 Testing email with verified sender...\n')

  try {
    // Get list of verified identities
    const identities = await ses.listIdentities().promise()
    console.log('📧 Verified identities:', identities.Identities)

    // Find a verified email address to use as sender
    const verifiedEmails = identities.Identities.filter(identity => identity.includes('@'))
    const verifiedDomains = identities.Identities.filter(identity => !identity.includes('@'))

    console.log('✅ Verified emails:', verifiedEmails)
    console.log('✅ Verified domains:', verifiedDomains)

    let senderEmail = null

    // Try to use a verified email first
    if (verifiedEmails.length > 0) {
      senderEmail = verifiedEmails[0]
      console.log(`\n📤 Using verified email as sender: ${senderEmail}`)
    } else if (verifiedDomains.includes('bostonshowtime.com')) {
      // If we have production access, we can use any email from verified domain
      senderEmail = 'noreply@bostonshowtime.com'
      console.log(`\n📤 Using domain email as sender: ${senderEmail}`)
    } else {
      console.log('\n❌ No verified sender available')
      console.log('Please verify an email address first:')
      console.log('node verify-email.js your-email@bostonshowtime.com')
      return
    }

    // Test recipient - use the same verified email for testing
    const recipientEmail = verifiedEmails.length > 0 ? verifiedEmails[0] : 'test@example.com'
    
    console.log(`📥 Sending test email to: ${recipientEmail}`)

    // Send test email
    const result = await ses.sendEmail({
      Destination: {
        ToAddresses: [recipientEmail]
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
                  <h2>Email System Test - SUCCESS!</h2>
                  <p>🎉 Congratulations! Your Boston Showtime email system is working correctly.</p>
                  <p><strong>Test Details:</strong></p>
                  <ul>
                    <li><strong>From:</strong> ${senderEmail}</li>
                    <li><strong>To:</strong> ${recipientEmail}</li>
                    <li><strong>Domain:</strong> bostonshowtime.com ✅</li>
                    <li><strong>Timestamp:</strong> ${new Date().toISOString()}</li>
                  </ul>
                  <p>You can now send:</p>
                  <ul>
                    <li>✅ Password reset emails</li>
                    <li>✅ Event invitations</li>
                    <li>✅ Event reminders</li>
                    <li>✅ System notifications</li>
                  </ul>
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
            Data: `Boston Showtime - Email System Test SUCCESS!\n\nCongratulations! Your Boston Showtime email system is working correctly.\n\nTest Details:\nFrom: ${senderEmail}\nTo: ${recipientEmail}\nDomain: bostonshowtime.com ✅\nTimestamp: ${new Date().toISOString()}\n\nYou can now send:\n- Password reset emails\n- Event invitations\n- Event reminders\n- System notifications\n\nBoston Showtime Platform\nSupporting the local music community`
          }
        },
        Subject: {
          Charset: 'UTF-8',
          Data: '🎉 Boston Showtime Email System - Test Successful!'
        }
      },
      Source: senderEmail
    }).promise()

    console.log('\n✅ Test email sent successfully!')
    console.log('📧 Message ID:', result.MessageId)
    console.log('\n🎯 Email system is working! Check your inbox.')

    // Show next steps
    console.log('\n📋 Next Steps:')
    if (verifiedEmails.length === 0) {
      console.log('1. Request production access for unrestricted sending')
      console.log('2. Or verify specific sender emails you want to use')
    } else {
      console.log('1. Update your application to use verified sender emails')
      console.log('2. Or request production access for more flexibility')
    }

  } catch (error) {
    console.error('❌ Test email failed:', error.message)
    
    if (error.code === 'MessageRejected') {
      console.log('\n💡 Solutions:')
      console.log('- Verify the sender email address')
      console.log('- Request production access')
      console.log('- Use a verified email as both sender and recipient for testing')
    }
  }
}

// Run the test
testEmailWithVerifiedSender().then(() => {
  console.log('\n🎯 Email test complete!')
}).catch(error => {
  console.error('Test failed:', error)
  process.exit(1)
})