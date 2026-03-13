const express = require('express');
const crypto = require('crypto');
const { getDatabase } = require('../database/connection');
const { authenticateToken } = require('../middleware/auth');
const IntelligentNavigationService = require('../services/intelligentNavigationService');

const router = express.Router();
const db = getDatabase();
const navigationService = new IntelligentNavigationService();

// Analyze page content and provide navigation guidance
router.post('/analyze-page', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const {
            url,
            html,
            screenshot,
            objective = 'find_application_form',
            sessionId,
            stepNumber = 1
        } = req.body;

        if (!url || !html) {
            return res.status(400).json({
                success: false,
                message: 'URL and HTML content are required'
            });
        }

        // Get user context for personalized analysis
        const userProfile = await db.get(`
            SELECT u.name, u.email, up.*
            FROM users u
            LEFT JOIN user_profiles up ON u.id = up.user_id
            WHERE u.id = ?
        `, [userId]);

        // Get session history if session exists
        let sessionHistory = [];
        if (sessionId) {
            sessionHistory = await db.query(`
                SELECT step_number, url, action, success, reasoning
                FROM navigation_steps
                WHERE session_id = ?
                ORDER BY step_number ASC
            `, [sessionId]);
        }

        // Check LLM cache first
        const contentHash = crypto.createHash('sha256').update(html).digest('hex');
        const cachedAnalysis = await db.get(`
            SELECT analysis_result, confidence, created_at
            FROM llm_analysis_cache
            WHERE content_hash = ? AND expires_at > datetime('now')
        `, [contentHash]);

        let analysis;
        if (cachedAnalysis && cachedAnalysis.confidence > 0.8) {
            // Use cached analysis
            analysis = JSON.parse(cachedAnalysis.analysis_result);
            analysis.cached = true;
            
            // Update cache hit count
            await db.run(`
                UPDATE llm_analysis_cache 
                SET hit_count = hit_count + 1, last_used = datetime('now')
                WHERE content_hash = ?
            `, [contentHash]);
        } else {
            // Perform new analysis
            analysis = await navigationService.analyzePageIntelligently({
                url,
                html,
                screenshot,
                objective,
                userContext: userProfile,
                sessionHistory
            });

            // Cache the analysis (expires in 1 hour)
            await db.run(`
                INSERT OR REPLACE INTO llm_analysis_cache (
                    content_hash, url_pattern, analysis_result, confidence,
                    model_version, expires_at
                ) VALUES (?, ?, ?, ?, ?, datetime('now', '+1 hour'))
            `, [
                contentHash,
                new URL(url).hostname + '/*',
                JSON.stringify(analysis),
                analysis.confidence,
                'gpt-4-turbo'
            ]);
        }

        // Log the step if part of a session
        if (sessionId) {
            await db.run(`
                INSERT INTO navigation_steps (
                    session_id, step_number, url, action, element, data,
                    confidence, reasoning, timestamp
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                sessionId, stepNumber, url, analysis.action, analysis.element,
                JSON.stringify(analysis.data), analysis.confidence, analysis.reasoning,
                new Date().toISOString()
            ]);
        }

        // Update session status
        if (sessionId && analysis.action === 'form_found') {
            await db.run(`
                UPDATE navigation_sessions 
                SET status = 'completed', success = 1, completed_at = datetime('now')
                WHERE session_id = ?
            `, [sessionId]);
        }

        res.json({
            success: true,
            data: {
                ...analysis,
                sessionId,
                stepNumber,
                cached: analysis.cached || false
            }
        });

    } catch (error) {
        console.error('Page analysis error:', error);
        res.status(500).json({
            success: false,
            message: 'Page analysis failed',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// Start a new navigation session
router.post('/start-session', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { startUrl, objective = 'find_application_form' } = req.body;

        if (!startUrl) {
            return res.status(400).json({
                success: false,
                message: 'Start URL is required'
            });
        }

        const sessionId = `nav_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        await db.run(`
            INSERT INTO navigation_sessions (
                session_id, user_id, start_url, target_objective, status
            ) VALUES (?, ?, ?, ?, 'active')
        `, [sessionId, userId, startUrl, objective]);

        res.json({
            success: true,
            data: {
                sessionId,
                startUrl,
                objective,
                status: 'active'
            }
        });

    } catch (error) {
        console.error('Start session error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to start navigation session'
        });
    }
});

