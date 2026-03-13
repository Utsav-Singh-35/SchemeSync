require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { getDatabase } = require('./database/connection');

// Import routes
const authRoutes = require('./routes/auth');
const schemeRoutes = require('./routes/comprehensive_schemes');
const voiceRoutes = require('./routes/voice');
const familyRoutes = require('./routes/family');
const applicationRoutes = require('./routes/applications');
const automationRoutes = require('./routes/automation');
const userRoutes = require('./routes/user');
const autofillRoutes = require('./routes/autofill');
const navigationRoutes = require('./routes/navigation');

class SchemeSync {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3003;
        this.db = getDatabase();
    }

    async initialize() {
        try {
            // Connect to database
            await this.db.connect();
            console.log('Database connected successfully');

            // Setup middleware
            this.setupMiddleware();

            // Setup routes
            this.setupRoutes();

            // Setup error handling
            this.setupErrorHandling();

            console.log('SchemeSync server initialized successfully');
        } catch (error) {
            console.error('Failed to initialize server:', error);
            process.exit(1);
        }
    }

    setupMiddleware() {
        // Security middleware
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'", "'inline-speculation-rules'", "http://localhost:*", "http://127.0.0.1:*"],
                    imgSrc: ["'self'", "data:", "https:"],
                    connectSrc: ["'self'", "http://localhost:*", "http://127.0.0.1:*"],
                    workerSrc: ["'self'", "blob:"],
                },
            },
        }));

        // CORS configuration
        this.app.use(cors({
            origin: process.env.NODE_ENV === 'production' 
                ? ['https://yourdomain.com', 'http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:5173'] // Allow localhost in production for development
                : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:5173'],
            credentials: true
        }));

        // Rate limiting
        const limiter = rateLimit({
            windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
            max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
            message: {
                success: false,
                message: 'Too many requests, please try again later'
            },
            standardHeaders: true,
            legacyHeaders: false
        });
        this.app.use(limiter);

        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Request logging
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
            next();
        });
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                success: true,
                message: 'SchemeSync API is running',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            });
        });

        // API routes
        this.app.use('/api/auth', authRoutes);
        this.app.use('/api/schemes', schemeRoutes);
        this.app.use('/api/voice', voiceRoutes);
        this.app.use('/api/family', familyRoutes);
        this.app.use('/api/applications', applicationRoutes);
        this.app.use('/api/automation', automationRoutes);
        this.app.use('/api/user', userRoutes);
        this.app.use('/api/autofill', autofillRoutes);
        this.app.use('/api/navigation', navigationRoutes);

        // Admin routes
        this.setupAdminRoutes();

        // 404 handler
        this.app.use('*', (req, res) => {
            res.status(404).json({
                success: false,
                message: 'Endpoint not found'
            });
        });
    }

    setupAdminRoutes() {
        // Crawler management routes
        this.app.get('/api/admin/crawler/status', async (req, res) => {
            try {
                const CrawlerWorker = require('./workers/crawlerWorker');
                const worker = new CrawlerWorker();
                await worker.initialize();
                
                const status = await worker.getStatus();
                await worker.shutdown();
                
                res.json({
                    success: true,
                    data: status
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    message: 'Failed to get crawler status',
                    error: error.message
                });
            }
        });

        this.app.post('/api/admin/crawler/run', async (req, res) => {
            try {
                const { type = 'full' } = req.body;
                
                // Spawn crawler as separate process to avoid blocking API
                const { spawn } = require('child_process');
                const crawlerProcess = spawn('node', ['src/workers/crawlerWorker.js', type], {
                    cwd: __dirname,
                    detached: true,
                    stdio: 'ignore'
                });
                
                crawlerProcess.unref(); // Allow parent to exit independently
                
                res.json({
                    success: true,
                    message: `${type} crawl initiated as background process`,
                    processId: crawlerProcess.pid
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    message: 'Failed to start crawler',
                    error: error.message
                });
            }
        });

        this.app.get('/api/admin/crawler/stats', async (req, res) => {
            try {
                const stats = await this.db.query(`
                    SELECT 
                        COUNT(*) as total_crawls,
                        SUM(schemes_found) as total_schemes_found,
                        MAX(last_crawled) as last_crawl,
                        AVG(schemes_found) as avg_schemes_per_crawl
                    FROM crawler_sources
                    WHERE last_crawled IS NOT NULL
                `);

                const recentCrawls = await this.db.query(`
                    SELECT source_url, last_crawled, schemes_found, source_type
                    FROM crawler_sources
                    WHERE last_crawled IS NOT NULL
                    ORDER BY last_crawled DESC
                    LIMIT 10
                `);

                res.json({
                    success: true,
                    data: {
                        summary: stats[0] || {},
                        recent_crawls: recentCrawls
                    }
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    message: 'Failed to get crawler stats'
                });
            }
        });

        this.app.get('/api/admin/crawler/sources', async (req, res) => {
            try {
                const sources = await this.db.query(`
                    SELECT source_url, source_type, last_crawled, schemes_found, is_active
                    FROM crawler_sources
                    ORDER BY source_type, last_crawled DESC
                `);
                
                res.json({
                    success: true,
                    data: sources
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    message: 'Failed to get crawler sources'
                });
            }
        });

        // Database statistics
        this.app.get('/api/admin/stats', async (req, res) => {
            try {
                const stats = await this.db.query(`
                    SELECT 
                        (SELECT COUNT(*) FROM schemes WHERE is_active = 1) as active_schemes,
                        (SELECT COUNT(*) FROM users) as total_users,
                        (SELECT COUNT(*) FROM applications) as total_applications,
                        (SELECT COUNT(DISTINCT category) FROM schemes WHERE category IS NOT NULL) as categories
                `);

                const recentSchemes = await this.db.query(`
                    SELECT scheme_name, ministry, created_at
                    FROM schemes 
                    WHERE is_active = 1
                    ORDER BY created_at DESC 
                    LIMIT 5
                `);

                res.json({
                    success: true,
                    data: {
                        summary: stats[0],
                        recent_schemes: recentSchemes
                    }
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    message: 'Failed to get database stats'
                });
            }
        });
    }

    setupErrorHandling() {
        // Global error handler
        this.app.use((error, req, res, next) => {
            console.error('Unhandled error:', error);
            
            res.status(500).json({
                success: false,
                message: process.env.NODE_ENV === 'production' 
                    ? 'Internal server error' 
                    : error.message
            });
        });

        // Graceful shutdown
        process.on('SIGTERM', this.gracefulShutdown.bind(this));
        process.on('SIGINT', this.gracefulShutdown.bind(this));
    }

    async gracefulShutdown(signal) {
        console.log(`Received ${signal}. Starting graceful shutdown...`);
        
        try {
            // Close database connection
            await this.db.close();
            console.log('Database connection closed');
            
            // Close server
            this.server.close(() => {
                console.log('Server closed');
                process.exit(0);
            });
        } catch (error) {
            console.error('Error during shutdown:', error);
            process.exit(1);
        }
    }

    async start() {
        try {
            await this.initialize();
            
            this.server = this.app.listen(this.port, () => {
                console.log(`
╔══════════════════════════════════════════════════════════════╗
║                        SchemeSync API                        ║
║                                                              ║
║  🚀 Server running on port ${this.port}                            ║
║  🌐 Environment: ${process.env.NODE_ENV || 'development'}                      ║
║  📊 Health check: http://localhost:${this.port}/health            ║
║  📚 API Base: http://localhost:${this.port}/api                   ║
║                                                              ║
║  Government Welfare Scheme Discovery Platform                ║
║  Built by DeadCode Labs                                      ║
╚══════════════════════════════════════════════════════════════╝
                `);
            });
        } catch (error) {
            console.error('Failed to start server:', error);
            process.exit(1);
        }
    }
}

// Start server if this file is run directly
if (require.main === module) {
    const server = new SchemeSync();
    server.start();
}

module.exports = SchemeSync;