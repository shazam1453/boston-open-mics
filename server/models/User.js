const pool = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
  static async create({ email, password, name, phone, performerType, bio, socialMedia = {} }) {
    const hashedPassword = await bcrypt.hash(password, 12);
    
    const query = `
      INSERT INTO users (email, password, name, phone, performer_type, bio, 
                        instagram_handle, twitter_handle, tiktok_handle, youtube_handle, website_url, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      RETURNING id, email, name, phone, performer_type, bio, 
                instagram_handle, twitter_handle, tiktok_handle, youtube_handle, website_url, created_at
    `;
    
    const values = [
      email, hashedPassword, name, phone, performerType, bio,
      socialMedia.instagram || null,
      socialMedia.twitter || null,
      socialMedia.tiktok || null,
      socialMedia.youtube || null,
      socialMedia.website || null
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async findByEmail(email) {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await pool.query(query, [email]);
    return result.rows[0];
  }

  static async findById(id) {
    const query = `
      SELECT id, email, name, phone, performer_type, bio, 
             instagram_handle, twitter_handle, tiktok_handle, youtube_handle, website_url, created_at 
      FROM users WHERE id = $1
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  static async validatePassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  static async updateProfile(id, updates) {
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
      UPDATE users SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount}
      RETURNING id, email, name, phone, performer_type, bio, 
                instagram_handle, twitter_handle, tiktok_handle, youtube_handle, website_url, updated_at
    `;

    const result = await pool.query(query, values);
    return result.rows[0];
  }
}

module.exports = User;