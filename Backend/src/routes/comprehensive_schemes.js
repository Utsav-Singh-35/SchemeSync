const express = require('express');
const { getDatabase } = require('../database/connection');
const { validateQuery, validate } = require('../middleware/validation');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const ComprehensiveEligibilityEngine = require('../services/comprehensiveEligibilityEngine');

const router = express.Router();
const db = getDatabase();
const eligibilityEngine = new ComprehensiveEligibilityEngine();

// Search schemes with comprehensive FTS5
router.get('/search', optionalAuth, validateQuery('schemeSearch'), async (req, res) => {
    try {
        const { query, category, ministry, level, limit = 20, offset = 0 } = req.validatedQuery;
        let schemes = [];
        let totalCount = 0;

        let whereClause = 'WHERE is_active = 1';
        let params = [];

        if (query) {
            // FTS5 search across comprehensive fields
            const ftsQuery = `
                SELECT s.*, rank 
                FROM schemes s
                JOIN schemes_fts ON schemes_fts.rowid = s.rowid
                WHERE schemes_fts MATCH ? AND s.is_active = 1
                ORDER BY rank
                LIMIT ? OFFSET ?
            `;
            schemes = await db.query(ftsQuery, [query, limit, offset]);
            
            // Get total count for pagination
            const countQuery = `
                SELECT COUNT(*) as total
                FROM schemes s
                JOIN schemes_fts ON schemes_fts.rowid = s.rowid
                WHERE schemes_fts MATCH ? AND s.is_active = 1
            `;
            const countResult = await db.get(countQuery, [query]);
            totalCount = countResult.total;
        } else {
            // Filtered search
            if (category) {
                whereClause += ' AND (scheme_category LIKE ? OR tags LIKE ?)';
                params.push(`%${category}%`, `%${category}%`);
            }
            if (ministry) {
                whereClause += ' AND ministry = ?';
                params.push(ministry);
            }
            if (level) {
                whereClause += ' AND level = ?';
                params.push(level);
            }

            const searchQuery = `
                SELECT * FROM schemes 
                ${whereClause}
                ORDER BY last_updated DESC 
                LIMIT ? OFFSET ?
            `;
            schemes = await db.query(searchQuery, [...params, limit, offset]);

            // Get total count
            const countQuery = `SELECT COUNT(*) as total FROM schemes ${whereClause}`;
            const countResult = await db.get(countQuery, params);
            totalCount = countResult.total;
        }

        // Parse JSON fields and add eligibility if user is authenticated
        schemes = schemes.map(scheme => ({
            ...scheme,
            title: scheme.name || scheme.title, // Map name to title for frontend compatibility
            tags: scheme.tags ? JSON.parse(scheme.tags) : [],
            target_beneficiaries: scheme.target_beneficiaries ? JSON.parse(scheme.target_beneficiaries) : [],
            scheme_category: scheme.scheme_category ? JSON.parse(scheme.scheme_category) : [],
            scheme_subcategory: scheme.scheme_subcategory ? JSON.parse(scheme.scheme_subcategory) : [],
            contact_information: scheme.contact_information ? JSON.parse(scheme.contact_information) : {}
        }));

        // Add eligibility information for authenticated users
        if (req.user && schemes.length > 0) {
            const eligibilityResults = await eligibilityEngine.evaluateUserEligibility(
                req.user.userId,
                schemes.map(s => s.id)
            );
            
            const eligibilityMap = new Map();
            eligibilityResults.forEach(result => {
                eligibilityMap.set(result.scheme_id, result.eligibility);
            });

            schemes = schemes.map(scheme => ({
                ...scheme,
                eligibility: eligibilityMap.get(scheme.id) || null
            }));
        }

        res.json({
            success: true,
            data: {
                schemes,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    total: totalCount,
                    hasMore: offset + schemes.length < totalCount
                }
            }
        });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({
            success: false,
            message: 'Error searching schemes'
        });
    }
});

