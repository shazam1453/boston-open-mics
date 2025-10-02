const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function setupDatabase() {
  // First connect to postgres database to create our database
  const adminPool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: 'postgres', // Connect to default postgres database
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
  });

  try {
    // Create database if it doesn't exist
    const dbName = process.env.DB_NAME || 'boston_open_mics';
    await adminPool.query(`CREATE DATABASE ${dbName}`);
    console.log(`Database ${dbName} created successfully`);
  } catch (error) {
    if (error.code === '42P04') {
      console.log('Database already exists, continuing...');
    } else {
      console.error('Error creating database:', error.message);
      process.exit(1);
    }
  } finally {
    await adminPool.end();
  }

  // Now connect to our database and run the schema
  const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'boston_open_mics',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
  });

  try {
    const schemaSQL = fs.readFileSync(path.join(__dirname, 'config', 'schema.sql'), 'utf8');
    await pool.query(schemaSQL);
    console.log('Database schema created successfully');
  } catch (error) {
    console.error('Error creating schema:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupDatabase();