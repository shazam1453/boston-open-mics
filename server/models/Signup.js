const pool = require('../config/database');

class Signup {
  static async create({ eventId, userId, performanceName, notes, performanceType }) {
    // Check if user already signed up for this event
    const existingSignup = await this.findByEventAndUser(eventId, userId);
    if (existingSignup) {
      throw new Error('User already signed up for this event');
    }

    // Check event details and signup availability
    const eventQuery = `
      SELECT e.max_performers, e.signup_opens, e.signup_deadline, COUNT(s.id) as current_signups
      FROM events e
      LEFT JOIN signups s ON e.id = s.event_id AND s.status = 'confirmed'
      WHERE e.id = $1
      GROUP BY e.id, e.max_performers, e.signup_opens, e.signup_deadline
    `;
    
    const eventResult = await pool.query(eventQuery, [eventId]);
    const event = eventResult.rows[0];
    
    if (!event) {
      throw new Error('Event not found');
    }

    const now = new Date();
    
    // Check if signups haven't opened yet
    if (event.signup_opens && new Date(event.signup_opens) > now) {
      throw new Error('Signups are not open yet');
    }
    
    // Check if signup deadline has passed
    if (event.signup_deadline && new Date(event.signup_deadline) < now) {
      throw new Error('Signup deadline has passed');
    }
    
    // Check if event is full
    if (event.current_signups >= event.max_performers) {
      throw new Error('Event is full');
    }

    const query = `
      INSERT INTO signups (event_id, user_id, performance_name, notes, performance_type, status, created_at)
      VALUES ($1, $2, $3, $4, $5, 'confirmed', NOW())
      RETURNING *
    `;
    
    const values = [eventId, userId, performanceName, notes, performanceType];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async findByEventAndUser(eventId, userId) {
    const query = 'SELECT * FROM signups WHERE event_id = $1 AND user_id = $2';
    const result = await pool.query(query, [eventId, userId]);
    return result.rows[0];
  }

  static async findByEvent(eventId) {
    const query = `
      SELECT s.*, u.name as user_name, u.email as user_email
      FROM signups s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.event_id = $1
      ORDER BY s.created_at
    `;
    
    const result = await pool.query(query, [eventId]);
    return result.rows;
  }

  static async findByUser(userId) {
    const query = `
      SELECT s.*, e.title as event_title, e.date as event_date, 
             e.start_time, v.name as venue_name
      FROM signups s
      LEFT JOIN events e ON s.event_id = e.id
      LEFT JOIN venues v ON e.venue_id = v.id
      WHERE s.user_id = $1
      ORDER BY e.date DESC
    `;
    
    const result = await pool.query(query, [userId]);
    return result.rows;
  }

  static async updateStatus(id, status) {
    const query = `
      UPDATE signups SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    
    const result = await pool.query(query, [status, id]);
    return result.rows[0];
  }

  static async delete(id) {
    const query = 'DELETE FROM signups WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  static async deleteByEventAndUser(eventId, userId) {
    const query = 'DELETE FROM signups WHERE event_id = $1 AND user_id = $2 RETURNING *';
    const result = await pool.query(query, [eventId, userId]);
    return result.rows[0];
  }

  static async updatePerformerOrder(eventId, signupIds) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const updatedSignups = [];
      for (let i = 0; i < signupIds.length; i++) {
        const query = `
          UPDATE signups 
          SET performance_order = $1, updated_at = NOW()
          WHERE id = $2 AND event_id = $3
          RETURNING *
        `;
        const result = await client.query(query, [i + 1, signupIds[i], eventId]);
        if (result.rows[0]) {
          updatedSignups.push(result.rows[0]);
        }
      }
      
      await client.query('COMMIT');
      return updatedSignups;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async markAsFinished(id) {
    const query = `
      UPDATE signups 
      SET is_finished = true, finished_at = NOW(), updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  static async unmarkAsFinished(id) {
    const query = `
      UPDATE signups 
      SET is_finished = false, finished_at = NULL, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  static async addManualPerformer({ eventId, performanceName, performerName, performanceType, notes }) {
    // Get the next performance order
    const orderQuery = `
      SELECT COALESCE(MAX(performance_order), 0) + 1 as next_order
      FROM signups 
      WHERE event_id = $1
    `;
    const orderResult = await pool.query(orderQuery, [eventId]);
    const nextOrder = orderResult.rows[0].next_order;

    const query = `
      INSERT INTO signups (
        event_id, user_id, performance_name, notes, performance_type, 
        status, performance_order, created_at
      )
      VALUES ($1, NULL, $2, $3, $4, 'confirmed', $5, NOW())
      RETURNING *
    `;
    
    const values = [eventId, `${performerName} - ${performanceName}`, notes, performanceType, nextOrder];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async findByEventOrdered(eventId) {
    const query = `
      SELECT s.*, u.name as user_name, u.email as user_email
      FROM signups s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.event_id = $1 AND s.status = 'confirmed'
      ORDER BY 
        CASE WHEN s.performance_order IS NULL THEN 1 ELSE 0 END,
        s.performance_order,
        s.created_at
    `;
    
    const result = await pool.query(query, [eventId]);
    return result.rows;
  }
}

module.exports = Signup;