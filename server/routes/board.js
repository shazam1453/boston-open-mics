const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { auth, optionalAuth } = require('../middleware/auth');

const CATEGORIES = ['general', 'shows', 'gear', 'intros', 'other'];

// Helper: fetch reaction counts (and current user's reaction) for a set of targets
async function getReactions(targetType, targetIds, userId) {
  if (targetIds.length === 0) return {};
  const counts = await pool.query(`
    SELECT target_id,
           COUNT(*) FILTER (WHERE reaction = 'up') as ups,
           COUNT(*) FILTER (WHERE reaction = 'down') as downs
    FROM board_reactions WHERE target_type = $1 AND target_id = ANY($2)
    GROUP BY target_id
  `, [targetType, targetIds]);

  const map = {};
  counts.rows.forEach(r => {
    map[r.target_id] = { ups: parseInt(r.ups), downs: parseInt(r.downs), my_reaction: null };
  });
  targetIds.forEach(id => { if (!map[id]) map[id] = { ups: 0, downs: 0, my_reaction: null }; });

  if (userId) {
    const mine = await pool.query(
      'SELECT target_id, reaction FROM board_reactions WHERE target_type = $1 AND target_id = ANY($2) AND user_id = $3',
      [targetType, targetIds, userId]
    );
    mine.rows.forEach(r => { if (map[r.target_id]) map[r.target_id].my_reaction = r.reaction; });
  }
  return map;
}

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

    const reactions = await getReactions('thread', result.rows.map(r => r.id), req.user?.id);
    const threads = result.rows.map(t => ({ ...t, ...reactions[t.id] }));
    res.json(threads);
  } catch (error) {
    console.error('Board list error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single thread with replies
router.get('/threads/:id', optionalAuth, async (req, res) => {
  try {
    const threadRes = await pool.query(`
      SELECT t.*, u.id as author_id, u.name as author_name, u.slug as author_slug
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

    const threadId = threadRes.rows[0].id;
    const replyIds = repliesRes.rows.map(r => r.id);
    const userId = req.user?.id;

    const [threadReactions, replyReactions] = await Promise.all([
      getReactions('thread', [threadId], userId),
      getReactions('reply', replyIds, userId),
    ]);

    const thread = { ...threadRes.rows[0], ...threadReactions[threadId] };
    const replies = repliesRes.rows.map(r => ({ ...r, ...replyReactions[r.id] }));
    res.json({ thread, replies });
  } catch (error) {
    console.error('Board thread error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Toggle reaction on a thread or reply
router.post('/react', auth, async (req, res) => {
  const { target_type, target_id, reaction } = req.body;
  if (!['thread', 'reply'].includes(target_type)) return res.status(400).json({ message: 'Invalid target_type' });
  if (!['up', 'down'].includes(reaction)) return res.status(400).json({ message: 'Invalid reaction' });

  try {
    const existing = await pool.query(
      'SELECT id, reaction FROM board_reactions WHERE target_type = $1 AND target_id = $2 AND user_id = $3',
      [target_type, target_id, req.user.id]
    );

    if (existing.rows.length > 0) {
      if (existing.rows[0].reaction === reaction) {
        // Same reaction — remove it (toggle off)
        await pool.query('DELETE FROM board_reactions WHERE id = $1', [existing.rows[0].id]);
      } else {
        // Different reaction — switch it
        await pool.query('UPDATE board_reactions SET reaction = $1 WHERE id = $2', [reaction, existing.rows[0].id]);
      }
    } else {
      await pool.query(
        'INSERT INTO board_reactions (target_type, target_id, user_id, reaction) VALUES ($1, $2, $3, $4)',
        [target_type, target_id, req.user.id, reaction]
      );
    }

    const counts = await pool.query(`
      SELECT COUNT(*) FILTER (WHERE reaction = 'up') as ups,
             COUNT(*) FILTER (WHERE reaction = 'down') as downs
      FROM board_reactions WHERE target_type = $1 AND target_id = $2
    `, [target_type, target_id]);

    const mine = await pool.query(
      'SELECT reaction FROM board_reactions WHERE target_type = $1 AND target_id = $2 AND user_id = $3',
      [target_type, target_id, req.user.id]
    );

    res.json({
      ups: parseInt(counts.rows[0].ups),
      downs: parseInt(counts.rows[0].downs),
      my_reaction: mine.rows[0]?.reaction || null,
    });
  } catch (error) {
    console.error('React error:', error);
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
