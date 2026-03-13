const { getDatabase } = require('./src/database/connection');

async function checkSchema() {
  const db = getDatabase();
  
  try {
    const tables = await db.query("SELECT name FROM sqlite_master WHERE type='table'");
    console.log('📋 Available tables:', tables.map(t => t.name));
    
    if (tables.find(t => t.name === 'users')) {
      const userSchema = await db.query("PRAGMA table_info(users)");
      console.log('\n👤 Users table schema:');
      userSchema.forEach(col => {
        console.log(`  ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Schema check failed:', error);
  }
}

checkSchema();