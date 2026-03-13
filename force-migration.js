const { getDatabase } = require('./Backend/src/database/connection');

async function forceMigration() {
    const db = getDatabase();
    
    try {
        await db.connect();
        console.log('🔧 Force executing extension schema...');
        
        // Execute each table creation individually with error handling
        const tables = [
            {
                name: 'user_custom_fields',
                sql: `CREATE TABLE user_custom_fields (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    field_name TEXT NOT NULL,
                    field_value TEXT NOT NULL,
                    source TEXT DEFAULT 'manual',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    UNIQUE(user_id, field_name)
                )`
            },
            {
                name: 'user_documents',
                sql: `CREATE TABLE user_documents (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    filename TEXT NOT NULL,
                    original_name TEXT NOT NULL,
                    file_type TEXT NOT NULL,
                    category TEXT NOT NULL,
                    file_size INTEGER,
                    mime_type TEXT,
                    s3_key TEXT,
                    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                    is_active BOOLEAN DEFAULT 1,
                    verification_status TEXT DEFAULT 'pending' CHECK(verification_status IN ('pending', 'verified', 'rejected')),
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )`
            },
            {
                name: 'autofill_logs',
                sql: `CREATE TABLE autofill_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    portal TEXT NOT NULL,
                    url TEXT NOT NULL,
                    fields_detected INTEGER DEFAULT 0,
                    fields_filled INTEGER DEFAULT 0,
                    documents_uploaded INTEGER DEFAULT 0,
                    missing_fields INTEGER DEFAULT 0,
                    errors INTEGER DEFAULT 0,
                    success BOOLEAN DEFAULT 0,
                    timestamp DATETIME NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )`
            },
            {
                name: 'portal_metadata',
                sql: `CREATE TABLE portal_metadata (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    hostname TEXT UNIQUE NOT NULL,
                    portal_name TEXT,
                    portal_type TEXT,
                    form_detection_rules TEXT,
                    known_field_patterns TEXT,
                    captcha_patterns TEXT,
                    is_active BOOLEAN DEFAULT 1,
                    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`
            }
        ];
        
        for (const table of tables) {
            try {
                await db.run(table.sql);
                console.log(`✅ Created table: ${table.name}`);
            } catch (error) {
                if (error.message.includes('already exists')) {
                    console.log(`⚠️  Table ${table.name} already exists`);
                } else {
                    console.error(`❌ Failed to create ${table.name}:`, error.message);
                }
            }
        }
        
        // Insert portal data
        const portals = [
            ['pmkisan.gov.in', 'PM-KISAN Portal', 'government'],
            ['pmjay.gov.in', 'Ayushman Bharat PM-JAY', 'government'],
            ['scholarships.gov.in', 'National Scholarship Portal', 'government'],
            ['india.gov.in', 'India Portal', 'government']
        ];
        
        for (const [hostname, name, type] of portals) {
            try {
                await db.run(`
                    INSERT OR IGNORE INTO portal_metadata (hostname, portal_name, portal_type)
                    VALUES (?, ?, ?)
                `, [hostname, name, type]);
                console.log(`✅ Added portal: ${name}`);
            } catch (error) {
                console.error(`❌ Failed to add portal ${hostname}:`, error.message);
            }
        }
        
        console.log('\n🎉 Force migration completed!');
        
    } catch (error) {
        console.error('❌ Force migration failed:', error);
    } finally {
        await db.close();
    }
}

forceMigration();