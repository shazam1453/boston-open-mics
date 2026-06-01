const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { auth } = require('../middleware/auth');

const requireAdmin = (req, res, next) => {
  if (!['admin', 'super_admin', 'moderator'].includes(req.user?.role)) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// Get all users
router.get('/users', auth, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, phone, performer_type, role, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete user
router.delete('/users/:id', auth, requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user role
router.put('/users/:id/role', auth, requireAdmin, async (req, res) => {
  const { role } = req.body;
  const validRoles = ['user', 'moderator', 'admin', 'super_admin'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }

  // Only super_admin can assign admin/super_admin roles
  if (['admin', 'super_admin'].includes(role) && req.user.role !== 'super_admin') {
    return res.status(403).json({ message: 'Only super admins can assign admin roles' });
  }

  try {
    const result = await pool.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, name, role',
      [role, req.params.id]
    );
    res.json({ user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all events
router.get('/events', auth, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT e.*, v.name as venue_name, u.name as host_name
      FROM events e
      LEFT JOIN venues v ON e.venue_id = v.id
      LEFT JOIN users u ON e.host_id = u.id
      ORDER BY e.date DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete event
router.delete('/events/:id', auth, requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM events WHERE id = $1', [req.params.id]);
    res.json({ message: 'Event deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all venues
router.get('/venues', auth, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT v.*, u.name as owner_name
      FROM venues v
      LEFT JOIN users u ON v.owner_id = u.id
      ORDER BY v.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete venue
router.delete('/venues/:id', auth, requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM venues WHERE id = $1', [req.params.id]);
    res.json({ message: 'Venue deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
