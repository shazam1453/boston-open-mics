const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = 'noreply@bostonshowtime.com';
const APP_URL = process.env.CLIENT_URL || 'https://bostonshowtime.com';

async function sendPasswordResetEmail(toEmail, resetToken) {
  const resetUrl = `${APP_URL}/reset-password?token=${resetToken}`;

  await resend.emails.send({
    from: FROM_EMAIL,
    to: toEmail,
    subject: 'Reset your Boston Showtime password',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Reset your password</h2>
        <p>Click the button below to reset your password. This link expires in 1 hour.</p>
        <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:white;text-decoration:none;border-radius:6px;font-weight:600;">
          Reset Password
        </a>
        <p style="margin-top:24px;color:#666;font-size:14px;">
          If you didn't request this, you can safely ignore this email.
        </p>
        <p style="color:#666;font-size:14px;">
          Or copy this link: <a href="${resetUrl}">${resetUrl}</a>
        </p>
      </div>
    `
  });
}

module.exports = { sendPasswordResetEmail };
