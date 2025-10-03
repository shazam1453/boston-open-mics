const AWS = require('aws-sdk')

// Configure AWS SES
const ses = new AWS.SES({
  region: process.env.AWS_REGION || 'us-east-2',
  apiVersion: '2010-12-01'
})

async function verifyEmail(email) {
  if (!email) {
    console.log('Usage: node verify-email.js <email-address>')
    console.log('Example: node verify-email.js noreply@yourdomain.com')
    process.exit(1)
  }

  console.log(`🔧 Verifying email address: ${email}`)

  try {
    const result = await ses.verifyEmailIdentity({
      EmailAddress: email
    }).promise()
    
    console.log('✅ Verification email sent!')
    console.log('📧 Check your inbox and click the verification link')
    console.log('⏰ This may take a few minutes to process')
    
  } catch (error) {
    console.error('❌ Failed to send verification email:', error.message)
    
    if (error.code === 'InvalidParameterValue') {
      console.log('💡 Make sure the email address format is valid')
    }
  }
}

// Get email from command line argument
const email = process.argv[2]
verifyEmail(email)