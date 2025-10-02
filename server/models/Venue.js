const pool = require('../config/database');

class Venue {
  static async create({ name, address, phone, email, description, capacity, amenities, ownerId }) {
    const query = `
      INSERT INTO venues (name, address, phone, email, description, capacity, amenities, owner_id, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING *
    `;
    
    const values = [name, address, phone, email, description, capacity, JSON.stringify(amenities), ownerId];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async findAll() {
    const query = `
      SELECT v.*, u.name as owner_name 
      FROM venues v 
      LEFT JOIN users u ON v.owner_id = u.id 
      ORDER BY v.name
    `;
    const result = await pool.query(query);
    return result.rows.map(venue => ({
      ...venue,
      amenities: JSON.parse(venue.amenities || '[]')
    }));
  }

  static async findById(id) {
    const query = `
      SELECT v.*, u.name as owner_name 
      FROM venues v 
      LEFT JOIN users u ON v.owner_id = u.id 
      WHERE v.id = $1
    `;
    const result = await pool.query(query, [id]);
    const venue = result.rows[0];
    if (venue) {
      venue.amenities = JSON.parse(venue.amenities || '[]');
    }
    return venue;
  }

  static async findByOwner(ownerId) {
    const query = 'SELECT * FROM venues WHERE owner_id = $1 ORDER BY name';
    const result = await pool.query(query, [ownerId]);
    return result.rows.map(venue => ({
      ...venue,
      amenities: JSON.parse(venue.amenities || '[]')
    }));
  }

  static async update(id, updates) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        if (key === 'amenities') {
          fields.push(`${key} = $${paramCount}`);
          values.push(JSON.stringify(updates[key]));
        } else {
          fields.push(`${key} = $${paramCount}`);
          values.push(updates[key]);
        }
        paramCount++;
      }
    });

    if (fields.length === 0) return null;

    values.push(id);
    const query = `
      UPDATE venues SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    const venue = result.rows[0];
    if (venue) {
      venue.amenities = JSON.parse(venue.amenities || '[]');
    }
    return venue;
  }

  static async delete(id) {
    const query = 'DELETE FROM venues WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }
}

module.exports = Venue;