const cron = require('node-cron');
const PortalCrawler = require('./portalCrawler');
const PDFCrawler = require('./pdfCrawler');
const { getDatabase } = require('../database/connection');

class CrawlerOrchestrator {
    constructor() {
        this.db = getDatabase();
        this.isRunning = false;
        this.crawlerEnabled = process.env.CRAWLER_ENABLED === 'true';
        this.crawlerInterval = process.env.CRAWLER_INTERVAL_HOURS || 6;
        this.maxConcurrentCrawlers = parseInt(process.env.MAX_CONCURRENT_CRAWLERS) || 1;
    }

    async initialize() {
        try {
            await this.db.connect();
            console.log('Crawler orchestrator initialized');
            
            if (this.crawlerEnabled) {
                this.scheduleCrawlers();
                console.log(`Crawlers scheduled to run every ${this.crawlerInterval} hours`);
            } else {
                console.log('Crawlers are disabled via environment configuration');
            }
        } catch (error) {
            console.error('Failed to initialize crawler orchestrator:', error);
            throw error;
        }
    }

    scheduleCrawlers() {
        // Schedule crawlers to run every N hours
        const cronExpression = `0 */${this.crawlerInterval} * * *`;
        
        cron.schedule(cronExpression, async () => {
            if (!this.isRunning) {
                console.log('Starting scheduled crawl...');
                await this.runFullCrawl();
            } else {
                console.log('Crawl already in progress, skipping scheduled run');
            }
        });

        console.log(`Crawlers scheduled with cron expression: ${cronExpression}`);
    }

    async runFullCrawl() {
        if (this.isRunning) {
            console.log('Crawl already in progress');
            return;
        }

        this.isRunning = true;
        const startTime = Date.now();
        
        try {
            console.log('=== Starting Full Scheme Crawl ===');
            
            let totalSchemes = 0;
            
            // Run portal crawler
            console.log('Phase 1: Portal Crawling');
            const portalCrawler = new PortalCrawler();
            const portalSchemes = await portalCrawler.crawlAllSources();
            totalSchemes += portalSchemes;
            
            // Run PDF crawler
            console.log('Phase 2: PDF Crawling');
            const pdfCrawler = new PDFCrawler();
            const pdfSchemes = await pdfCrawler.crawlPDFSchemes();
            totalSchemes += pdfSchemes;
            
            // Update crawl statistics
            await this.updateCrawlStats(totalSchemes);
            
            const duration = (Date.now() - startTime) / 1000;
            console.log(`=== Crawl Completed ===`);
            console.log(`Total schemes processed: ${totalSchemes}`);
            console.log(`Duration: ${duration.toFixed(2)} seconds`);
            
        } catch (error) {
            console.error('Error during full crawl:', error);
        } finally {
            this.isRunning = false;
        }
    }

    async runPortalCrawlOnly() {
        if (this.isRunning) {
            console.log('Crawl already in progress');
            return;
        }

        this.isRunning = true;
        
        try {
            console.log('=== Starting Portal Crawl Only ===');
            
            const portalCrawler = new PortalCrawler();
            const totalSchemes = await portalCrawler.crawlAllSources();
            
            await this.updateCrawlStats(totalSchemes);
            
            console.log(`Portal crawl completed. Schemes processed: ${totalSchemes}`);
            return totalSchemes;
            
        } catch (error) {
            console.error('Error during portal crawl:', error);
            return 0;
        } finally {
            this.isRunning = false;
        }
    }

    async runPDFCrawlOnly() {
        if (this.isRunning) {
            console.log('Crawl already in progress');
            return;
        }

        this.isRunning = true;
        
        try {
            console.log('=== Starting PDF Crawl Only ===');
            
            const pdfCrawler = new PDFCrawler();
            const totalSchemes = await pdfCrawler.crawlPDFSchemes();
            
            await this.updateCrawlStats(totalSchemes);
            
            console.log(`PDF crawl completed. Schemes processed: ${totalSchemes}`);
            return totalSchemes;
            
        } catch (error) {
            console.error('Error during PDF crawl:', error);
            return 0;
        } finally {
            this.isRunning = false;
        }
    }

