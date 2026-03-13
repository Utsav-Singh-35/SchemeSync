const express = require('express');
const { getDatabase } = require('../database/connection');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const db = getDatabase();

// Log autofill attempt
router.post('/log', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const {
            portal,
            url,
            fields_detected,
            fields_filled,
            documents_uploaded,
            missing_fields,
            errors,
            success,
            timestamp
        } = req.body;

        // Insert autofill log
        const result = await db.run(`
            INSERT INTO autofill_logs (
                user_id, portal, url, fields_detected, fields_filled,
                documents_uploaded, missing_fields, errors, success,
                timestamp, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            userId, portal, url, fields_detected || 0, fields_filled || 0,
            documents_uploaded || 0, missing_fields || 0, errors || 0,
            success || false, timestamp || new Date().toISOString(),
            new Date().toISOString()
        ]);

        res.json({
            success: true,
            message: 'Autofill attempt logged successfully',
            data: {
                logId: result.id,
                userId: userId,
                portal: portal
            }
        });
    } catch (error) {
        console.error('Autofill logging error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to log autofill attempt'
        });
    }
});

// Get autofill history for user
router.get('/history', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { limit = 50, offset = 0, portal } = req.query;

        let query = `
            SELECT id, portal, url, fields_detected, fields_filled,
                   documents_uploaded, missing_fields, errors, success,
                   timestamp, created_at
            FROM autofill_logs
            WHERE user_id = ?
        `;
        
        const params = [userId];

        if (portal) {
            query += ' AND portal = ?';
            params.push(portal);
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const logs = await db.query(query, params);

        // Get total count
        let countQuery = 'SELECT COUNT(*) as total FROM autofill_logs WHERE user_id = ?';
        const countParams = [userId];
        
        if (portal) {
            countQuery += ' AND portal = ?';
            countParams.push(portal);
        }

        const totalResult = await db.get(countQuery, countParams);

        res.json({
            success: true,
            data: {
                logs: logs,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    total: totalResult.total,
                    hasMore: offset + logs.length < totalResult.total
                }
            }
        });
    } catch (error) {
        console.error('Get autofill history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch autofill history'
        });
    }
});

// Get autofill statistics
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;

        // Get overall stats
        const overallStats = await db.get(`
            SELECT 
                COUNT(*) as total_attempts,
                SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_attempts,
                SUM(fields_filled) as total_fields_filled,
                COUNT(DISTINCT portal) as unique_portals,
                AVG(fields_filled * 1.0 / NULLIF(fields_detected, 0)) as avg_fill_rate
            FROM autofill_logs
            WHERE user_id = ?
        `, [userId]);

        // Get portal-wise stats
        const portalStats = await db.query(`
            SELECT 
                portal,
                COUNT(*) as attempts,
                SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
                AVG(fields_filled * 1.0 / NULLIF(fields_detected, 0)) as avg_fill_rate,
                MAX(created_at) as last_used
            FROM autofill_logs
            WHERE user_id = ?
            GROUP BY portal
            ORDER BY attempts DESC
            LIMIT 10
        `, [userId]);

        // Get recent activity (last 30 days)
        const recentActivity = await db.query(`
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as attempts,
                SUM(fields_filled) as fields_filled
            FROM autofill_logs
            WHERE user_id = ? AND created_at >= date('now', '-30 days')
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        `, [userId]);

        res.json({
            success: true,
            data: {
                overall: {
                    totalAttempts: overallStats.total_attempts || 0,
                    successfulAttempts: overallStats.successful_attempts || 0,
                    successRate: overallStats.total_attempts > 0 ? 
                        Math.round((overallStats.successful_attempts / overallStats.total_attempts) * 100) : 0,
                    totalFieldsFilled: overallStats.total_fields_filled || 0,
                    uniquePortals: overallStats.unique_portals || 0,
                    avgFillRate: Math.round((overallStats.avg_fill_rate || 0) * 100)
                },
                portalStats: portalStats.map(stat => ({
                    portal: stat.portal,
                    attempts: stat.attempts,
                    successful: stat.successful,
                    successRate: Math.round((stat.successful / stat.attempts) * 100),
                    avgFillRate: Math.round((stat.avg_fill_rate || 0) * 100),
                    lastUsed: stat.last_used
                })),
                recentActivity: recentActivity
            }
        });
    } catch (error) {
        console.error('Get autofill stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch autofill statistics'
        });
    }
});

// Get missing fields analysis
router.get('/missing-fields', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;

        // Get frequently missing fields
        const missingFields = await db.query(`
            SELECT 
                portal,
                COUNT(*) as occurrences,
                AVG(missing_fields) as avg_missing_fields,
                GROUP_CONCAT(DISTINCT url) as sample_urls
            FROM autofill_logs
            WHERE user_id = ? AND missing_fields > 0
            GROUP BY portal
            ORDER BY avg_missing_fields DESC
            LIMIT 20
        `, [userId]);

        res.json({
            success: true,
            data: {
                missingFields: missingFields.map(field => ({
                    portal: field.portal,
                    occurrences: field.occurrences,
                    avgMissingFields: Math.round(field.avg_missing_fields * 10) / 10,
                    sampleUrls: field.sample_urls ? field.sample_urls.split(',') : []
                }))
            }
        });
    } catch (error) {
        console.error('Get missing fields error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch missing fields analysis'
        });
    }
});

module.exports = router;