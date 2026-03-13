const express = require('express');
const { getDatabase } = require('../database/connection');
const { validateQuery, validate } = require('../middleware/validation');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const EligibilityEngine = require('../services/eligibilityEngine');
const RecommendationAgent = require('../services/recommendationAgent');

const router = express.Router();
const db = getDatabase();
const eligibilityEngine = new EligibilityEngine();
const recommendationAgent = new RecommendationAgent();

// Search schemes with FTS5
router.get('/search', optionalAuth, validateQuery('schemeSearch'), async (req, res) => {
    try {
        const { query, category, ministry, level, beneficiary, state, limit, offset } = req.validatedQuery;
        let schemes = [];
        let total = 0;
        let whereConditions = ['is_active = 1'];
        let params = [];

        if (query) {
            // FTS5 search
            schemes = await db.searchSchemes(query, limit, offset);
            // Get total count for query
            const countResult = await db.get(`
                SELECT COUNT(*) as count 
                FROM schemes_fts 
                WHERE schemes_fts MATCH ?
            `, [query]);
            total = countResult?.count || 0;
        } else {
            // Build WHERE clause for filters
            if (category) {
                whereConditions.push('(scheme_category LIKE ? OR tags LIKE ?)');
                params.push(`%${category}%`, `%${category}%`);
            }
            if (ministry) {
                whereConditions.push('ministry LIKE ?');
                params.push(`%${ministry}%`);
            }
            if (level) {
                whereConditions.push('level = ?');
                params.push(level);
            }
            if (beneficiary) {
                whereConditions.push('target_beneficiaries LIKE ?');
                params.push(`%${beneficiary}%`);
            }
            if (state) {
                whereConditions.push('(state = ? OR state = "All States" OR state IS NULL)');
                params.push(state);
            }

            const whereClause = whereConditions.join(' AND ');

            // Get schemes with filters
            schemes = await db.query(`
                SELECT * FROM schemes 
                WHERE ${whereClause}
                ORDER BY last_updated DESC 
                LIMIT ? OFFSET ?
            `, [...params, limit, offset]);

            // Get total count
            const countResult = await db.get(`
                SELECT COUNT(*) as count 
                FROM schemes 
                WHERE ${whereClause}
            `, params);
            total = countResult?.count || 0;
        }

        // If user is authenticated, add eligibility information
        if (req.user && schemes.length > 0) {
            const eligibilityResults = await eligibilityEngine.evaluateUserEligibility(
                req.user.userId
            );
            
            // Map eligibility to schemes
            const eligibilityMap = new Map();
            eligibilityResults.forEach(result => {
                eligibilityMap.set(result.scheme.id, result.eligibility);
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
                    limit,
                    offset,
                    total,
                    hasMore: schemes.length === limit
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

// Get recommended schemes for authenticated user
router.get('/recommended/me', authenticateToken, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 6;
        const result = await recommendationAgent.getRecommendations(req.user.userId, limit);

        res.json({
            success: true,
            data: {
                schemes: result.recommendations.map(r => ({
                    ...r.scheme,
                    recommendation: {
                        score: r.score,
                        reasons: r.reasons,
                        matchedOn: r.matchedOn
                    }
                })),
                profileCompleteness: result.profileCompleteness,
                totalEvaluated: result.totalEvaluated
            }
        });
    } catch (error) {
        console.error('Recommendation error:', error);
        res.status(500).json({ success: false, message: 'Error generating recommendations' });
    }
});

// Get eligible schemes for authenticated user
router.get('/eligible/me', authenticateToken, async (req, res) => {
    try {
        const eligibilityResults = await eligibilityEngine.evaluateUserEligibility(
            req.user.userId
        );

        const eligibleSchemes = eligibilityResults.filter(result => 
            result.eligibility.status === 'eligible' || 
            result.eligibility.status === 'likely_eligible'
        );

        eligibleSchemes.sort((a, b) => b.eligibility.score - a.eligibility.score);

        res.json({
            success: true,
            data: {
                schemes: eligibleSchemes.map(result => ({
                    ...result.scheme,
                    eligibility: result.eligibility
                })),
                totalEligible: eligibleSchemes.length,
                totalEvaluated: eligibilityResults.length
            }
        });
    } catch (error) {
        console.error('Eligibility check error:', error);
        res.status(500).json({ success: false, message: 'Error checking scheme eligibility' });
    }
});

// Get scheme categories
router.get('/categories/list', async (req, res) => {
    try {
        const categories = await db.query(`
            SELECT category, COUNT(*) as scheme_count 
            FROM schemes 
            WHERE is_active = 1 AND category IS NOT NULL 
            GROUP BY category 
            ORDER BY scheme_count DESC
        `);
        res.json({ success: true, data: categories });
    } catch (error) {
        console.error('Categories error:', error);
        res.status(500).json({ success: false, message: 'Error fetching categories' });
    }
});

// Get scheme by ID  ← must be LAST among GET routes
router.get('/:id', optionalAuth, async (req, res) => {
    try {
        const schemeId = parseInt(req.params.id);
        
        const scheme = await db.get(`
            SELECT * FROM schemes WHERE id = ? AND is_active = 1
        `, [schemeId]);

        if (!scheme) {
            return res.status(404).json({
                success: false,
                message: 'Scheme not found'
            });
        }

        // Get required documents
        const documents = await db.query(`
            SELECT document_name, description, is_mandatory 
            FROM scheme_documents 
            WHERE scheme_id = ?
        `, [schemeId]);

        // Get eligibility tags
        const eligibilityTags = await db.query(`
            SELECT tag_type, tag_value 
            FROM eligibility_tags 
            WHERE scheme_id = ?
        `, [schemeId]);

        let eligibility = null;
        if (req.user) {
            const eligibilityResults = await eligibilityEngine.evaluateUserEligibility(
                req.user.userId,
                schemeId
            );
            eligibility = eligibilityResults[0]?.eligibility || null;
        }

        res.json({
            success: true,
            data: {
                ...scheme,
                documents,
                eligibilityTags,
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

module.exports = router;