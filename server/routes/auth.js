const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const pool = require('../config/database');
const { sendPasswordResetEmail } = require('../services/email');

const router = express.Router();

// Register
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('name').trim().isLength({ min: 1 }),
  body('performerType').optional().isIn(['musician', 'comedian', 'poet', 'storyteller', 'other']),
  body('socialMedia.instagram').optional().trim(),
  body('socialMedia.twitter').optional().trim(),
  body('socialMedia.tiktok').optional().trim(),
  body('socialMedia.youtube').optional().trim(),
  body('socialMedia.website').optional({ checkFalsy: true }).isURL().withMessage('Website must be a valid URL')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, name, phone, performerType, bio, socialMedia } = req.body;

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create user
    const user = await User.create({
      email,
      password,
      name,
      phone,
      performerType,
      bio,
      socialMedia
    });

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').exists()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Validate password
    const isValidPassword = await User.validatePassword(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      message: 'Login successful',
      token,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  res.json({ user: req.user });
});

// Update profile
router.put('/profile', auth, [
  body('name').optional().trim().isLength({ min: 1 }),
  body('phone').optional().trim(),
  body('performerType').optional().isIn(['musician', 'comedian', 'poet', 'storyteller', 'other']),
  body('bio').optional().trim(),
  body('instagramHandle').optional().trim(),
  body('twitterHandle').optional().trim(),
  body('tiktokHandle').optional().trim(),
  body('youtubeHandle').optional().trim(),
  body('websiteUrl').optional({ checkFalsy: true }).isURL().withMessage('Website must be a valid URL')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const updates = {};
    const allowedFields = [
      'name', 'phone', 'performer_type', 'bio', 
      'instagram_handle', 'twitter_handle', 'tiktok_handle', 'youtube_handle', 'website_url'
    ];
    
    Object.keys(req.body).forEach(key => {
      const dbKey = key === 'performerType' ? 'performer_type' :
                   key === 'instagramHandle' ? 'instagram_handle' :
                   key === 'twitterHandle' ? 'twitter_handle' :
                   key === 'tiktokHandle' ? 'tiktok_handle' :
                   key === 'youtubeHandle' ? 'youtube_handle' :
                   key === 'websiteUrl' ? 'website_url' : key;
      
      if (allowedFields.includes(dbKey) && req.body[key] !== undefined) {
        updates[dbKey] = req.body[key];
      }
    });

    const updatedUser = await User.updateProfile(req.user.id, updates);
    
    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Forgot password — send reset email
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Valid email required' });
    }

    const { email } = req.body;
    const user = await User.findByEmail(email);

    // Always respond success so we don't reveal whether email exists
    if (!user) {
      return res.json({ message: 'If that email exists, a reset link has been sent.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    );

    await sendPasswordResetEmail(email, token);

    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reset password — use token from email
router.post('/reset-password', [
  body('token').notEmpty(),
  body('newPassword').isLength({ min: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Invalid request' });
    }

    const { token, newPassword } = req.body;

    const result = await pool.query(
      'SELECT * FROM password_reset_tokens WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()',
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired reset link' });
    }

    const resetToken = result.rows[0];
    await User.updatePassword(resetToken.user_id, newPassword);
    await pool.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [resetToken.id]);

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Change password
router.put('/change-password', auth, [
  body('currentPassword').exists(),
  body('newPassword').isLength({ min: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;

    const userWithPassword = await User.findByEmail(req.user.email);
    const isValid = await User.validatePassword(currentPassword, userWithPassword.password);
    if (!isValid) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    await User.updatePassword(req.user.id, newPassword);
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;