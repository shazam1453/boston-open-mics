// Script to seed DynamoDB with initial test data
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// Configure AWS (make sure your credentials are set)
const dynamodb = new AWS.DynamoDB.DocumentClient({
  region: 'us-east-2'
});

// Table names (update these to match your deployed table names)
const USERS_TABLE = 'boston-open-mics-api-prod-users';
const VENUES_TABLE = 'boston-open-mics-api-prod-venues';
const EVENTS_TABLE = 'boston-open-mics-api-prod-events';
const SIGNUPS_TABLE = 'boston-open-mics-api-prod-signups';

// Password hashing function
const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hashedPassword = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex') + ':' + salt;
  return hashedPassword;
};

const seedData = async () => {
  console.log('🌱 Seeding DynamoDB with test data...');

  try {
    // Create test users
    const users = [
      {
        id: uuidv4(),
        name: 'John Doe',
        email: 'john@example.com',
        password: hashPassword('password123'),
        phone: '555-0123',
        performer_type: 'musician',
        bio: 'Local musician and open mic enthusiast',
        role: 'user',
        instagram_handle: 'johndoe_music',
        twitter_handle: 'johndoe',
        tiktok_handle: '',
        youtube_handle: 'johndoemusic',
        website_url: 'https://johndoe.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: uuidv4(),
        name: 'Jane Smith',
        email: 'jane@example.com',
        password: hashPassword('password123'),
        phone: '555-0124',
        performer_type: 'comedian',
        bio: 'Stand-up comedian and event host',
        role: 'admin',
        instagram_handle: 'janesmith_comedy',
        twitter_handle: 'janesmith',
        tiktok_handle: 'janesmith_comedy',
        youtube_handle: '',
        website_url: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    // Create test venues
    const venues = [
      {
        id: uuidv4(),
        name: 'The Cantab Lounge',
        address: '738 Massachusetts Ave, Cambridge, MA 02139',
        description: 'Historic venue with a great open mic scene',
        capacity: 100,
        owner_id: users[0].id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: uuidv4(),
        name: 'Club Passim',
        address: '47 Palmer St, Cambridge, MA 02138',
        description: 'Intimate folk music venue',
        capacity: 80,
        owner_id: users[1].id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    // Create test events
    const events = [
      {
        id: uuidv4(),
        title: 'Monday Night Open Mic',
        description: 'Weekly open mic night featuring local talent',
        venue_id: venues[0].id,
        date: '2025-10-06',
        start_time: '19:00:00',
        end_time: '22:00:00',
        max_performers: 15,
        performance_length: 5,
        event_type: 'open-mic',
        signup_list_mode: 'signup_order',
        signup_opens: null,
        signup_deadline: null,
        host_id: users[0].id,
        event_status: 'upcoming',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: uuidv4(),
        title: 'Comedy Showcase',
        description: 'Monthly comedy showcase',
        venue_id: venues[1].id,
        date: '2025-10-15',
        start_time: '20:00:00',
        end_time: '23:00:00',
        max_performers: 10,
        performance_length: 7,
        event_type: 'showcase',
        signup_list_mode: 'random_order',
        signup_opens: null,
        signup_deadline: null,
        host_id: users[1].id,
        event_status: 'upcoming',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    // Create test signup
    const signups = [
      {
        id: uuidv4(),
        event_id: events[0].id,
        user_id: users[0].id,
        performance_name: 'Acoustic Set',
        performance_type: 'music',
        notes: 'Playing original songs',
        status: 'confirmed',
        performance_order: 1,
        is_current_performer: false,
        is_finished: false,
        finished_at: null,
        individual_performance_length: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    // Insert data into DynamoDB
    console.log('📝 Inserting users...');
    for (const user of users) {
      await dynamodb.put({
        TableName: USERS_TABLE,
        Item: user
      }).promise();
      console.log(`✅ Created user: ${user.name} (${user.email})`);
    }

    console.log('🏢 Inserting venues...');
    for (const venue of venues) {
      await dynamodb.put({
        TableName: VENUES_TABLE,
        Item: venue
      }).promise();
      console.log(`✅ Created venue: ${venue.name}`);
    }

    console.log('🎤 Inserting events...');
    for (const event of events) {
      await dynamodb.put({
        TableName: EVENTS_TABLE,
        Item: event
      }).promise();
      console.log(`✅ Created event: ${event.title}`);
    }

    console.log('📝 Inserting signups...');
    for (const signup of signups) {
      await dynamodb.put({
        TableName: SIGNUPS_TABLE,
        Item: signup
      }).promise();
      console.log(`✅ Created signup: ${signup.performance_name}`);
    }

    console.log('🎉 Database seeded successfully!');
    console.log('');
    console.log('Test credentials:');
    console.log('- Email: john@example.com, Password: password123 (User)');
    console.log('- Email: jane@example.com, Password: password123 (Admin)');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

// Run the seeding
seedData();