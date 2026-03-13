const fs = require('fs').promises;
const path = require('path');
const { getDatabase } = require('../database/connection');

class DiscoveryMonitor {
    constructor() {
        this.db = getDatabase();
        this.logDir = path.join(__dirname, '../../logs');
        this.metricsFile = path.join(this.logDir, 'discovery-metrics.json');
        this.errorLogFile = path.join(this.logDir, 'discovery-errors.log');
        
        this.metrics = {
            session_id: this.generateSessionId(),
            start_time: new Date().toISOString(),
            end_time: null,
            portals_crawled: 0,
            urls_discovered: 0,
            schemes_extracted: 0,
            duplicates_prevented: 0,
            errors: [],
            performance: {
                avg_request_time: 0,
                total_requests: 0,
                failed_requests: 0,
                blocked_requests: 0
            },
            sources: {
                datasets: 0,
                central_portals: 0,
                ministry_portals: 0,
                state_portals: 0,
                specialized_portals: 0
            }
        };
    }

    async initialize() {
        await this.ensureLogDirectory();
        await this.db.connect();
        console.log(`📊 Discovery Monitor initialized - Session: ${this.metrics.session_id}`);
    }

    async ensureLogDirectory() {
        try {
            await fs.access(this.logDir);
        } catch {
            await fs.mkdir(this.logDir, { recursive: true });
        }
    }

