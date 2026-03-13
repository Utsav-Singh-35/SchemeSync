const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const crawlerDbPath = path.join(__dirname, '../myscheme-crawler/comprehensive_schemes.db');

const db = new sqlite3.Database(crawlerDbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        process.exit(1);
    }
});

// Get table schema
db.all("PRAGMA table_info(comprehensive_schemes)", (err, columns) => {
    if (err) {
        console.error('Error getting schema:', err.message);
        process.exit(1);
    }
    
    console.log('Crawler Database Schema:');
    console.log('========================');
    columns.forEach(col => {
        console.log(`${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
    });
    
    // Get sample data
    db.get("SELECT COUNT(*) as count FROM comprehensive_schemes", (err, result) => {
        if (err) {
            console.error('Error counting records:', err.message);
        } else {
            console.log(`\nTotal records: ${result.count}`);
        }
        
        // Get first record to see actual data structure
        db.get("SELECT * FROM comprehensive_schemes LIMIT 1", (err, row) => {
            if (err) {
                console.error('Error getting sample:', err.message);
            } else if (row) {
                console.log('\nSample record fields:');
                console.log('=====================');
                Object.keys(row).forEach(key => {
                    const value = row[key];
                    const preview = value ? value.toString().substring(0, 50) + '...' : 'NULL';
                    console.log(`${key}: ${preview}`);
                });
            }
            
            db.close();
        });
    });
});