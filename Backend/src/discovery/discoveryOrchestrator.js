const DatasetIngester = require('./datasetIngester');
const AntiBlockingCrawler = require('./antiBlockingCrawler');
const CrawlerQueue = require('./crawlerQueue');
const DeduplicationLayer = require('./deduplicationLayer');
const { getDatabase } = require('../database/connection');

// Import parsers
const IndiaGovParser = require('./parsers/indiaGovParser');
const MinistryParser = require('./parsers/ministryParser');
const StatePortalParser = require('./parsers/statePortalParser');

class DiscoveryOrchestrator {
    constructor() {
        this.db = getDatabase();
        
        // Pass shared database connection to all components
        this.datasetIngester = new DatasetIngester(this.db);
        this.crawler = new AntiBlockingCrawler(this.db);
        this.queue = new CrawlerQueue(this.db);
        this.deduplicator = new DeduplicationLayer(this.db);
        
        // Initialize parsers
        this.parsers = [
            new IndiaGovParser(),
            new MinistryParser(),
            new StatePortalParser()
        ];
        
        this.stats = {
            datasetsProcessed: 0,
            urlsDiscovered: 0,
            schemesExtracted: 0,
            duplicatesFound: 0,
            errors: 0,
            startTime: null,
            endTime: null
        };
    }

    async initialize() {
        console.log('🚀 Initializing Discovery Orchestrator...');
        
        // Ensure single database connection for all components
        await this.db.connect();
        
        // Initialize components without additional database connections
        await this.datasetIngester.initialize();
        await this.crawler.initialize();
        await this.queue.initialize();
        await this.deduplicator.initialize();
        
        this.stats.startTime = new Date();
        console.log('✅ Discovery Orchestrator initialized');
    }

    async runFullDiscovery() {
        console.log('🔍 Starting full multi-source discovery...');
        
        try {
            // Step 1: Dataset ingestion (highest priority)
            await this.runDatasetIngestion();
            
            // Step 2: Portal URL discovery
            await this.runPortalDiscovery();
            
            // Step 3: Process crawler queue
            await this.processCrawlerQueue();
            
            // Step 4: Generate final report
            const report = await this.generateDiscoveryReport();
            
            this.stats.endTime = new Date();
            console.log('✅ Full discovery completed');
            
            return report;
            
        } catch (error) {
            console.error('❌ Discovery orchestration failed:', error.message);
            this.stats.errors++;
            throw error;
        }
    }

    async runDatasetIngestion() {
        console.log('📊 Phase 1: Dataset Ingestion');
        
        try {
            const datasets = await this.datasetIngester.discoverSchemeDatasets();
            console.log(`Found ${datasets.length} potential datasets`);
            
            for (const dataset of datasets) {
                try {
                    const ingestedCount = await this.datasetIngester.ingestDataset(dataset);
                    this.stats.schemesExtracted += ingestedCount;
                    this.stats.datasetsProcessed++;
                    
                    // Add delay between datasets
                    await this.randomDelay(3000, 5000);
                } catch (error) {
                    console.error(`Dataset ingestion failed: ${error.message}`);
                    this.stats.errors++;
                }
            }
            
            console.log(`✅ Dataset ingestion completed: ${this.stats.datasetsProcessed} datasets, ${this.stats.schemesExtracted} schemes`);
            
        } catch (error) {
            console.error('❌ Dataset ingestion phase failed:', error.message);
            this.stats.errors++;
        }
    }