    async updateCrawlStats(schemesFound) {
        try {
            // Create or update crawl statistics table
            await this.db.run(`
                CREATE TABLE IF NOT EXISTS crawl_stats (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    crawl_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                    schemes_found INTEGER,
                    crawl_type TEXT DEFAULT 'full'
                )
            `);

            await this.db.run(`
                INSERT INTO crawl_stats (schemes_found, crawl_type)
                VALUES (?, 'full')
            `, [schemesFound]);

        } catch (error) {
            console.error('Error updating crawl stats:', error);
        }
    }

    async getCrawlStats() {
        try {
            const stats = await this.db.query(`
                SELECT 
                    COUNT(*) as total_crawls,
                    SUM(schemes_found) as total_schemes_found,
                    MAX(crawl_date) as last_crawl,
                    AVG(schemes_found) as avg_schemes_per_crawl
                FROM crawl_stats
            `);

            const recentCrawls = await this.db.query(`
                SELECT crawl_date, schemes_found, crawl_type
                FROM crawl_stats
                ORDER BY crawl_date DESC
                LIMIT 10
            `);

            return {
                summary: stats[0] || {},
                recent_crawls: recentCrawls
            };
        } catch (error) {
            console.error('Error getting crawl stats:', error);
            return { summary: {}, recent_crawls: [] };
        }
    }

    async getActiveSources() {
        try {
            return await this.db.query(`
                SELECT source_url, source_type, last_crawled, schemes_found
                FROM crawler_sources
                WHERE is_active = 1
                ORDER BY source_type, last_crawled DESC
            `);
        } catch (error) {
            console.error('Error getting active sources:', error);
            return [];
        }
    }

    async addCrawlerSource(url, type) {
        try {
            await this.db.run(`
                INSERT OR IGNORE INTO crawler_sources (source_url, source_type, is_active)
                VALUES (?, ?, 1)
            `, [url, type]);
            
            console.log(`Added crawler source: ${url} (${type})`);
            return true;
        } catch (error) {
            console.error('Error adding crawler source:', error);
            return false;
        }
    }

    async disableCrawlerSource(url) {
        try {
            const result = await this.db.run(`
                UPDATE crawler_sources SET is_active = 0 WHERE source_url = ?
            `, [url]);
            
            return result.changes > 0;
        } catch (error) {
            console.error('Error disabling crawler source:', error);
            return false;
        }
    }

    getStatus() {
        return {
            isRunning: this.isRunning,
            crawlerEnabled: this.crawlerEnabled,
            crawlerInterval: this.crawlerInterval
        };
    }
}

// CLI interface for manual crawling
if (require.main === module) {
    require('dotenv').config();
    
    const orchestrator = new CrawlerOrchestrator();
    
    const command = process.argv[2];
    
    async function runCommand() {
        try {
            await orchestrator.initialize();
            
            switch (command) {
                case 'full':
                    await orchestrator.runFullCrawl();
                    break;
                case 'portal':
                    await orchestrator.runPortalCrawlOnly();
                    break;
                case 'pdf':
                    await orchestrator.runPDFCrawlOnly();
                    break;
                case 'stats':
                    const stats = await orchestrator.getCrawlStats();
                    console.log('Crawl Statistics:', JSON.stringify(stats, null, 2));
                    break;
                case 'sources':
                    const sources = await orchestrator.getActiveSources();
                    console.log('Active Sources:', JSON.stringify(sources, null, 2));
                    break;
                default:
                    console.log('Usage: node crawler.js [full|portal|pdf|stats|sources]');
                    console.log('  full    - Run complete crawl (portal + PDF)');
                    console.log('  portal  - Run portal crawl only');
                    console.log('  pdf     - Run PDF crawl only');
                    console.log('  stats   - Show crawl statistics');
                    console.log('  sources - Show active crawler sources');
            }
        } catch (error) {
            console.error('Command failed:', error);
        } finally {
            await orchestrator.db.close();
            process.exit(0);
        }
    }
    
    runCommand();
}

module.exports = CrawlerOrchestrator;