const express = require('express');
const { getDatabase } = require('../database/connection');
const { validateQuery } = require('../middleware/validation');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const ComprehensiveEligibilityEngine = require('../services/comprehensiveEligibilityEngine');
const RecommendationAgent = require('../services/recommendationAgent');

const router = express.Router();
const db = getDatabase();
const eligibilityEngine = new ComprehensiveEligibilityEngine();
const recommendationAgent = new RecommendationAgent();

function parseScheme(scheme) {
    return {
        ...scheme,
        title: scheme.name || scheme.title,
        tags: scheme.tags ? JSON.parse(scheme.tags) : [],
        target_beneficiaries: scheme.target_beneficiaries ? JSON.parse(scheme.target_beneficiaries) : [],
        scheme_category: scheme.scheme_category ? JSON.parse(scheme.scheme_category) : [],
        scheme_subcategory: scheme.scheme_subcategory ? JSON.parse(scheme.scheme_subcategory) : [],
        contact_information: scheme.contact_information ? JSON.parse(scheme.contact_information) : {}
    };
}

// ─── Named routes (must all come before /:identifier) ────────────────────────

// Search
router.get('/search', optionalAuth, validateQuery('schemeSearch'), async (req, res) => {
    try {
        const { query, category, ministry, level, limit = 20, offset = 0 } = req.validatedQuery;
        let schemes = [];
        let totalCount = 0;
        let whereClause = 'WHERE is_active = 1';
        let params = [];

        if (query) {
            const ftsQuery = `SELECT s.*, rank FROM schemes s JOIN schemes_fts ON schemes_fts.rowid = s.rowid WHERE schemes_fts MATCH ? AND s.is_active = 1 ORDER BY rank LIMIT ? OFFSET ?`;
            schemes = await db.query(ftsQuery, [query, limit, offset]);
            const countResult = await db.get(`SELECT COUNT(*) as total FROM schemes s JOIN schemes_fts ON schemes_fts.rowid = s.rowid WHERE schemes_fts MATCH ? AND s.is_active = 1`, [query]);
            totalCount = countResult.total;
        } else {
            if (category) { whereClause += ' AND (scheme_category LIKE ? OR tags LIKE ?)'; params.push(`%${category}%`, `%${category}%`); }
            if (ministry) { whereClause += ' AND ministry = ?'; params.push(ministry); }
            if (level) { whereClause += ' AND level = ?'; params.push(level); }
            schemes = await db.query(`SELECT * FROM schemes ${whereClause} ORDER BY last_updated DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
            const countResult = await db.get(`SELECT COUNT(*) as total FROM schemes ${whereClause}`, params);
            totalCount = countResult.total;
        }

        schemes = schemes.map(parseScheme);

        if (req.user && schemes.length > 0) {
            const eligibilityResults = await eligibilityEngine.evaluateUserEligibility(req.user.userId, schemes.map(s => s.id));
            const eligibilityMap = new Map();
            eligibilityResults.forEach(r => eligibilityMap.set(r.scheme_id, r.eligibility));
            schemes = schemes.map(s => ({ ...s, eligibility: eligibilityMap.get(s.id) || null }));
        }

        res.json({ success: true, data: { schemes, pagination: { limit: parseInt(limit), offset: parseInt(offset), total: totalCount, hasMore: offset + schemes.length < totalCount } } });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ success: false, message: 'Error searching schemes' });
    }
});

// Recommended schemes (dashboard)
router.get('/recommended/me', authenticateToken, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 6;
        const result = await recommendationAgent.getRecommendations(req.user.userId, limit);
        res.json({
            success: true,
            data: {
                schemes: result.recommendations.map(r => ({
                    ...parseScheme(r.scheme),
                    recommendation: { score: r.score, reasons: r.reasons, matchedOn: r.matchedOn }
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

// Eligible schemes
router.get('/eligible/me', authenticateToken, async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;
        const eligibilityResults = await eligibilityEngine.evaluateUserEligibility(req.user.userId);
        const eligibleSchemes = eligibilityResults
            .filter(r => r.eligibility.status === 'eligible' || r.eligibility.status === 'likely_eligible')
            .sort((a, b) => b.eligibility.score - a.eligibility.score)
            .slice(offset, offset + limit);

        const schemeIds = eligibleSchemes.map(r => r.scheme_id);
        const schemes = schemeIds.length > 0
            ? await db.query(`SELECT * FROM schemes WHERE id IN (${schemeIds.map(() => '?').join(',')})`, schemeIds)
            : [];

        res.json({
            success: true,
            data: {
                schemes: schemes.map(s => {
                    const er = eligibleSchemes.find(r => r.scheme_id === s.id);
                    return { ...parseScheme(s), eligibility: er.eligibility };
                }),
                totalEligible: eligibleSchemes.length,
                totalEvaluated: eligibilityResults.length,
                pagination: { limit: parseInt(limit), offset: parseInt(offset), hasMore: offset + eligibleSchemes.length < eligibilityResults.length }
            }
        });
    } catch (error) {
        console.error('Eligibility check error:', error);
        res.status(500).json({ success: false, message: 'Error checking scheme eligibility' });
    }
});

// Saved schemes
router.get('/saved/me', authenticateToken, async (req, res) => {
    try {
        const { limit = 20, offset = 0 } = req.query;
        const rows = await db.query(`SELECT s.*, ss.saved_at FROM schemes s JOIN saved_schemes ss ON s.id = ss.scheme_id WHERE ss.user_id = ? AND s.is_active = 1 ORDER BY ss.saved_at DESC LIMIT ? OFFSET ?`, [req.user.userId, limit, offset]);
        res.json({ success: true, data: { schemes: rows.map(parseScheme), pagination: { limit: parseInt(limit), offset: parseInt(offset), hasMore: rows.length === parseInt(limit) } } });
    } catch (error) {
        console.error('Get saved schemes error:', error);
        res.status(500).json({ success: false, message: 'Error fetching saved schemes' });
    }
});

// Stats
router.get('/stats/overview', async (req, res) => {
    try {
        const [total, byMinistry, byLevel, recent] = await Promise.all([
            db.get('SELECT COUNT(*) as total FROM schemes WHERE is_active = 1'),
            db.query(`SELECT ministry, COUNT(*) as count FROM schemes WHERE is_active = 1 AND ministry IS NOT NULL GROUP BY ministry ORDER BY count DESC LIMIT 10`),
            db.query(`SELECT level, COUNT(*) as count FROM schemes WHERE is_active = 1 AND level IS NOT NULL GROUP BY level`),
            db.query(`SELECT COUNT(*) as count FROM schemes WHERE is_active = 1 AND last_updated > datetime('now', '-30 days')`)
        ]);
        res.json({ success: true, data: { totalSchemes: total.total, byMinistry, byLevel, recentlyUpdated: recent[0].count } });
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ success: false, message: 'Error fetching statistics' });
    }
});

// Save scheme
router.post('/:id/save', authenticateToken, async (req, res) => {
    try {
        const scheme = await db.get('SELECT id FROM schemes WHERE id = ?', [req.params.id]);
        if (!scheme) return res.status(404).json({ success: false, message: 'Scheme not found' });
        await db.run(`INSERT OR IGNORE INTO saved_schemes (user_id, scheme_id) VALUES (?, ?)`, [req.user.userId, req.params.id]);
        res.json({ success: true, message: 'Scheme saved successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error saving scheme' });
    }
});

// Remove saved scheme
router.delete('/:id/save', authenticateToken, async (req, res) => {
    try {
        await db.run(`DELETE FROM saved_schemes WHERE user_id = ? AND scheme_id = ?`, [req.user.userId, req.params.id]);
        res.json({ success: true, message: 'Scheme removed from saved list' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error removing saved scheme' });
    }
});

// ─── /:identifier MUST be last ────────────────────────────────────────────────
router.get('/:identifier', optionalAuth, async (req, res) => {
    try {
        const identifier = req.params.identifier;
        let scheme = await db.get(`SELECT * FROM schemes WHERE id = ? AND is_active = 1`, [identifier]);
        if (!scheme) scheme = await db.get(`SELECT * FROM schemes WHERE slug = ? AND is_active = 1`, [identifier]);
        if (!scheme) return res.status(404).json({ success: false, message: 'Scheme not found' });

        scheme = parseScheme(scheme);

        const eligibilityCriteria = await db.query(`SELECT criteria_type, criteria_value, criteria_operator, is_mandatory FROM eligibility_criteria WHERE scheme_id = ?`, [scheme.id]);
        const requiredDocuments = scheme.required_documents ? scheme.required_documents.split('\n').filter(d => d.trim()) : [];
        const referenceLinks = scheme.reference_links
            ? scheme.reference_links.split('\n').map(link => { const [title, url] = link.split(': '); return { title: title?.trim(), url: url?.trim() }; }).filter(r => r.title && r.url)
            : [];

        let eligibility = null;
        if (req.user) {
            const results = await eligibilityEngine.evaluateUserEligibility(req.user.userId, [scheme.id]);
            eligibility = results[0]?.eligibility || null;
        }

        res.json({ success: true, data: { ...scheme, eligibility_criteria_parsed: eligibilityCriteria, required_documents_array: requiredDocuments, reference_links_array: referenceLinks, eligibility } });
    } catch (error) {
        console.error('Get scheme error:', error);
        res.status(500).json({ success: false, message: 'Error fetching scheme details' });
    }
});

module.exports = router;
