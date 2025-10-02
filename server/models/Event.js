const pool = require('../config/database');

class Event {
  static async create({ 
    title, 
    description, 
    venueId, 
    date, 
    startTime, 
    endTime, 
    maxPerformers, 
    performanceLength, 
    eventType, 
    signupListMode = 'signup_order',
    signupOpens,
    signupDeadline,
    hostId,
    recurringTemplateId = null
  }) {
    const query = `
      INSERT INTO events (
        title, description, venue_id, date, start_time, end_time, 
        max_performers, performance_length, event_type, signup_list_mode, signup_opens, signup_deadline, 
        host_id, recurring_template_id, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
      RETURNING *
    `;
    
    const values = [
      title, description, venueId, date, startTime, endTime,
      maxPerformers, performanceLength, eventType, signupListMode, signupOpens, signupDeadline, hostId, recurringTemplateId
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT e.*, v.name as venue_name, v.address as venue_address,
             u.name as host_name,
             COUNT(s.id) as current_signups
      FROM events e
      LEFT JOIN venues v ON e.venue_id = v.id
      LEFT JOIN users u ON e.host_id = u.id
      LEFT JOIN signups s ON e.id = s.event_id AND s.status = 'confirmed'
    `;
    
    const conditions = [];
    const values = [];
    let paramCount = 1;

    if (filters.date) {
      conditions.push(`e.date = $${paramCount}`);
      values.push(filters.date);
      paramCount++;
    }

    if (filters.eventType) {
      conditions.push(`e.event_type = $${paramCount}`);
      values.push(filters.eventType);
      paramCount++;
    }

    if (filters.venueId) {
      conditions.push(`e.venue_id = $${paramCount}`);
      values.push(filters.venueId);
      paramCount++;
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` GROUP BY e.id, v.name, v.address, u.name ORDER BY e.date, e.start_time`;

    const result = await pool.query(query, values);
    return result.rows;
  }

  static async findById(id) {
    const query = `
      SELECT e.*, v.name as venue_name, v.address as venue_address,
             u.name as host_name, u.email as host_email,
             COUNT(DISTINCT s.id) as current_signups,
             json_agg(
               DISTINCT json_build_object(
                 'user_id', ec.user_id,
                 'user_name', cu.name,
                 'user_email', cu.email
               )
             ) FILTER (WHERE ec.user_id IS NOT NULL) as cohosts,
             json_agg(
               DISTINCT json_build_object(
                 'id', s.id,
                 'user_id', s.user_id,
                 'user_name', su.name,
                 'performance_status', s.performance_status,
                 'signup_order', s.signup_order,
                 'signed_up_at', s.signed_up_at
               ) ORDER BY s.signup_order
             ) FILTER (WHERE s.id IS NOT NULL) as signups
      FROM events e
      LEFT JOIN venues v ON e.venue_id = v.id
      LEFT JOIN users u ON e.host_id = u.id
      LEFT JOIN signups s ON e.id = s.event_id AND s.status = 'confirmed'
      LEFT JOIN users su ON s.user_id = su.id
      LEFT JOIN event_cohosts ec ON e.id = ec.event_id
      LEFT JOIN users cu ON ec.user_id = cu.id
      WHERE e.id = $1
      GROUP BY e.id, v.name, v.address, u.name, u.email
    `;
    
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  static async findByHost(hostId) {
    const query = `
      SELECT e.*, v.name as venue_name,
             COUNT(s.id) as current_signups
      FROM events e
      LEFT JOIN venues v ON e.venue_id = v.id
      LEFT JOIN signups s ON e.id = s.event_id AND s.status = 'confirmed'
      WHERE e.host_id = $1
      GROUP BY e.id, v.name
      ORDER BY e.date DESC
    `;
    
    const result = await pool.query(query, [hostId]);
    return result.rows;
  }

  static async update(id, updates) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(updates[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) return null;

    values.push(id);
    const query = `
      UPDATE events SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async delete(id) {
    const query = 'DELETE FROM events WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  static async startEvent(id) {
    const query = `
      UPDATE events 
      SET event_status = 'live', started_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND event_status = 'scheduled'
      RETURNING *
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  static async finishEvent(id) {
    const query = `
      UPDATE events 
      SET event_status = 'finished', updated_at = NOW()
      WHERE id = $1 AND event_status = 'live'
      RETURNING *
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  static async setCurrentPerformer(eventId, performerId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Update the signup to mark as current performer
      await client.query(`
        UPDATE signups 
        SET performance_status = 'current', updated_at = NOW()
        WHERE event_id = $1 AND user_id = $2
      `, [eventId, performerId]);

      // Mark any other current performers as performed
      await client.query(`
        UPDATE signups 
        SET performance_status = 'performed', updated_at = NOW()
        WHERE event_id = $1 AND user_id != $2 AND performance_status = 'current'
      `, [eventId, performerId]);

      await client.query('COMMIT');

      // Return updated event with signups
      const result = await client.query(`
        SELECT e.*, 
               json_agg(
                 json_build_object(
                   'id', s.id,
                   'user_id', s.user_id,
                   'user_name', u.name,
                   'performance_status', s.performance_status,
                   'signup_order', s.signup_order,
                   'signed_up_at', s.signed_up_at
                 ) ORDER BY s.signup_order
               ) FILTER (WHERE s.id IS NOT NULL) as signups
        FROM events e
        LEFT JOIN signups s ON e.id = s.event_id AND s.status = 'confirmed'
        LEFT JOIN users u ON s.user_id = u.id
        WHERE e.id = $1
        GROUP BY e.id
      `, [eventId]);

      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async randomizeOrder(eventId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get all confirmed signups for this event
      const signupsResult = await client.query(`
        SELECT id FROM signups 
        WHERE event_id = $1 AND status = 'confirmed'
        ORDER BY id
      `, [eventId]);

      const signups = signupsResult.rows;
      
      // Create randomized order
      const randomizedOrder = [...Array(signups.length)].map((_, i) => i + 1).sort(() => Math.random() - 0.5);

      // Update each signup with new random order
      for (let i = 0; i < signups.length; i++) {
        await client.query(`
          UPDATE signups 
          SET signup_order = $1, updated_at = NOW()
          WHERE id = $2
        `, [randomizedOrder[i], signups[i].id]);
      }

      await client.query('COMMIT');

      // Return updated event with signups
      const result = await client.query(`
        SELECT e.*, 
               json_agg(
                 json_build_object(
                   'id', s.id,
                   'user_id', s.user_id,
                   'user_name', u.name,
                   'performance_status', s.performance_status,
                   'signup_order', s.signup_order,
                   'signed_up_at', s.signed_up_at
                 ) ORDER BY s.signup_order
               ) FILTER (WHERE s.id IS NOT NULL) as signups
        FROM events e
        LEFT JOIN signups s ON e.id = s.event_id AND s.status = 'confirmed'
        LEFT JOIN users u ON s.user_id = u.id
        WHERE e.id = $1
        GROUP BY e.id
      `, [eventId]);

      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async addCohost(eventId, userId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check if user exists
      const userResult = await client.query('SELECT id FROM users WHERE id = $1', [userId]);
      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      // Check if user is already a co-host
      const existingCohost = await client.query(`
        SELECT id FROM event_cohosts WHERE event_id = $1 AND user_id = $2
      `, [eventId, userId]);

      if (existingCohost.rows.length > 0) {
        throw new Error('User is already a co-host');
      }

      // Add co-host
      await client.query(`
        INSERT INTO event_cohosts (event_id, user_id, created_at)
        VALUES ($1, $2, NOW())
      `, [eventId, userId]);

      await client.query('COMMIT');

      // Return updated event with co-hosts
      const result = await client.query(`
        SELECT e.*, 
               json_agg(
                 json_build_object(
                   'user_id', ec.user_id,
                   'user_name', u.name,
                   'user_email', u.email
                 )
               ) FILTER (WHERE ec.user_id IS NOT NULL) as cohosts
        FROM events e
        LEFT JOIN event_cohosts ec ON e.id = ec.event_id
        LEFT JOIN users u ON ec.user_id = u.id
        WHERE e.id = $1
        GROUP BY e.id
      `, [eventId]);

      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async removeCohost(eventId, cohostId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Remove co-host
      const result = await client.query(`
        DELETE FROM event_cohosts 
        WHERE event_id = $1 AND user_id = $2
        RETURNING *
      `, [eventId, cohostId]);

      if (result.rows.length === 0) {
        throw new Error('Co-host not found');
      }

      await client.query('COMMIT');

      // Return updated event with co-hosts
      const eventResult = await client.query(`
        SELECT e.*, 
               json_agg(
                 json_build_object(
                   'user_id', ec.user_id,
                   'user_name', u.name,
                   'user_email', u.email
                 )
               ) FILTER (WHERE ec.user_id IS NOT NULL) as cohosts
        FROM events e
        LEFT JOIN event_cohosts ec ON e.id = ec.event_id
        LEFT JOIN users u ON ec.user_id = u.id
        WHERE e.id = $1
        GROUP BY e.id
      `, [eventId]);

      return eventResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = Event;