const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

class DatabaseSetup {
    constructor() {
        this.dbPath = process.env.DB_PATH || './data/schemesync.db';
        this.dataDir = path.dirname(this.dbPath);
    }

    async setup() {
        try {
            // Create data directory if it doesn't exist
            if (!fs.existsSync(this.dataDir)) {
                fs.mkdirSync(this.dataDir, { recursive: true });
                console.log(`Created data directory: ${this.dataDir}`);
            }

            // Read schema file
            const schemaPath = path.join(__dirname, 'schema.sql');
            const schema = fs.readFileSync(schemaPath, 'utf8');

            // Create database connection
            const db = new sqlite3.Database(this.dbPath);

            // Execute schema
            await this.executeSchema(db, schema);

            // Insert initial data
            await this.insertInitialData(db);

            db.close();
            console.log('Database setup completed successfully!');
        } catch (error) {
            console.error('Database setup failed:', error);
            process.exit(1);
        }
    }

    executeSchema(db, schema) {
        return new Promise((resolve, reject) => {
            db.exec(schema, (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('Database schema created successfully');
                    resolve();
                }
            });
        });
    }

    insertInitialData(db) {
        return new Promise((resolve, reject) => {
            const initialSources = [
                {
                    url: 'https://www.india.gov.in/my-government/schemes',
                    type: 'portal'
                },
                {
                    url: 'https://www.pmjay.gov.in/',
                    type: 'portal'
                },
                {
                    url: 'https://pmkisan.gov.in/',
                    type: 'portal'
                },
                {
                    url: 'https://www.nrega.nic.in/',
                    type: 'portal'
                }
            ];

            const stmt = db.prepare(`
                INSERT OR IGNORE INTO crawler_sources (source_url, source_type, is_active)
                VALUES (?, ?, 1)
            `);

            let completed = 0;
            initialSources.forEach(source => {
                stmt.run([source.url, source.type], (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    completed++;
                    if (completed === initialSources.length) {
                        stmt.finalize();
                        console.log('Initial crawler sources inserted');
                        resolve();
                    }
                });
            });
        });
    }
}

// Run setup if called directly
if (require.main === module) {
    require('dotenv').config();
    const setup = new DatabaseSetup();
    setup.setup();
}

module.exports = DatabaseSetup;