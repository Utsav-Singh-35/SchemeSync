// Test script to create a demo user and auth token for extension testing
const { getDatabase } = require('./src/database/connection');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

async function createTestUser() {
  const db = getDatabase();
  
  try {
    // Create test user in users table
    const hashedPassword = await bcrypt.hash('test123', 10);
    
    // First delete existing user if exists
    await db.run(`DELETE FROM user_profiles WHERE user_id IN (SELECT id FROM users WHERE email = ?)`, ['test@example.com']);
    await db.run(`DELETE FROM users WHERE email = ?`, ['test@example.com']);
    
    const userResult = await db.run(`
      INSERT INTO users (
        email, password_hash, name, created_at, updated_at
      ) VALUES (?, ?, ?, datetime('now'), datetime('now'))
    `, [
      'test@example.com',
      hashedPassword,
      'Test User'
    ]);
    
    const userId = userResult.id;
    console.log('Created user with ID:', userId);
    
    // Create user profile in user_profiles table
    await db.run(`
      INSERT OR REPLACE INTO user_profiles (
        user_id, phone_number, date_of_birth, gender, state, district, 
        annual_income, occupation, category, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `, [
      userId,
      '9876543210',
      '1990-01-01',
      'male',
      'Karnataka',
      'Bangalore',
      500000,
      'Software Engineer',
      'general'
    ]);
    
    // Generate JWT token
    const token = jwt.sign(
      { userId, email: 'test@example.com' },
      process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
      { expiresIn: '7d' }
    );
    
    console.log('✅ Test user created successfully!');
    console.log('📧 Email: test@example.com');
    console.log('🔑 Password: test123');
    console.log('🎫 Auth Token:', token);
    console.log('\n📋 To use in extension:');
    console.log('1. Open Chrome DevTools on extension popup');
    console.log('2. Go to Application > Storage > Local Storage > chrome-extension://...');
    console.log('3. Add key: "authToken"');
    console.log('4. Add value:', token);
    console.log('5. Reload extension popup');
    
  } catch (error) {
    console.error('❌ Failed to create test user:', error);
  }
}

createTestUser();