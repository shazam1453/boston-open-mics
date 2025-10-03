const emailService = require('./services/emailService')
const tokenService = require('./services/tokenService')

async function testEmailService() {
  console.log('🧪 Testing Boston Open Mics Email Service\n')

  // Test 1: Basic email sending
  console.log('1️⃣ Testing basic email sending...')
  const testEmail = process.env.TEST_EMAIL || 'test@bostonshowtime.com'
  console.log(`Sending to: ${testEmail}`)
  
  try {
    const result = await emailService.sendTestEmail(testEmail)
    if (result.success) {
      console.log('✅ Test email sent successfully!')
      console.log('📧 Message ID:', result.messageId)
    } else {
      console.log('❌ Test email failed:', result.error)
    }
  } catch (error) {
    console.log('❌ Test email error:', error.message)
  }

  console.log('\n' + '='.repeat(50) + '\n')

  // Test 2: Password reset email
  console.log('2️⃣ Testing password reset email...')
  try {
    const resetToken = tokenService.generateResetToken()
    tokenService.storeResetToken('test@example.com', resetToken)
    
    const result = await emailService.sendPasswordResetEmail(
      testEmail,
      'Test User',
      resetToken
    )
    
    if (result.success) {
      console.log('✅ Password reset email sent successfully!')
      console.log('📧 Message ID:', result.messageId)
      console.log('🔑 Reset token:', resetToken)
    } else {
      console.log('❌ Password reset email failed:', result.error)
    }
  } catch (error) {
    console.log('❌ Password reset email error:', error.message)
  }

  console.log('\n' + '='.repeat(50) + '\n')

  // Test 3: Event invitation email
  console.log('3️⃣ Testing event invitation email...')
  try {
    const invitation = {
      userEmail: testEmail,
      userName: 'Jane Performer',
      inviterName: 'Event Host',
      eventTitle: 'Weekly Open Mic Night',
      eventDate: 'Friday, October 4, 2025',
      eventTime: '7:00 PM - 10:00 PM',
      venueName: 'The Comedy Studio',
      venueAddress: '1238 Massachusetts Ave, Cambridge, MA',
      eventDescription: 'Join us for a fun night of music and comedy!',
      message: 'We would love to have you perform at our event!',
      inviteId: 'test-invite-123'
    }
    
    const result = await emailService.sendEventInvitation(invitation)
    
    if (result.success) {
      console.log('✅ Event invitation email sent successfully!')
      console.log('📧 Message ID:', result.messageId)
    } else {
      console.log('❌ Event invitation email failed:', result.error)
    }
  } catch (error) {
    console.log('❌ Event invitation email error:', error.message)
  }

  console.log('\n' + '='.repeat(50) + '\n')

  // Test 4: Event reminder email
  console.log('4️⃣ Testing event reminder email...')
  try {
    const reminder = {
      userEmail: testEmail,
      userName: 'Jane Performer',
      eventTitle: 'Weekly Open Mic Night',
      eventDate: 'Friday, October 4, 2025',
      eventTime: '7:00 PM - 10:00 PM',
      venueName: 'The Comedy Studio',
      venueAddress: '1238 Massachusetts Ave, Cambridge, MA',
      performanceName: 'Acoustic Guitar Set',
      performanceOrder: 3,
      eventId: 'test-event-123'
    }
    
    const result = await emailService.sendEventReminder(reminder)
    
    if (result.success) {
      console.log('✅ Event reminder email sent successfully!')
      console.log('📧 Message ID:', result.messageId)
    } else {
      console.log('❌ Event reminder email failed:', result.error)
    }
  } catch (error) {
    console.log('❌ Event reminder email error:', error.message)
  }

  console.log('\n🎯 Email service testing complete!')
  console.log('\n💡 Note: If emails failed, make sure to:')
  console.log('   - Verify sender email in AWS SES')
  console.log('   - Verify recipient emails (if in sandbox mode)')
  console.log('   - Request production access for unrestricted sending')
}

// Run the tests
testEmailService().catch(error => {
  console.error('Testing failed:', error)
  process.exit(1)
})