// Get session status and history
router.get('/session/:sessionId', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { sessionId } = req.params;

        const session = await db.get(`
            SELECT * FROM navigation_sessions
            WHERE session_id = ? AND user_id = ?
        `, [sessionId, userId]);

        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'Session not found'
            });
        }

        const steps = await db.query(`
            SELECT * FROM navigation_steps
            WHERE session_id = ?
            ORDER BY step_number ASC
        `, [sessionId]);

        res.json({
            success: true,
            data: {
                session,
                steps,
                totalSteps: steps.length
            }
        });

    } catch (error) {
        console.error('Get session error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get session details'
        });
    }
});

// Submit feedback on navigation suggestion
router.post('/feedback', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const {
            url,
            sessionId,
            suggestedAction,
            actualAction,
            success,
            rating,
            feedbackText
        } = req.body;

        await db.run(`
            INSERT INTO navigation_feedback (
                url, suggested_action, actual_action, success, user_rating,
                feedback_text, user_id, session_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            url, suggestedAction, actualAction, success, rating,
            feedbackText, userId, sessionId
        ]);

        // Update knowledge base based on feedback
        if (actualAction && success !== null) {
            await navigationService.updateKnowledgeBase(url, actualAction, success);
        }

        res.json({
            success: true,
            message: 'Feedback submitted successfully'
        });

    } catch (error) {
        console.error('Submit feedback error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit feedback'
        });
    }
});

// Get portal insights and statistics
router.get('/portal-insights/:domain', authenticateToken, async (req, res) => {
    try {
        const { domain } = req.params;
        
        const insights = await navigationService.getPortalInsights(domain);
        
        const portalConfig = await db.get(`
            SELECT * FROM portal_configurations WHERE domain = ?
        `, [domain]);

        const recentSessions = await db.query(`
            SELECT status, COUNT(*) as count
            FROM navigation_sessions
            WHERE start_url LIKE ?
            AND started_at > datetime('now', '-30 days')
            GROUP BY status
        `, [`%${domain}%`]);

        res.json({
            success: true,
            data: {
                domain,
                insights,
                configuration: portalConfig,
                recentActivity: recentSessions
            }
        });

    } catch (error) {
        console.error('Get portal insights error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get portal insights'
        });
    }
});

// Get user's navigation history
router.get('/history', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { limit = 20, offset = 0 } = req.query;

        const sessions = await db.query(`
            SELECT ns.*, COUNT(nst.id) as total_steps
            FROM navigation_sessions ns
            LEFT JOIN navigation_steps nst ON ns.session_id = nst.session_id
            WHERE ns.user_id = ?
            GROUP BY ns.session_id
            ORDER BY ns.started_at DESC
            LIMIT ? OFFSET ?
        `, [userId, limit, offset]);

        const totalCount = await db.get(`
            SELECT COUNT(*) as total FROM navigation_sessions WHERE user_id = ?
        `, [userId]);

        res.json({
            success: true,
            data: {
                sessions,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    total: totalCount.total,
                    hasMore: offset + sessions.length < totalCount.total
                }
            }
        });

    } catch (error) {
        console.error('Get navigation history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get navigation history'
        });
    }
});

// Update session step with user confirmation
router.put('/session/:sessionId/step/:stepNumber', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { sessionId, stepNumber } = req.params;
        const { userConfirmed, success, errorMessage } = req.body;

        // Verify session belongs to user
        const session = await db.get(`
            SELECT * FROM navigation_sessions
            WHERE session_id = ? AND user_id = ?
        `, [sessionId, userId]);

        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'Session not found'
            });
        }

        await db.run(`
            UPDATE navigation_steps
            SET user_confirmed = ?, success = ?, error_message = ?
            WHERE session_id = ? AND step_number = ?
        `, [userConfirmed, success, errorMessage, sessionId, stepNumber]);

        res.json({
            success: true,
            message: 'Step updated successfully'
        });

    } catch (error) {
        console.error('Update step error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update step'
        });
    }
});

module.exports = router;