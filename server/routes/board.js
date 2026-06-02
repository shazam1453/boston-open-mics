const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { auth, optionalAuth } = require('../middleware/auth');

const CATEGORIES = ['general', 'shows', 'gear', 'intros', 'other'];

// List threads (optionally filtered by category)
router.get('/threads', optionalAuth, async (req, res) => {
  const { category } = req.query;
  const conditions = category && CATEGORIES.includes(category) ? 'WHERE t.category = $1' : '';
  const params = conditions ? [category] : [];

  try {
    const result = await pool.query(`
      SELECT t.id, t.title, t.category, t.is_pinned, t.is_locked,
             t.reply_count, t.created_at, t.last_reply_at,
             u.id as author_id, u.name as author_name, u.slug as author_slug
      FROM board_threads t
      LEFT JOIN users u ON t.author_id = u.id
      ${conditions}
      ORDER BY t.is_pinned DESC, COALESCE(t.last_reply_at, t.created_at) DESC
      LIMIT 100
    `, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Board list error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single thread with replies
router.get('/threads/:id', optionalAuth, async (req, res) => {
  try {
    const threadRes = await pool.query(`
      SELECT t.*, u.id as author_id, u.name as author_name
      FROM board_threads t
      LEFT JOIN users u ON t.author_id = u.id
      WHERE t.id = $1
    `, [req.params.id]);

    if (threadRes.rows.length === 0) return res.status(404).json({ message: 'Thread not found' });

    const repliesRes = await pool.query(`
      SELECT r.id, r.body, r.created_at, r.updated_at,
             u.id as author_id, u.name as author_name, u.slug as author_slug
      FROM board_replies r
      LEFT JOIN users u ON r.author_id = u.id
      WHERE r.thread_id = $1
      ORDER BY r.created_at ASC
    `, [req.params.id]);

    res.json({ thread: threadRes.rows[0], replies: repliesRes.rows });
  } catch (error) {
    console.error('Board thread error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create thread
router.post('/threads', auth, async (req, res) => {
  const { title, body, category = 'general' } = req.body;
  if (!title?.trim() || !body?.trim()) return res.status(400).json({ message: 'Title and body required' });
  if (!CATEGORIES.includes(category)) return res.status(400).json({ message: 'Invalid category' });

  try {
    const result = await pool.query(`
      INSERT INTO board_threads (title, body, category, author_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [title.trim(), body.trim(), category, req.user.id]);

    const thread = result.rows[0];
    res.status(201).json({ ...thread, author_name: req.user.name });
  } catch (error) {
    console.error('Create thread error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Edit thread (author or moderator+)
router.put('/threads/:id', auth, async (req, res) => {
  const { title, body } = req.body;
  if (!title?.trim() || !body?.trim()) return res.status(400).json({ message: 'Title and body required' });

  try {
    const existing = await pool.query('SELECT * FROM board_threads WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'Thread not found' });

    const thread = existing.rows[0];
    const isModPlus = ['moderator', 'admin', 'super_admin'].includes(req.user.role);
    if (thread.author_id !== req.user.id && !isModPlus) return res.status(403).json({ message: 'Forbidden' });

    const result = await pool.query(`
      UPDATE board_threads SET title = $1, body = $2, updated_at = NOW()
      WHERE id = $3 RETURNING *
    `, [title.trim(), body.trim(), req.params.id]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete thread (author or moderator+)
router.delete('/threads/:id', auth, async (req, res) => {
  try {
    const existing = await pool.query('SELECT * FROM board_threads WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'Thread not found' });

    const isModPlus = ['moderator', 'admin', 'super_admin'].includes(req.user.role);
    if (existing.rows[0].author_id !== req.user.id && !isModPlus) return res.status(403).json({ message: 'Forbidden' });

    await pool.query('DELETE FROM board_threads WHERE id = $1', [req.params.id]);
    res.json({ message: 'Thread deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Pin/lock thread (moderator+)
router.put('/threads/:id/pin', auth, async (req, res) => {
  const isModPlus = ['moderator', 'admin', 'super_admin'].includes(req.user.role);
  if (!isModPlus) return res.status(403).json({ message: 'Forbidden' });

  try {
    const result = await pool.query(
      'UPDATE board_threads SET is_pinned = NOT is_pinned WHERE id = $1 RETURNING is_pinned',
      [req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/threads/:id/lock', auth, async (req, res) => {
  const isModPlus = ['moderator', 'admin', 'super_admin'].includes(req.user.role);
  if (!isModPlus) return res.status(403).json({ message: 'Forbidden' });

  try {
    const result = await pool.query(
      'UPDATE board_threads SET is_locked = NOT is_locked WHERE id = $1 RETURNING is_locked',
      [req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Post reply
router.post('/threads/:id/replies', auth, async (req, res) => {
  const { body } = req.body;
  if (!body?.trim()) return res.status(400).json({ message: 'Body required' });

  try {
    const thread = await pool.query('SELECT is_locked FROM board_threads WHERE id = $1', [req.params.id]);
    if (thread.rows.length === 0) return res.status(404).json({ message: 'Thread not found' });
    if (thread.rows[0].is_locked) return res.status(403).json({ message: 'Thread is locked' });

    const result = await pool.query(`
      INSERT INTO board_replies (thread_id, author_id, body)
      VALUES ($1, $2, $3) RETURNING *
    `, [req.params.id, req.user.id, body.trim()]);

    await pool.query(`
      UPDATE board_threads
      SET reply_count = reply_count + 1, last_reply_at = NOW(), updated_at = NOW()
      WHERE id = $1
    `, [req.params.id]);

    res.status(201).json({ ...result.rows[0], author_name: req.user.name });
  } catch (error) {
    console.error('Reply error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Edit reply (author or moderator+)
router.put('/replies/:id', auth, async (req, res) => {
  const { body } = req.body;
  if (!body?.trim()) return res.status(400).json({ message: 'Body required' });

  try {
    const existing = await pool.query('SELECT * FROM board_replies WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'Reply not found' });

    const isModPlus = ['moderator', 'admin', 'super_admin'].includes(req.user.role);
    if (existing.rows[0].author_id !== req.user.id && !isModPlus) return res.status(403).json({ message: 'Forbidden' });

    const result = await pool.query(
      'UPDATE board_replies SET body = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [body.trim(), req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete reply (author or moderator+)
router.delete('/replies/:id', auth, async (req, res) => {
  try {
    const existing = await pool.query('SELECT * FROM board_replies WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'Reply not found' });

    const isModPlus = ['moderator', 'admin', 'super_admin'].includes(req.user.role);
    if (existing.rows[0].author_id !== req.user.id && !isModPlus) return res.status(403).json({ message: 'Forbidden' });

    await pool.query('DELETE FROM board_replies WHERE id = $1', [req.params.id]);
    await pool.query(`
      UPDATE board_threads SET reply_count = GREATEST(reply_count - 1, 0) WHERE id = $1
    `, [existing.rows[0].thread_id]);
    res.json({ message: 'Reply deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
