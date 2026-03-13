const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken } = require('../middleware/auth');
const { getDatabase } = require('../database/connection');
const BrowserAutomationService = require('../services/browserAutomationService');

const router = express.Router();
const db = getDatabase();
const automationService = new BrowserAutomationService();

// Start form filling automation for a scheme
router.post('/fill-form', authenticateToken, async (req, res) => {
    try {
        const { schemeId, applicationUrl } = req.body;
        const userId = req.user.userId;

        if (!schemeId || !applicationUrl) {
            return res.status(400).json({
                success: false,
                message: 'Scheme ID and application URL are required'
            });
        }

        // Get user profile data
        const userProfile = await db.get(`
            SELECT u.name, u.email, up.*
            FROM users u
            LEFT JOIN user_profiles up ON u.id = up.user_id
            WHERE u.id = ?
        `, [userId]);

        if (!userProfile) {
            return res.status(404).json({
                success: false,
                message: 'User profile not found. Please complete your profile first.'
            });
        }

        // Get scheme details
        const scheme = await db.get(`
            SELECT * FROM schemes WHERE id = ? AND is_active = 1
        `, [schemeId]);

        if (!scheme) {
            return res.status(404).json({
                success: false,
                message: 'Scheme not found'
            });
        }

        // Generate unique session ID
        const sessionId = `session_${userId}_${Date.now()}_${uuidv4().substring(0, 8)}`;

        // Start form filling automation
        const result = await automationService.fillApplicationForm(
            userProfile,
            applicationUrl,
            sessionId
        );

        if (result.success) {
            // Log the automation attempt
            await db.run(`
                INSERT INTO automation_sessions (
                    user_id, scheme_id, session_id, application_url, 
                    status, fields_found, fields_filled, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                userId, schemeId, sessionId, result.finalUrl || applicationUrl,
                'completed', result.fieldsFound, result.fieldsFilled, new Date().toISOString()
            ]);

            res.json({
                success: true,
                data: {
                    sessionId: result.sessionId,
                    schemeName: scheme.title || scheme.name,
                    initialUrl: result.initialUrl,
                    finalUrl: result.finalUrl,
                    browserUrl: result.browserUrl,
                    fieldsFound: result.fieldsFound,
                    fieldsFilled: result.fieldsFilled,
                    formSubmitted: result.formSubmitted,
                    message: result.message,
                    instructions: result.instructions,
                    continueUrl: result.browserUrl || `/automation/continue/${result.sessionId}`
                }
            });
        } else {
            // Log the failed attempt
            await db.run(`
                INSERT INTO automation_sessions (
                    user_id, scheme_id, session_id, application_url, 
                    status, error_message, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                userId, schemeId, sessionId, applicationUrl,
                'failed', result.error, new Date().toISOString()
            ]);

            res.status(500).json({
                success: false,
                message: result.message,
                error: result.error
            });
        }
    } catch (error) {
        console.error('Form filling automation error:', error);
        res.status(500).json({
            success: false,
            message: 'Form filling automation failed',
            error: error.message
        });
    }
});

// Get automation session status
router.get('/session/:sessionId', authenticateToken, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const userId = req.user.userId;

        // Get session details from database
        const session = await db.get(`
            SELECT as.*, s.name as scheme_name
            FROM automation_sessions as
            LEFT JOIN schemes s ON as.scheme_id = s.id
            WHERE as.session_id = ? AND as.user_id = ?
        `, [sessionId, userId]);

        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'Automation session not found'
            });
        }

        res.json({
            success: true,
            data: {
                sessionId: session.session_id,
                schemeName: session.scheme_name,
                applicationUrl: session.application_url,
                status: session.status,
                fieldsFound: session.fields_found,
                fieldsFilled: session.fields_filled,
                errorMessage: session.error_message,
                createdAt: session.created_at
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

// Continue with browser session (redirect to filled form)
router.get('/continue/:sessionId', authenticateToken, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const userId = req.user.userId;

        // Verify session belongs to user
        const session = await db.get(`
            SELECT * FROM automation_sessions 
            WHERE session_id = ? AND user_id = ?
        `, [sessionId, userId]);

        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'Session not found or access denied'
            });
        }

        // Get current browser session URL
        const browserUrl = await automationService.getBrowserSessionUrl(sessionId);

        if (browserUrl) {
            // Redirect user to the browser session with pre-filled form
            res.redirect(browserUrl);
        } else {
            // Fallback to original application URL
            res.redirect(session.application_url);
        }
    } catch (error) {
        console.error('Continue session error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to continue session'
        });
    }
});

// Get user's automation history
router.get('/history', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { limit = 20, offset = 0 } = req.query;

        const sessions = await db.query(`
            SELECT as.*, s.name as scheme_name
            FROM automation_sessions as
            LEFT JOIN schemes s ON as.scheme_id = s.id
            WHERE as.user_id = ?
            ORDER BY as.created_at DESC
            LIMIT ? OFFSET ?
        `, [userId, limit, offset]);

        const totalCount = await db.get(`
            SELECT COUNT(*) as total FROM automation_sessions WHERE user_id = ?
        `, [userId]);

        res.json({
            success: true,
            data: {
                sessions: sessions.map(session => ({
                    sessionId: session.session_id,
                    schemeName: session.scheme_name,
                    applicationUrl: session.application_url,
                    status: session.status,
                    fieldsFound: session.fields_found,
                    fieldsFilled: session.fields_filled,
                    errorMessage: session.error_message,
                    createdAt: session.created_at
                })),
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    total: totalCount.total,
                    hasMore: offset + sessions.length < totalCount.total
                }
            }
        });
    } catch (error) {
        console.error('Get automation history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get automation history'
        });
    }
});

// Close automation session
router.delete('/session/:sessionId', authenticateToken, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const userId = req.user.userId;

        // Verify session belongs to user
        const session = await db.get(`
            SELECT * FROM automation_sessions 
            WHERE session_id = ? AND user_id = ?
        `, [sessionId, userId]);

        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'Session not found or access denied'
            });
        }

        // Close browser session
        const closed = await automationService.closeBrowserSession(sessionId);

        // Update session status
        await db.run(`
            UPDATE automation_sessions 
            SET status = 'closed', updated_at = ?
            WHERE session_id = ?
        `, [new Date().toISOString(), sessionId]);

        res.json({
            success: true,
            message: 'Session closed successfully',
            data: { sessionId, closed }
        });
    } catch (error) {
        console.error('Close session error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to close session'
        });
    }
});

// Cleanup old sessions (admin endpoint)
router.post('/cleanup', async (req, res) => {
    try {
        await automationService.cleanup();
        res.json({
            success: true,
            message: 'Cleanup completed successfully'
        });
    } catch (error) {
        console.error('Cleanup error:', error);
        res.status(500).json({
            success: false,
            message: 'Cleanup failed'
        });
    }
});

module.exports = router;