    async runPortalDiscovery() {
        console.log('🌐 Phase 2: Portal URL Discovery');
        
        try {
            const portalRegistry = require('./portalRegistry.json');
            const allPortals = [
                ...portalRegistry.central_portals,
                ...portalRegistry.ministry_portals,
                ...portalRegistry.state_portals,
                ...portalRegistry.specialized_portals
            ];
            
            console.log(`Discovering URLs from ${allPortals.length} portals`);
            
            for (const portal of allPortals) {
                try {
                    console.log(`🔍 Discovering from: ${portal.name}`);
                    
                    const discoveredUrls = await this.crawler.discoverSchemeUrls(
                        portal.portal_url,
                        portal.selectors || []
                    );
                    
                    if (discoveredUrls.length > 0) {
                        const addedCount = await this.queue.addUrls(discoveredUrls, {
                            priority: this.getPortalPriority(portal.type),
                            portalType: portal.type,
                            parserType: portal.parser_type,
                            metadata: {
                                portalName: portal.name,
                                ministry: portal.ministry,
                                state: portal.state,
                                category: portal.category
                            }
                        });
                        
                        this.stats.urlsDiscovered += addedCount;
                        console.log(`📋 Added ${addedCount} URLs to queue from ${portal.name}`);
                    }
                    
                    // Respect crawl delays
                    await this.randomDelay(5000, 8000);
                    
                } catch (error) {
                    console.error(`Portal discovery failed for ${portal.name}: ${error.message}`);
                    this.stats.errors++;
                }
            }
            
            console.log(`✅ Portal discovery completed: ${this.stats.urlsDiscovered} URLs discovered`);
            
        } catch (error) {
            console.error('❌ Portal discovery phase failed:', error.message);
            this.stats.errors++;
        }
    }

    async processCrawlerQueue() {
        console.log('⚙️ Phase 3: Processing Crawler Queue');
        
        try {
            const queueStats = await this.queue.getQueueStats();
            console.log(`Processing ${queueStats.pending} URLs from queue`);
            
            let processedCount = 0;
            const maxProcessing = 100; // Limit for this session
            
            while (processedCount < maxProcessing) {
                const urlItem = await this.queue.getNextUrl();
                
                if (!urlItem) {
                    console.log('No more URLs to process');
                    break;
                }
                
                try {
                    const schemeData = await this.extractSchemeWithParser(
                        urlItem.url,
                        urlItem.parser_type,
                        JSON.parse(urlItem.metadata || '{}')
                    );
                    
                    if (schemeData) {
                        const schemeId = await this.saveSchemeWithDeduplication(schemeData);
                        
                        if (schemeId) {
                            this.stats.schemesExtracted++;
                            await this.queue.markCompleted(urlItem.id, { url: urlItem.url });
                        } else {
                            await this.queue.markFailed(urlItem.id, 'Failed to save scheme', false);
                        }
                    } else {
                        await this.queue.markFailed(urlItem.id, 'No scheme data extracted', true);
                    }
                    
                } catch (error) {
                    console.error(`Processing failed for ${urlItem.url}: ${error.message}`);
                    await this.queue.markFailed(urlItem.id, error.message, true);
                    this.stats.errors++;
                }
                
                processedCount++;
                
                // Add delay between requests
                await this.randomDelay(2000, 4000);
            }
            
            console.log(`✅ Queue processing completed: ${processedCount} URLs processed`);
            
        } catch (error) {
            console.error('❌ Queue processing phase failed:', error.message);
            this.stats.errors++;
        }
    }

    async extractSchemeWithParser(url, parserType, metadata) {
        // Find appropriate parser
        const parser = this.parsers.find(p => p.canParse(url));
        
        if (parser) {
            console.log(`🔧 Using ${parser.name} for ${url}`);
            return await this.crawler.extractSchemeData(url, parser);
        } else {
            console.log(`🔧 Using default extraction for ${url}`);
            return await this.crawler.extractSchemeData(url);
        }
    }

