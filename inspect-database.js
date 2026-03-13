const { getDatabase } = require('./Backend/src/database/connection');

async function inspectDatabase() {
    const db = getDatabase();
    
    try {
        await db.connect();
        console.log(`Connected to: ${db.dbPath}`);
        
        // Get all tables
        const tables = await db.query(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name NOT LIKE 'sqlite_%'
            ORDER BY name
        `);
        
        console.log('\nExisting tables:');
        tables.forEach(table => {
            console.log(`  - ${table.name}`);
        });
        
        // Check if extension tables exist
        const extensionTables = [
            'user_custom_fields',
            'user_documents', 
            'autofill_logs',
            'form_field_mappings',
            'document_type_mappings',
            'portal_metadata'
        ];
        
        console.log('\nExtension table status:');
        for (const tableName of extensionTables) {
            const exists = tables.some(t => t.name === tableName);
            console.log(`  ${exists ? '✅' : '❌'} ${tableName}`);
        }
        
    } catch (error) {
        console.error('Database inspection failed:', error);
    } finally {
        await db.close();
    }
}

inspectDatabase();