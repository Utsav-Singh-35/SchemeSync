const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor() {
        this.dbPath = process.env.DB_PATH || './data/schemesync.db';
        this.db = null;
        this.isConnected = false;
    }

    connect() {
        return new Promise((resolve, reject) => {
            if (this.isConnected) {
                resolve();
                return;
            }
            
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    reject(err);
                } else {
                    this.isConnected = true;
                    console.log('Connected to SQLite database');
                    // Enable WAL mode for better concurrency
                    this.db.run('PRAGMA journal_mode = WAL');
                    this.db.run('PRAGMA synchronous = NORMAL');
                    this.db.run('PRAGMA cache_size = 1000');
                    this.db.run('PRAGMA temp_store = memory');
                    // Enable foreign keys
                    this.db.run('PRAGMA foreign_keys = ON');
                    resolve();
                }
            });
        });
    }

    close() {
        return new Promise((resolve, reject) => {
            if (this.db && this.isConnected) {
                this.db.close((err) => {
                    if (err) {
                        reject(err);
                    } else {
                        this.isConnected = false;
                        console.log('Database connection closed');
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }

    // Generic query method
    query(sql, params = []) {
        return new Promise(async (resolve, reject) => {
            if (!this.isConnected) {
                try {
                    await this.connect();
                } catch (err) {
                    reject(err);
                    return;
                }
            }
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Get single row
    get(sql, params = []) {
        return new Promise(async (resolve, reject) => {
            if (!this.isConnected) {
                try {
                    await this.connect();
                } catch (err) {
                    reject(err);
                    return;
                }
            }
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Insert/Update/Delete operations
    run(sql, params = []) {
        return new Promise(async (resolve, reject) => {
            if (!this.isConnected) {
                try {
                    await this.connect();
                } catch (err) {
                    reject(err);
                    return;
                }
            }
            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({
                        id: this.lastID,
                        changes: this.changes
                    });
                }
            });
        });
    }

    // FTS5 search method
    searchSchemes(query, limit = 20, offset = 0) {
        const sql = `
            SELECT s.*, 
                   snippet(schemes_fts, 0, '<mark>', '</mark>', '...', 32) as snippet
            FROM schemes_fts 
            JOIN schemes s ON schemes_fts.rowid = s.id
            WHERE schemes_fts MATCH ? AND s.is_active = 1
            ORDER BY rank
            LIMIT ? OFFSET ?
        `;
        return this.query(sql, [query, limit, offset]);
    }

    // Get schemes by category
    getSchemesByCategory(category, limit = 20, offset = 0) {
        const sql = `
            SELECT * FROM schemes 
            WHERE category = ? AND is_active = 1
            ORDER BY last_updated DESC
            LIMIT ? OFFSET ?
        `;
        return this.query(sql, [category, limit, offset]);
    }

    // Transaction support
    beginTransaction() {
        return this.run('BEGIN TRANSACTION');
    }

    commit() {
        return this.run('COMMIT');
    }

    rollback() {
        return this.run('ROLLBACK');
    }
}

// Singleton instance
let dbInstance = null;
let connectionPromise = null;

function getDatabase() {
    if (!dbInstance) {
        dbInstance = new Database();
    }
    return dbInstance;
}

// Ensure single connection initialization
async function ensureConnection() {
    if (!connectionPromise) {
        const db = getDatabase();
        connectionPromise = db.connect();
    }
    return connectionPromise;
}

module.exports = { Database, getDatabase, ensureConnection };