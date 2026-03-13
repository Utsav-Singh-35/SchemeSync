const { getDatabase } = require('../database/connection');

class CrawlerQueue {
    constructor(sharedDb = null) {
        this.db = sharedDb || getDatabase();
        this.processing = false;
        this.maxConcurrent = 1; // Single threaded to avoid blocking
        this.retryAttempts = 3;
    }

    async initialize() {
        // Only connect if we own the database connection
        if (!this.db.isConnected) {
            await this.db.connect();
        }
        await this.createQueueTable();
        console.log('Crawler queue initialized');
    }

    async createQueueTable() {
        await this.db.run(`
            CREATE TABLE IF NOT EXISTS crawler_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url TEXT UNIQUE NOT NULL,
                priority INTEGER DEFAULT 1,
                status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
                retry_count INTEGER DEFAULT 0,
                portal_type TEXT,
                parser_type TEXT,
                added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                processed_at DATETIME,
                error_message TEXT,
                metadata TEXT
            )
        `);

        await this.db.run(`
            CREATE INDEX IF NOT EXISTS idx_queue_status ON crawler_queue(status, priority DESC)
        `);
    }

    async addUrl(url, options = {}) {
        const {
            priority = 1,
            portalType = 'generic',
            parserType = 'generic',
            metadata = {}
        } = options;

        try {
            await this.db.run(`
                INSERT OR IGNORE INTO crawler_queue 
                (url, priority, portal_type, parser_type, metadata)
                VALUES (?, ?, ?, ?, ?)
            `, [url, priority, portalType, parserType, JSON.stringify(metadata)]);

            console.log(`📋 Added to queue: ${url}`);
            return true;
        } catch (error) {
            console.error(`Error adding URL to queue: ${error.message}`);
            return false;
        }
    }

    async addUrls(urls, options = {}) {
        let addedCount = 0;
        
        for (const url of urls) {
            const success = await this.addUrl(url, options);
            if (success) addedCount++;
        }
        
        console.log(`📋 Added ${addedCount}/${urls.length} URLs to queue`);
        return addedCount;
    }

    async getNextUrl() {
        const url = await this.db.get(`
            SELECT * FROM crawler_queue 
            WHERE status = 'pending' AND retry_count < ?
            ORDER BY priority DESC, added_at ASC
            LIMIT 1
        `, [this.retryAttempts]);

        if (url) {
            // Mark as processing
            await this.db.run(`
                UPDATE crawler_queue 
                SET status = 'processing', processed_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [url.id]);
        }

        return url;
    }

    async markCompleted(urlId, result = {}) {
        await this.db.run(`
            UPDATE crawler_queue 
            SET status = 'completed', processed_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [urlId]);

        console.log(`✅ Completed: ${result.url || urlId}`);
    }

    async markFailed(urlId, error, shouldRetry = true) {
        if (shouldRetry) {
            await this.db.run(`
                UPDATE crawler_queue 
                SET status = 'pending', retry_count = retry_count + 1, 
                    error_message = ?, processed_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [error, urlId]);
            
            console.log(`⚠️ Failed (will retry): ${urlId} - ${error}`);
        } else {
            await this.db.run(`
                UPDATE crawler_queue 
                SET status = 'failed', error_message = ?, processed_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [error, urlId]);
            
            console.log(`❌ Failed (no retry): ${urlId} - ${error}`);
        }
    }

    async getQueueStats() {
        const stats = await this.db.get(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
                COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
            FROM crawler_queue
        `);

        return stats;
    }

    async clearCompleted() {
        const result = await this.db.run(`
            DELETE FROM crawler_queue WHERE status = 'completed'
        `);
        
        console.log(`🧹 Cleared ${result.changes} completed queue items`);
        return result.changes;
    }

    async clearFailed() {
        const result = await this.db.run(`
            DELETE FROM crawler_queue WHERE status = 'failed'
        `);
        
        console.log(`🧹 Cleared ${result.changes} failed queue items`);
        return result.changes;
    }

    async resetProcessing() {
        // Reset any stuck processing items back to pending
        const result = await this.db.run(`
            UPDATE crawler_queue 
            SET status = 'pending' 
            WHERE status = 'processing' 
            AND processed_at < datetime('now', '-1 hour')
        `);
        
        if (result.changes > 0) {
            console.log(`🔄 Reset ${result.changes} stuck processing items`);
        }
        
        return result.changes;
    }

    async getPendingUrls(limit = 10) {
        return await this.db.query(`
            SELECT * FROM crawler_queue 
            WHERE status = 'pending' AND retry_count < ?
            ORDER BY priority DESC, added_at ASC
            LIMIT ?
        `, [this.retryAttempts, limit]);
    }

    async getFailedUrls(limit = 10) {
        return await this.db.query(`
            SELECT * FROM crawler_queue 
            WHERE status = 'failed'
            ORDER BY processed_at DESC
            LIMIT ?
        `, [limit]);
    }

    async retryFailed() {
        const result = await this.db.run(`
            UPDATE crawler_queue 
            SET status = 'pending', retry_count = 0, error_message = NULL
            WHERE status = 'failed'
        `);
        
        console.log(`🔄 Retrying ${result.changes} failed URLs`);
        return result.changes;
    }

    async cleanup() {
        // Don't close shared database connection
        // Only close if we own the connection
        if (this.db && !this.db.isShared) {
            await this.db.close();
        }
    }
}

module.exports = CrawlerQueue;