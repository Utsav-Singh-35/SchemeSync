const CrawlerOrchestrator = require('../agents/crawler');
const { getDatabase } = require('../database/connection');

class CrawlerWorker {
    constructor() {
        this.db = getDatabase();
        this.orchestrator = new CrawlerOrchestrator();
        this.isRunning = false;
    }

    async initialize() {
        try {
            await this.db.connect();
            await this.orchestrator.initialize();
            console.log('Crawler worker initialized');
        } catch (error) {
            console.error('Failed to initialize crawler worker:', error);
            throw error;
        }
    }

    async startCrawling(type = 'full') {
        if (this.isRunning) {
            console.log('Crawler already running');
            return { success: false, message: 'Crawler already running' };
        }

        this.isRunning = true;
        
        try {
            let result;
            switch (type) {
                case 'portal':
                    result = await this.orchestrator.runPortalCrawlOnly();
                    break;
                case 'pdf':
                    result = await this.orchestrator.runPDFCrawlOnly();
                    break;
                default:
                    result = await this.orchestrator.runFullCrawl();
            }

            return {
                success: true,
                message: `${type} crawl completed`,
                schemesProcessed: result
            };
        } catch (error) {
            console.error('Crawler error:', error);
            return {
                success: false,
                message: 'Crawler failed',
                error: error.message
            };
        } finally {
            this.isRunning = false;
        }
    }

    async getStatus() {
        return {
            isRunning: this.isRunning,
            lastRun: await this.getLastCrawlTime(),
            totalSchemes: await this.getTotalSchemes()
        };
    }

    async getLastCrawlTime() {
        try {
            const result = await this.db.get(`
                SELECT MAX(last_crawled) as last_crawl 
                FROM crawler_sources 
                WHERE last_crawled IS NOT NULL
            `);
            return result?.last_crawl || null;
        } catch (error) {
            console.error('Error getting last crawl time:', error);
            return null;
        }
    }

    async getTotalSchemes() {
        try {
            const result = await this.db.get(`
                SELECT COUNT(*) as total FROM schemes WHERE is_active = 1
            `);
            return result?.total || 0;
        } catch (error) {
            console.error('Error getting total schemes:', error);
            return 0;
        }
    }

    async shutdown() {
        try {
            await this.db.close();
            console.log('Crawler worker shutdown complete');
        } catch (error) {
            console.error('Error during crawler worker shutdown:', error);
        }
    }
}

// Run as standalone worker if called directly
if (require.main === module) {
    require('dotenv').config();
    
    const worker = new CrawlerWorker();
    
    async function runWorker() {
        try {
            await worker.initialize();
            
            const type = process.argv[2] || 'full';
            console.log(`Starting ${type} crawl...`);
            
            const result = await worker.startCrawling(type);
            console.log('Crawl result:', result);
            
        } catch (error) {
            console.error('Worker failed:', error);
        } finally {
            await worker.shutdown();
            process.exit(0);
        }
    }
    
    runWorker();
}

module.exports = CrawlerWorker;