// Get scheme by ID or slug
router.get('/:identifier', optionalAuth, async (req, res) => {
    try {
        const identifier = req.params.identifier;
        
        // Try to find by ID first, then by slug
        let scheme = await db.get(`
            SELECT * FROM schemes WHERE id = ? AND is_active = 1
        `, [identifier]);

        if (!scheme) {
            scheme = await db.get(`
                SELECT * FROM schemes WHERE slug = ? AND is_active = 1
            `, [identifier]);
        }

        if (!scheme) {
            return res.status(404).json({
                success: false,
                message: 'Scheme not found'
            });
        }

        // Parse JSON fields
        scheme.title = scheme.name || scheme.title; // Map name to title for frontend compatibility
        scheme.tags = scheme.tags ? JSON.parse(scheme.tags) : [];
        scheme.target_beneficiaries = scheme.target_beneficiaries ? JSON.parse(scheme.target_beneficiaries) : [];
        scheme.scheme_category = scheme.scheme_category ? JSON.parse(scheme.scheme_category) : [];
        scheme.scheme_subcategory = scheme.scheme_subcategory ? JSON.parse(scheme.scheme_subcategory) : [];
        scheme.contact_information = scheme.contact_information ? JSON.parse(scheme.contact_information) : {};

        // Get parsed eligibility criteria
        const eligibilityCriteria = await db.query(`
            SELECT criteria_type, criteria_value, criteria_operator, is_mandatory 
            FROM eligibility_criteria 
            WHERE scheme_id = ?
        `, [scheme.id]);

        // Parse required documents into array
        const requiredDocuments = scheme.required_documents ? 
            scheme.required_documents.split('\n').filter(doc => doc.trim()) : [];

        // Parse reference links
        const referenceLinks = scheme.reference_links ? 
            scheme.reference_links.split('\n').map(link => {
                const [title, url] = link.split(': ');
                return { title: title?.trim(), url: url?.trim() };
            }).filter(ref => ref.title && ref.url) : [];

        // Check eligibility for authenticated user
        let eligibility = null;
        if (req.user) {
            const eligibilityResults = await eligibilityEngine.evaluateUserEligibility(
                req.user.userId,
                [scheme.id]
            );
            eligibility = eligibilityResults[0]?.eligibility || null;
        }

        res.json({
            success: true,
            data: {
                ...scheme,
                eligibility_criteria_parsed: eligibilityCriteria,
                required_documents_array: requiredDocuments,
                reference_links_array: referenceLinks,
                eligibility
            }
        });
    } catch (error) {
        console.error('Get scheme error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching scheme details'
        });
    }
});

// Get eligible schemes for authenticated user
router.get('/eligible/me', authenticateToken, async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;
        
        const eligibilityResults = await eligibilityEngine.evaluateUserEligibility(
            req.user.userId
        );

        // Filter and sort eligible schemes
        const eligibleSchemes = eligibilityResults
            .filter(result => 
                result.eligibility.status === 'eligible' || 
                result.eligibility.status === 'likely_eligible'
            )
            .sort((a, b) => b.eligibility.score - a.eligibility.score)
            .slice(offset, offset + limit);

        // Get full scheme details for eligible schemes
        const schemeIds = eligibleSchemes.map(result => result.scheme_id);
        const schemes = await db.query(`
            SELECT * FROM schemes WHERE id IN (${schemeIds.map(() => '?').join(',')})
        `, schemeIds);

        // Combine scheme data with eligibility
        const schemesWithEligibility = schemes.map(scheme => {
            const eligibilityResult = eligibleSchemes.find(r => r.scheme_id === scheme.id);
            return {
                ...scheme,
                title: scheme.name || scheme.title, // Map name to title for frontend compatibility
                tags: scheme.tags ? JSON.parse(scheme.tags) : [],
                target_beneficiaries: scheme.target_beneficiaries ? JSON.parse(scheme.target_beneficiaries) : [],
                scheme_category: scheme.scheme_category ? JSON.parse(scheme.scheme_category) : [],
                scheme_subcategory: scheme.scheme_subcategory ? JSON.parse(scheme.scheme_subcategory) : [],
                contact_information: scheme.contact_information ? JSON.parse(scheme.contact_information) : {},
                eligibility: eligibilityResult.eligibility
            };
        });

        res.json({
            success: true,
            data: {
                schemes: schemesWithEligibility,
                totalEligible: eligibleSchemes.length,
                totalEvaluated: eligibilityResults.length,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    hasMore: offset + eligibleSchemes.length < eligibilityResults.length
                }
            }
        });
    } catch (error) {
        console.error('Eligibility check error:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking scheme eligibility'
        });
    }
});

