const express = require('express');
const User = require('../models/User');
const { auth, optionalAuth } = require('../middleware/auth');

const pool = require('../config/database');

const router = express.Router();

// Search users by name or email
router.get('/search', auth, async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json([]);

  try {
    const result = await pool.query(
      `SELECT id, name, email, performer_type, bio FROM users
       WHERE name ILIKE $1 OR email ILIKE $1
       LIMIT 20`,
      [`%${q}%`]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user by ID (public profile info only)
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const publicProfile = {
      id: user.id,
      name: user.name,
      performer_type: user.performer_type,
      bio: user.bio,
      instagram_handle: user.instagram_handle,
      twitter_handle: user.twitter_handle,
      tiktok_handle: user.tiktok_handle,
      youtube_handle: user.youtube_handle,
      website_url: user.website_url,
      created_at: user.created_at
    };

    res.json(publicProfile);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user availability (public)
router.get('/:id/availability', optionalAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT date, status FROM user_availability WHERE user_id = $1 ORDER BY date',
      [req.params.id]
    );
    const availability = {};
    result.rows.forEach(row => {
      availability[row.date.toISOString().split('T')[0]] = row.status;
    });
    res.json({ availability });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;