const { getDatabase } = require('./Backend/src/database/connection');

async function addMissingTables() {
    const db = getDatabase();
    
    try {
        await db.connect();
        
        // Add missing tables
        const missingTables = [
            {
                name: 'form_field_mappings',
                sql: `CREATE TABLE form_field_mappings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    portal TEXT NOT NULL,
                    field_label TEXT NOT NULL,
                    field_name TEXT NOT NULL,
                    field_type TEXT NOT NULL,
                    mapped_profile_field TEXT,
                    confidence_score REAL DEFAULT 0.0,
                    usage_count INTEGER DEFAULT 1,
                    success_rate REAL DEFAULT 0.0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(portal, field_label, field_name)
                )`
            },
            {
                name: 'document_type_mappings',
                sql: `CREATE TABLE document_type_mappings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    portal TEXT NOT NULL,
                    field_label TEXT NOT NULL,
                    document_type TEXT NOT NULL,
                    confidence_score REAL DEFAULT 0.0,
                    usage_count INTEGER DEFAULT 1,
                    success_rate REAL DEFAULT 0.0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(portal, field_label, document_type)
                )`
            }
        ];
        
        for (const table of missingTables) {
            try {
                await db.run(table.sql);
                console.log(`✅ Created table: ${table.name}`);
            } catch (error) {
                console.error(`❌ Failed to create ${table.name}:`, error.message);
            }
        }
        
    } catch (error) {
        console.error('Failed to add missing tables:', error);
    } finally {
        await db.close();
    }
}

addMissingTables();