// Get scheme statistics
router.get('/stats/overview', async (req, res) => {
    try {
        const stats = await Promise.all([
            // Total schemes
            db.get('SELECT COUNT(*) as total FROM schemes WHERE is_active = 1'),
            
            // Schemes by ministry
            db.query(`
                SELECT ministry, COUNT(*) as count 
                FROM schemes 
                WHERE is_active = 1 AND ministry IS NOT NULL 
                GROUP BY ministry 
                ORDER BY count DESC 
                LIMIT 10
            `),
            
            // Schemes by level
            db.query(`
                SELECT level, COUNT(*) as count 
                FROM schemes 
                WHERE is_active = 1 AND level IS NOT NULL 
                GROUP BY level
            `),
            
            // Recent schemes
            db.query(`
                SELECT COUNT(*) as count 
                FROM schemes 
                WHERE is_active = 1 AND last_updated > datetime('now', '-30 days')
            `)
        ]);

        res.json({
            success: true,
            data: {
                totalSchemes: stats[0].total,
                byMinistry: stats[1],
                byLevel: stats[2],
                recentlyUpdated: stats[3][0].count
            }
        });
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching statistics'
        });
    }
});

// Save/bookmark scheme
router.post('/:id/save', authenticateToken, async (req, res) => {
    try {
        const schemeId = req.params.id;
        const userId = req.user.userId;

        // Check if scheme exists
        const scheme = await db.get('SELECT id FROM schemes WHERE id = ?', [schemeId]);
        if (!scheme) {
            return res.status(404).json({
                success: false,
                message: 'Scheme not found'
            });
        }

        // Save scheme
        await db.run(`
            INSERT OR IGNORE INTO saved_schemes (user_id, scheme_id)
            VALUES (?, ?)
        `, [userId, schemeId]);

        res.json({
            success: true,
            message: 'Scheme saved successfully'
        });
    } catch (error) {
        console.error('Save scheme error:', error);
        res.status(500).json({
            success: false,
            message: 'Error saving scheme'
        });
    }
});

// Remove saved scheme
router.delete('/:id/save', authenticateToken, async (req, res) => {
    try {
        const schemeId = req.params.id;
        const userId = req.user.userId;

        await db.run(`
            DELETE FROM saved_schemes 
            WHERE user_id = ? AND scheme_id = ?
        `, [userId, schemeId]);

        res.json({
            success: true,
            message: 'Scheme removed from saved list'
        });
    } catch (error) {
        console.error('Remove saved scheme error:', error);
        res.status(500).json({
            success: false,
            message: 'Error removing saved scheme'
        });
    }
});

// Get saved schemes
router.get('/saved/me', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { limit = 20, offset = 0 } = req.query;

        const savedSchemes = await db.query(`
            SELECT s.*, ss.saved_at
            FROM schemes s
            JOIN saved_schemes ss ON s.id = ss.scheme_id
            WHERE ss.user_id = ? AND s.is_active = 1
            ORDER BY ss.saved_at DESC
            LIMIT ? OFFSET ?
        `, [userId, limit, offset]);

        // Parse JSON fields
        const schemes = savedSchemes.map(scheme => ({
            ...scheme,
            title: scheme.name || scheme.title, // Map name to title for frontend compatibility
            tags: scheme.tags ? JSON.parse(scheme.tags) : [],
            target_beneficiaries: scheme.target_beneficiaries ? JSON.parse(scheme.target_beneficiaries) : [],
            scheme_category: scheme.scheme_category ? JSON.parse(scheme.scheme_category) : [],
            scheme_subcategory: scheme.scheme_subcategory ? JSON.parse(scheme.scheme_subcategory) : [],
            contact_information: scheme.contact_information ? JSON.parse(scheme.contact_information) : {}
        }));

        res.json({
            success: true,
            data: {
                schemes,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    hasMore: schemes.length === parseInt(limit)
                }
            }
        });
    } catch (error) {
        console.error('Get saved schemes error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching saved schemes'
        });
    }
});

module.exports = router;