const AWS = require('aws-sdk')

// Configure AWS SES
const ses = new AWS.SES({
  region: process.env.AWS_REGION || 'us-east-2',
  apiVersion: '2010-12-01'
})

// Email templates
const EMAIL_TEMPLATES = {
  PASSWORD_RESET: {
    subject: 'Boston Showtime - Password Reset',
    getHtml: (data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Password Reset</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎤 Boston Showtime</h1>
          </div>
          <div class="content">
            <h2>Password Reset Request</h2>
            <p>Hi ${data.userName},</p>
            <p>We received a request to reset your password for your Boston Showtime account.</p>
            <p>Click the button below to reset your password:</p>
            <a href="${data.resetLink}" class="button">Reset Password</a>
            <p>This link will expire in 1 hour for security reasons.</p>
            <p>If you didn't request this password reset, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>Boston Showtime Platform<br>
            Supporting the local music community</p>
          </div>
        </div>
      </body>
      </html>
    `,
    getText: (data) => `
      Boston Showtime - Password Reset
      
      Hi ${data.userName},
      
      We received a request to reset your password for your Boston Showtime account.
      
      Click this link to reset your password: ${data.resetLink}
      
      This link will expire in 1 hour for security reasons.
      
      If you didn't request this password reset, please ignore this email.
      
      Boston Showtime Platform
      Supporting the local music community
    `
  },

  EVENT_INVITATION: {
    subject: 'Boston Showtime - Event Invitation',
    getHtml: (data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Event Invitation</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .event-details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
          .button.accept { background: #16a34a; }
          .button.decline { background: #dc2626; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎤 Boston Showtime</h1>
          </div>
          <div class="content">
            <h2>You're Invited to Perform!</h2>
            <p>Hi ${data.userName},</p>
            <p>${data.inviterName} has invited you to perform at:</p>
            
            <div class="event-details">
              <h3>${data.eventTitle}</h3>
              <p><strong>📅 Date:</strong> ${data.eventDate}</p>
              <p><strong>🕐 Time:</strong> ${data.eventTime}</p>
              <p><strong>📍 Venue:</strong> ${data.venueName}</p>
              <p><strong>📍 Address:</strong> ${data.venueAddress}</p>
              ${data.eventDescription ? `<p><strong>Description:</strong> ${data.eventDescription}</p>` : ''}
            </div>
            
            ${data.message ? `<p><strong>Personal message:</strong> "${data.message}"</p>` : ''}
            
            <p>Please respond to this invitation:</p>
            <a href="${data.acceptLink}" class="button accept">Accept Invitation</a>
            <a href="${data.declineLink}" class="button decline">Decline</a>
            
            <p>You can also respond by logging into your account at <a href="${data.platformUrl}">Boston Showtime</a>.</p>
          </div>
          <div class="footer">
            <p>Boston Showtime Platform<br>
            Supporting the local music community</p>
          </div>
        </div>
      </body>
      </html>
    `,
    getText: (data) => `
      Boston Showtime - Event Invitation
      
      Hi ${data.userName},
      
      ${data.inviterName} has invited you to perform at:
      
      ${data.eventTitle}
      Date: ${data.eventDate}
      Time: ${data.eventTime}
      Venue: ${data.venueName}
      Address: ${data.venueAddress}
      ${data.eventDescription ? `Description: ${data.eventDescription}` : ''}
      
      ${data.message ? `Personal message: "${data.message}"` : ''}
      
      Accept: ${data.acceptLink}
      Decline: ${data.declineLink}
      
      You can also respond by logging into your account at ${data.platformUrl}.
      
      Boston Showtime Platform
      Supporting the local music community
    `
  },

  EVENT_REMINDER: {
    subject: 'Boston Showtime - Event Reminder',
    getHtml: (data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Event Reminder</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .event-details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎤 Boston Showtime</h1>
          </div>
          <div class="content">
            <h2>Event Reminder</h2>
            <p>Hi ${data.userName},</p>
            <p>This is a reminder that you're signed up to perform at:</p>
            
            <div class="event-details">
              <h3>${data.eventTitle}</h3>
              <p><strong>📅 Date:</strong> ${data.eventDate}</p>
              <p><strong>🕐 Time:</strong> ${data.eventTime}</p>
              <p><strong>📍 Venue:</strong> ${data.venueName}</p>
              <p><strong>📍 Address:</strong> ${data.venueAddress}</p>
              <p><strong>🎭 Your Performance:</strong> ${data.performanceName}</p>
              ${data.performanceOrder ? `<p><strong>Performance Order:</strong> #${data.performanceOrder}</p>` : ''}
            </div>
            
            <p>We're looking forward to your performance!</p>
            <a href="${data.eventLink}" class="button">View Event Details</a>
          </div>
          <div class="footer">
            <p>Boston Showtime Platform<br>
            Supporting the local music community</p>
          </div>
        </div>
      </body>
      </html>
    `,
    getText: (data) => `
      Boston Showtime - Event Reminder
      
      Hi ${data.userName},
      
      This is a reminder that you're signed up to perform at:
      
      ${data.eventTitle}
      Date: ${data.eventDate}
      Time: ${data.eventTime}
      Venue: ${data.venueName}
      Address: ${data.venueAddress}
      Your Performance: ${data.performanceName}
      ${data.performanceOrder ? `Performance Order: #${data.performanceOrder}` : ''}
      
      We're looking forward to your performance!
      
      View event details: ${data.eventLink}
      
      Boston Showtime Platform
      Supporting the local music community
    `
  }
}

class EmailService {
  constructor() {
    this.fromEmail = process.env.FROM_EMAIL || 'noreply@bostonshowtime.com'
    this.platformUrl = process.env.PLATFORM_URL || 'https://bostonshowtime.com'
  }

  async sendEmail(to, subject, htmlBody, textBody) {
    const params = {
      Destination: {
        ToAddresses: [to]
      },
      Message: {
        Body: {
          Html: {
            Charset: 'UTF-8',
            Data: htmlBody
          },
          Text: {
            Charset: 'UTF-8',
            Data: textBody
          }
        },
        Subject: {
          Charset: 'UTF-8',
          Data: subject
        }
      },
      Source: this.fromEmail
    }

    try {
      const result = await ses.sendEmail(params).promise()
      console.log('Email sent successfully:', result.MessageId)
      return { success: true, messageId: result.MessageId }
    } catch (error) {
      console.error('Failed to send email:', error)
      return { success: false, error: error.message }
    }
  }

  async sendPasswordResetEmail(userEmail, userName, resetToken) {
    const resetLink = `${this.platformUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(userEmail)}`
    
    const template = EMAIL_TEMPLATES.PASSWORD_RESET
    const data = { userName, resetLink }
    
    return await this.sendEmail(
      userEmail,
      template.subject,
      template.getHtml(data),
      template.getText(data)
    )
  }

  async sendEventInvitation(invitation) {
    const {
      userEmail,
      userName,
      inviterName,
      eventTitle,
      eventDate,
      eventTime,
      venueName,
      venueAddress,
      eventDescription,
      message,
      inviteId
    } = invitation

    const acceptLink = `${this.platformUrl}/invitations/${inviteId}/accept`
    const declineLink = `${this.platformUrl}/invitations/${inviteId}/decline`
    
    const template = EMAIL_TEMPLATES.EVENT_INVITATION
    const data = {
      userName,
      inviterName,
      eventTitle,
      eventDate,
      eventTime,
      venueName,
      venueAddress,
      eventDescription,
      message,
      acceptLink,
      declineLink,
      platformUrl: this.platformUrl
    }
    
    return await this.sendEmail(
      userEmail,
      template.subject,
      template.getHtml(data),
      template.getText(data)
    )
  }

  async sendEventReminder(reminder) {
    const {
      userEmail,
      userName,
      eventTitle,
      eventDate,
      eventTime,
      venueName,
      venueAddress,
      performanceName,
      performanceOrder,
      eventId
    } = reminder

    const eventLink = `${this.platformUrl}/events/${eventId}`
    
    const template = EMAIL_TEMPLATES.EVENT_REMINDER
    const data = {
      userName,
      eventTitle,
      eventDate,
      eventTime,
      venueName,
      venueAddress,
      performanceName,
      performanceOrder,
      eventLink
    }
    
    return await this.sendEmail(
      userEmail,
      template.subject,
      template.getHtml(data),
      template.getText(data)
    )
  }

  // Test email functionality
  async sendTestEmail(to) {
    const subject = 'Boston Showtime - Email Service Test'
    const htmlBody = `
      <h2>Email Service Test</h2>
      <p>This is a test email to verify that the Boston Showtime email service is working correctly.</p>
      <p>Timestamp: ${new Date().toISOString()}</p>
    `
    const textBody = `
      Email Service Test
      
      This is a test email to verify that the Boston Showtime email service is working correctly.
      
      Timestamp: ${new Date().toISOString()}
    `
    
    return await this.sendEmail(to, subject, htmlBody, textBody)
  }
}

module.exports = new EmailService()