const express = require('express');
const pool = require('../config/database');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/availability - get current user's availability
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT date, status FROM user_availability WHERE user_id = $1 ORDER BY date',
      [req.user.id]
    );
    // Return as { 'YYYY-MM-DD': 'available' | 'unavailable' }
    const availability = {};
    result.rows.forEach(row => {
      const dateStr = row.date.toISOString().split('T')[0];
      availability[dateStr] = row.status;
    });
    res.json({ availability });
  } catch (error) {
    console.error('Get availability error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/availability - save full availability map for current user
// Body: { availability: { 'YYYY-MM-DD': 'available' | 'unavailable' } }
// Dates omitted from the map are treated as unset and deleted
router.put('/', auth, async (req, res) => {
  const { availability } = req.body;

  if (!availability || typeof availability !== 'object') {
    return res.status(400).json({ message: 'availability object required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Delete all existing entries for this user
    await client.query('DELETE FROM user_availability WHERE user_id = $1', [req.user.id]);

    // Insert new entries
    const entries = Object.entries(availability).filter(([, status]) =>
      status === 'available' || status === 'unavailable'
    );

    for (const [date, status] of entries) {
      await client.query(
        `INSERT INTO user_availability (user_id, date, status)
         VALUES ($1, $2, $3)`,
        [req.user.id, date, status]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Availability saved', count: entries.length });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Save availability error:', error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