    generateSessionId() {
        return `discovery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    logPortalCrawled(portalName, portalType, urlsFound) {
        this.metrics.portals_crawled++;
        this.metrics.urls_discovered += urlsFound;
        this.metrics.sources[`${portalType}_portals`] = (this.metrics.sources[`${portalType}_portals`] || 0) + 1;
        
        console.log(`📊 Portal crawled: ${portalName} (${portalType}) - ${urlsFound} URLs`);
    }

    logSchemeExtracted(schemeName, source, isDuplicate = false) {
        if (isDuplicate) {
            this.metrics.duplicates_prevented++;
            console.log(`🔄 Duplicate prevented: ${schemeName}`);
        } else {
            this.metrics.schemes_extracted++;
            console.log(`✅ Scheme extracted: ${schemeName} from ${source}`);
        }
    }

    logRequest(url, duration, success, error = null) {
        this.metrics.performance.total_requests++;
        
        if (success) {
            // Update average request time
            const currentAvg = this.metrics.performance.avg_request_time;
            const totalRequests = this.metrics.performance.total_requests;
            this.metrics.performance.avg_request_time = 
                ((currentAvg * (totalRequests - 1)) + duration) / totalRequests;
        } else {
            this.metrics.performance.failed_requests++;
            
            if (error && error.includes('blocked')) {
                this.metrics.performance.blocked_requests++;
            }
            
            this.logError(url, error);
        }
    }

    logError(context, error, severity = 'error') {
        const errorEntry = {
            timestamp: new Date().toISOString(),
            context: context,
            error: error,
            severity: severity,
            session_id: this.metrics.session_id
        };
        
        this.metrics.errors.push(errorEntry);
        
        console.error(`❌ ${severity.toUpperCase()}: ${context} - ${error}`);
        
        // Write to error log file
        this.writeErrorLog(errorEntry);
    }

    async writeErrorLog(errorEntry) {
        try {
            const logLine = `[${errorEntry.timestamp}] ${errorEntry.severity.toUpperCase()}: ${errorEntry.context} - ${errorEntry.error}\n`;
            await fs.appendFile(this.errorLogFile, logLine);
        } catch (err) {
            console.error('Failed to write error log:', err.message);
        }
    }

    async getDatabaseStats() {
        try {
            const totalSchemes = await this.db.get('SELECT COUNT(*) as count FROM schemes');
            
            const schemesByCategory = await this.db.query(`
                SELECT category, COUNT(*) as count 
                FROM schemes 
                GROUP BY category 
                ORDER BY count DESC
            `);
            
            const recentSchemes = await this.db.query(`
                SELECT COUNT(*) as count 
                FROM schemes 
                WHERE created_at >= datetime('now', '-1 day')
            `);
            
            const schemesBySource = await this.db.query(`
                SELECT 
                    CASE 
                        WHEN parser_used IS NOT NULL THEN parser_used
                        WHEN dataset_source IS NOT NULL THEN 'Dataset'
                        ELSE 'Unknown'
                    END as source,
                    COUNT(*) as count
                FROM schemes 
                GROUP BY source
                ORDER BY count DESC
            `);
            
            return {
                total_schemes: totalSchemes.count,
                schemes_today: recentSchemes[0]?.count || 0,
                by_category: schemesByCategory,
                by_source: schemesBySource
            };
            
        } catch (error) {
            this.logError('Database stats', error.message);
            return null;
        }
    }

    async generateDailyReport() {
        console.log('📊 Generating daily discovery report...');
        
        const dbStats = await this.getDatabaseStats();
        this.metrics.end_time = new Date().toISOString();
        
        const report = {
            session: this.metrics,
            database: dbStats,
            summary: {
                success_rate: this.calculateSuccessRate(),
                error_rate: this.calculateErrorRate(),
                duplicate_rate: this.calculateDuplicateRate(),
                avg_schemes_per_portal: this.calculateAvgSchemesPerPortal(),
                performance_score: this.calculatePerformanceScore()
            },
            recommendations: this.generateRecommendations()
        };
        
        // Save metrics to file
        await this.saveMetrics(report);
        
        console.log('📋 Daily report generated');
        return report;
    }

    calculateSuccessRate() {
        if (this.metrics.performance.total_requests === 0) return 0;
        const successful = this.metrics.performance.total_requests - this.metrics.performance.failed_requests;
        return Math.round((successful / this.metrics.performance.total_requests) * 100);
    }

    calculateErrorRate() {
        if (this.metrics.performance.total_requests === 0) return 0;
        return Math.round((this.metrics.performance.failed_requests / this.metrics.performance.total_requests) * 100);
    }

    calculateDuplicateRate() {
        const totalProcessed = this.metrics.schemes_extracted + this.metrics.duplicates_prevented;
        if (totalProcessed === 0) return 0;
        return Math.round((this.metrics.duplicates_prevented / totalProcessed) * 100);
    }

    calculateAvgSchemesPerPortal() {
        if (this.metrics.portals_crawled === 0) return 0;
        return Math.round(this.metrics.schemes_extracted / this.metrics.portals_crawled);
    }

    calculatePerformanceScore() {
        const successRate = this.calculateSuccessRate();
        const avgRequestTime = this.metrics.performance.avg_request_time;
        const blockedRate = this.metrics.performance.total_requests > 0 ? 
            (this.metrics.performance.blocked_requests / this.metrics.performance.total_requests) * 100 : 0;
        
        // Performance score based on success rate, speed, and blocking
        let score = successRate;
        
        // Penalty for slow requests (>5 seconds)
        if (avgRequestTime > 5000) {
            score -= Math.min(20, (avgRequestTime - 5000) / 1000);
        }
        
        // Penalty for blocked requests
        score -= blockedRate * 2;
        
        return Math.max(0, Math.round(score));
    }

    generateRecommendations() {
        const recommendations = [];
        
        // Success rate recommendations
        const successRate = this.calculateSuccessRate();
        if (successRate < 70) {
            recommendations.push({
                type: 'performance',
                priority: 'high',
                message: `Low success rate (${successRate}%). Consider increasing request delays or improving parser logic.`
            });
        }
        
        // Blocking recommendations
        const blockedRate = this.metrics.performance.total_requests > 0 ? 
            (this.metrics.performance.blocked_requests / this.metrics.performance.total_requests) * 100 : 0;
        if (blockedRate > 10) {
            recommendations.push({
                type: 'blocking',
                priority: 'high',
                message: `High blocking rate (${blockedRate.toFixed(1)}%). Increase delays and rotate user agents more frequently.`
            });
        }
        
        // Duplicate rate recommendations
        const duplicateRate = this.calculateDuplicateRate();
        if (duplicateRate > 50) {
            recommendations.push({
                type: 'efficiency',
                priority: 'medium',
                message: `High duplicate rate (${duplicateRate}%). Consider improving source selection or deduplication logic.`
            });
        }
        
        // Performance recommendations
        if (this.metrics.performance.avg_request_time > 10000) {
            recommendations.push({
                type: 'performance',
                priority: 'medium',
                message: `Slow average request time (${(this.metrics.performance.avg_request_time/1000).toFixed(1)}s). Consider optimizing network settings.`
            });
        }
        
        // Coverage recommendations
        if (this.metrics.schemes_extracted < 50) {
            recommendations.push({
                type: 'coverage',
                priority: 'low',
                message: 'Low scheme extraction count. Consider adding more portal sources or improving extraction logic.'
            });
        }
        
        return recommendations;
    }

    async saveMetrics(report) {
        try {
            await fs.writeFile(this.metricsFile, JSON.stringify(report, null, 2));
            console.log(`📊 Metrics saved to: ${this.metricsFile}`);
        } catch (error) {
            console.error('Failed to save metrics:', error.message);
        }
    }

    async getHistoricalMetrics(days = 7) {
        try {
            const files = await fs.readdir(this.logDir);
            const metricFiles = files.filter(f => f.startsWith('discovery-metrics-'));
            
            const historicalData = [];
            
            for (const file of metricFiles.slice(-days)) {
                try {
                    const content = await fs.readFile(path.join(this.logDir, file), 'utf8');
                    const data = JSON.parse(content);
                    historicalData.push(data);
                } catch (err) {
                    console.error(`Failed to read ${file}:`, err.message);
                }
            }
            
            return historicalData;
        } catch (error) {
            console.error('Failed to get historical metrics:', error.message);
            return [];
        }
    }

    async cleanup() {
        // Save final metrics
        await this.generateDailyReport();
        await this.db.close();
        console.log('📊 Discovery Monitor cleanup completed');
    }
}

module.exports = DiscoveryMonitor;