const pool = require('../config/database');
const bcrypt = require('bcryptjs');

async function generateSlug(name) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'user';
  let slug = base;
  let n = 2;
  while (true) {
    const conflict = await pool.query('SELECT id FROM users WHERE slug = $1', [slug]);
    if (conflict.rows.length === 0) break;
    slug = base + '-' + n++;
  }
  return slug;
}

class User {
  static async create({ email, password, name, phone, performerType, bio, socialMedia = {} }) {
    const hashedPassword = await bcrypt.hash(password, 12);
    const slug = await generateSlug(name);

    const query = `
      INSERT INTO users (email, password, name, phone, performer_type, bio,
                        instagram_handle, twitter_handle, tiktok_handle, youtube_handle, website_url, slug, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      RETURNING id, email, name, phone, performer_type, bio,
                instagram_handle, twitter_handle, tiktok_handle, youtube_handle, website_url, slug, created_at
    `;

    const values = [
      email, hashedPassword, name, phone, performerType, bio,
      socialMedia.instagram || null,
      socialMedia.twitter || null,
      socialMedia.tiktok || null,
      socialMedia.youtube || null,
      socialMedia.website || null,
      slug
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
      SELECT id, email, name, phone, performer_type, bio, role,
             instagram_handle, twitter_handle, tiktok_handle, youtube_handle, website_url, slug, created_at
      FROM users WHERE id = $1
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  static async findBySlug(slug) {
    const query = `
      SELECT id, email, name, phone, performer_type, bio, role,
             instagram_handle, twitter_handle, tiktok_handle, youtube_handle, website_url, slug, created_at
      FROM users WHERE slug = $1
    `;
    const result = await pool.query(query, [slug]);
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
                instagram_handle, twitter_handle, tiktok_handle, youtube_handle, website_url, slug, updated_at
    `;

    const result = await pool.query(query, values);
    return result.rows[0];
  }
  static async updatePassword(id, newPassword) {
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    const query = 'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2';
    await pool.query(query, [hashedPassword, id]);
  }
}

module.exports = User;