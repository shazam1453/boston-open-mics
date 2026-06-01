const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { auth } = require('../middleware/auth');

// Get all conversations for current user
router.get('/conversations', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*,
        (SELECT row_to_json(lm) FROM (SELECT message_text, created_at as timestamp, sender_id FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) lm) as last_message,
        (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.created_at > cp.last_read_at AND m.sender_id != $1) as unread_count,
        (
          SELECT row_to_json(u)
          FROM conversation_participants cp2
          JOIN users u ON cp2.user_id = u.id
          WHERE cp2.conversation_id = c.id AND u.id != $1
          LIMIT 1
        ) as other_user
      FROM conversations c
      JOIN conversation_participants cp ON c.id = cp.conversation_id
      WHERE cp.user_id = $1
      ORDER BY last_message_at DESC NULLS LAST
    `, [req.user.id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Start or get direct conversation with another user
router.post('/conversations', auth, async (req, res) => {
  const { other_user_id } = req.body;
  if (!other_user_id) return res.status(400).json({ message: 'other_user_id required' });

  try {
    // Check if direct conversation already exists between these two users
    const existing = await pool.query(`
      SELECT c.id FROM conversations c
      JOIN conversation_participants cp1 ON c.id = cp1.conversation_id AND cp1.user_id = $1
      JOIN conversation_participants cp2 ON c.id = cp2.conversation_id AND cp2.user_id = $2
      WHERE c.type = 'direct'
      LIMIT 1
    `, [req.user.id, other_user_id]);

    const fetchConv = async (id) => {
      const r = await pool.query(`
        SELECT c.*,
          (SELECT row_to_json(u)
           FROM conversation_participants cp JOIN users u ON cp.user_id = u.id
           WHERE cp.conversation_id = c.id AND u.id != $2
           LIMIT 1) as other_user
        FROM conversations c WHERE c.id = $1
      `, [id, req.user.id]);
      return r.rows[0];
    };

    if (existing.rows.length > 0) {
      return res.json(await fetchConv(existing.rows[0].id));
    }

    // Create new direct conversation
    const conv = await pool.query(
      "INSERT INTO conversations (type, created_by) VALUES ('direct', $1) RETURNING *",
      [req.user.id]
    );
    const convId = conv.rows[0].id;

    await pool.query(
      'INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2), ($1, $3)',
      [convId, req.user.id, other_user_id]
    );

    res.status(201).json(await fetchConv(convId));
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get messages in a conversation
router.get('/conversations/:id/messages', auth, async (req, res) => {
  try {
    // Verify user is a participant
    const participant = await pool.query(
      'SELECT id FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (participant.rows.length === 0) return res.status(403).json({ message: 'Forbidden' });

    const limit = parseInt(req.query.limit) || 50;
    const result = await pool.query(`
      SELECT m.*, m.created_at as timestamp, u.name as sender_name, u.email as sender_email
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = $1
      ORDER BY m.created_at DESC
      LIMIT $2
    `, [req.params.id, limit]);

    // Update last_read_at
    await pool.query(
      'UPDATE conversation_participants SET last_read_at = NOW() WHERE conversation_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    res.json({ messages: result.rows.reverse(), hasMore: result.rows.length === limit });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send a message
router.post('/conversations/:id/messages', auth, async (req, res) => {
  const { message_text } = req.body;
  if (!message_text?.trim()) return res.status(400).json({ message: 'message_text required' });

  try {
    const participant = await pool.query(
      'SELECT id FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (participant.rows.length === 0) return res.status(403).json({ message: 'Forbidden' });

    const result = await pool.query(
      'INSERT INTO messages (conversation_id, sender_id, message_text) VALUES ($1, $2, $3) RETURNING *',
      [req.params.id, req.user.id, message_text.trim()]
    );

    await pool.query('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [req.params.id]);

    res.status(201).json({ message: result.rows[0] });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark message as read
router.put('/messages/:id/read', auth, async (req, res) => {
  try {
    await pool.query('UPDATE messages SET read_at = NOW() WHERE id = $1', [req.params.id]);
    res.json({ message: 'Marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete conversation
router.delete('/conversations/:id', auth, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Left conversation' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
