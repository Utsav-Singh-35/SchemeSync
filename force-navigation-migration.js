const { getDatabase } = require('./Backend/src/database/connection');

async function forceNavigationMigration() {
    const db = getDatabase();
    
    try {
        await db.connect();
        console.log('🔧 Force creating navigation tables...');
        
        // Create tables individually with error handling
        const tables = [
            {
                name: 'navigation_analysis_logs',
                sql: `CREATE TABLE navigation_analysis_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    url TEXT NOT NULL,
                    domain TEXT NOT NULL,
                    action TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    reasoning TEXT,
                    method TEXT NOT NULL,
                    element TEXT,
                    data TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    session_id TEXT,
                    user_id INTEGER,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
                )`
            },
            {
                name: 'navigation_sessions',
                sql: `CREATE TABLE navigation_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT UNIQUE NOT NULL,
                    user_id INTEGER,
                    start_url TEXT NOT NULL,
                    target_objective TEXT NOT NULL,
                    current_step INTEGER DEFAULT 1,
                    total_steps INTEGER,
                    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'failed', 'abandoned')),
                    success BOOLEAN,
                    error_message TEXT,
                    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    completed_at DATETIME,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
                )`
            },
            {
                name: 'navigation_steps',
                sql: `CREATE TABLE navigation_steps (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    step_number INTEGER NOT NULL,
                    url TEXT NOT NULL,
                    action TEXT NOT NULL,
                    element TEXT,
                    data TEXT,
                    confidence REAL,
                    reasoning TEXT,
                    user_confirmed BOOLEAN DEFAULT 0,
                    success BOOLEAN,
                    error_message TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                )`
            },
            {
                name: 'portal_configurations',
                sql: `CREATE TABLE portal_configurations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    domain TEXT UNIQUE NOT NULL,
                    portal_name TEXT,
                    portal_type TEXT,
                    login_methods TEXT,
                    common_patterns TEXT,
                    success_rate REAL DEFAULT 0.0,
                    last_analysis DATETIME,
                    is_active BOOLEAN DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`
            },
            {
                name: 'llm_analysis_cache',
                sql: `CREATE TABLE llm_analysis_cache (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    content_hash TEXT UNIQUE NOT NULL,
                    url_pattern TEXT,
                    analysis_result TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    model_version TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    expires_at DATETIME,
                    hit_count INTEGER DEFAULT 0,
                    last_used DATETIME DEFAULT CURRENT_TIMESTAMP
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
        
        // Insert portal configurations
        const portals = [
            ['pmkisan.gov.in', 'PM-KISAN Portal', 'central'],
            ['pmjay.gov.in', 'Ayushman Bharat PM-JAY', 'central'],
            ['scholarships.gov.in', 'National Scholarship Portal', 'central'],
            ['india.gov.in', 'India Portal', 'central']
        ];
        
        for (const [domain, name, type] of portals) {
            try {
                await db.run(`
                    INSERT OR IGNORE INTO portal_configurations (domain, portal_name, portal_type)
                    VALUES (?, ?, ?)
                `, [domain, name, type]);
                console.log(`✅ Added portal: ${name}`);
            } catch (error) {
                console.error(`❌ Failed to add portal ${domain}:`, error.message);
            }
        }
        
        console.log('\n🎉 Navigation tables created successfully!');
        
    } catch (error) {
        console.error('❌ Force migration failed:', error);
    } finally {
        await db.close();
    }
}

forceNavigationMigration();