    async saveSchemeWithDeduplication(schemeData) {
        try {
            // Check for duplicates
            const duplicateMatch = await this.deduplicator.checkDuplicate(schemeData);
            
            if (duplicateMatch) {
                this.stats.duplicatesFound++;
                return await this.deduplicator.mergeSchemes(schemeData, duplicateMatch);
            } else {
                // Save new scheme
                const result = await this.db.run(`
                    INSERT INTO schemes (
                        scheme_name, ministry, description, benefits, eligibility_text,
                        required_documents, application_process, category, application_mode,
                        official_url, parser_used, extracted_at, is_active
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
                `, [
                    schemeData.scheme_name,
                    schemeData.ministry,
                    schemeData.description,
                    schemeData.benefits,
                    schemeData.eligibility_text,
                    schemeData.required_documents,
                    schemeData.application_process,
                    schemeData.category,
                    schemeData.application_mode,
                    schemeData.official_url,
                    schemeData.parser_used,
                    schemeData.extracted_at
                ]);
                
                console.log(`✅ Saved new scheme: ${schemeData.scheme_name}`);
                return result.id;
            }
            
        } catch (error) {
            console.error('Error saving scheme:', error.message);
            return null;
        }
    }

    getPortalPriority(portalType) {
        const priorities = {
            'dataset': 5,      // Highest priority
            'central': 4,
            'ministry': 3,
            'specialized': 2,
            'state': 1         // Lowest priority
        };
        
        return priorities[portalType] || 1;
    }

    async generateDiscoveryReport() {
        console.log('📊 Generating discovery report...');
        
        const queueStats = await this.queue.getQueueStats();
        const deduplicationStats = await this.deduplicator.getDeduplicationStats();
        
        const totalSchemes = await this.db.get('SELECT COUNT(*) as count FROM schemes');
        const schemesByCategory = await this.db.query(`
            SELECT category, COUNT(*) as count 
            FROM schemes 
            GROUP BY category 
            ORDER BY count DESC
        `);
        
        const schemesByMinistry = await this.db.query(`
            SELECT ministry, COUNT(*) as count 
            FROM schemes 
            WHERE ministry IS NOT NULL
            GROUP BY ministry 
            ORDER BY count DESC
            LIMIT 10
        `);
        
        const duration = this.stats.endTime ? 
            Math.round((this.stats.endTime - this.stats.startTime) / 1000) : 0;
        
        const report = {
            summary: {
                total_runtime_seconds: duration,
                datasets_processed: this.stats.datasetsProcessed,
                urls_discovered: this.stats.urlsDiscovered,
                schemes_extracted: this.stats.schemesExtracted,
                duplicates_found: this.stats.duplicatesFound,
                errors_encountered: this.stats.errors,
                total_schemes_in_db: totalSchemes.count
            },
            queue_status: queueStats,
            deduplication: deduplicationStats,
            scheme_distribution: {
                by_category: schemesByCategory,
                by_ministry: schemesByMinistry
            },
            performance_metrics: {
                schemes_per_minute: duration > 0 ? Math.round((this.stats.schemesExtracted / duration) * 60) : 0,
                success_rate: this.stats.urlsDiscovered > 0 ? 
                    Math.round((this.stats.schemesExtracted / this.stats.urlsDiscovered) * 100) : 0,
                error_rate: this.stats.urlsDiscovered > 0 ? 
                    Math.round((this.stats.errors / this.stats.urlsDiscovered) * 100) : 0
            }
        };
        
        console.log('📋 Discovery Report Generated');
        console.log(`Total Schemes: ${report.summary.total_schemes_in_db}`);
        console.log(`Success Rate: ${report.performance_metrics.success_rate}%`);
        console.log(`Deduplication Rate: ${report.deduplication.deduplication_rate}%`);
        
        return report;
    }

    async randomDelay(min = 1000, max = 3000) {
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    async cleanup() {
        // Close child components first, then database
        const cleanupPromises = [];
        
        if (this.datasetIngester) {
            cleanupPromises.push(this.datasetIngester.cleanup());
        }
        if (this.crawler) {
            cleanupPromises.push(this.crawler.cleanup());
        }
        if (this.queue) {
            cleanupPromises.push(this.queue.cleanup());
        }
        if (this.deduplicator) {
            cleanupPromises.push(this.deduplicator.cleanup());
        }
        
        // Wait for all child cleanups to complete
        await Promise.all(cleanupPromises);
        
        // Only then close the database
        if (this.db) {
            await this.db.close();
        }
    }
}

module.exports = DiscoveryOrchestrator;