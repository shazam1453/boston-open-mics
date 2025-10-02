const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

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
  body('socialMedia.website').optional().isURL().withMessage('Website must be a valid URL')
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
  body('websiteUrl').optional().isURL().withMessage('Website must be a valid URL')
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

module.exports = router;