const pool = require('../config/database');

class Invitation {
  static async findByUser(userId) {
    const result = await pool.query(`
      SELECT i.*,
             e.title as event_title, e.date as event_date, e.start_time,
             inviter.name as inviter_name, inviter.email as inviter_email
      FROM invitations i
      JOIN events e ON i.event_id = e.id
      JOIN users inviter ON i.inviter_id = inviter.id
      WHERE i.invitee_id = $1
      ORDER BY i.created_at DESC
    `, [userId]);
    return result.rows;
  }

  static async findByEvent(eventId) {
    const result = await pool.query(`
      SELECT i.*,
             invitee.name as invitee_name, invitee.email as invitee_email,
             inviter.name as inviter_name
      FROM invitations i
      JOIN users invitee ON i.invitee_id = invitee.id
      JOIN users inviter ON i.inviter_id = inviter.id
      WHERE i.event_id = $1
      ORDER BY i.created_at DESC
    `, [eventId]);
    return result.rows;
  }

  static async checkExisting(eventId, inviteeId, type) {
    const result = await pool.query(
      'SELECT id FROM invitations WHERE event_id = $1 AND invitee_id = $2 AND type = $3',
      [eventId, inviteeId, type]
    );
    return result.rows[0] || null;
  }

  static async create({ eventId, inviterId, inviteeId, type, message }) {
    const result = await pool.query(`
      INSERT INTO invitations (event_id, inviter_id, invitee_id, type, message)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [eventId, inviterId, inviteeId, type, message]);
    return result.rows[0];
  }

  static async updateStatus(id, status, userId) {
    const result = await pool.query(`
      UPDATE invitations
      SET status = $1, responded_at = NOW(), updated_at = NOW()
      WHERE id = $2 AND invitee_id = $3
      RETURNING *
    `, [status, id, userId]);
    return result.rows[0];
  }

  static async delete(id, userId) {
    const result = await pool.query(
      'DELETE FROM invitations WHERE id = $1 AND (inviter_id = $2 OR invitee_id = $2) RETURNING *',
      [id, userId]
    );
    return result.rows[0];
  }
}

module.exports = Invitation;
