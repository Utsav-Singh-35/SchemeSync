const express = require('express');
const { getDatabase } = require('../database/connection');
const { validate } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const db = getDatabase();

// Get all applications for authenticated user
router.get('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { status, limit = 20, offset = 0 } = req.query;

        let whereClause = 'WHERE a.user_id = ?';
        let params = [userId];

        if (status) {
            whereClause += ' AND a.application_status = ?';
            params.push(status);
        }

        const applications = await db.query(`
            SELECT a.*, s.name as scheme_name, s.ministry, s.brief_description
            FROM applications a
            JOIN schemes s ON a.scheme_id = s.id
            ${whereClause}
            ORDER BY a.created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, parseInt(limit), parseInt(offset)]);

        // Get total count
        const countResult = await db.get(`
            SELECT COUNT(*) as total
            FROM applications a
            ${whereClause}
        `, params);

        res.json({
            success: true,
            data: {
                applications,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    total: countResult.total,
                    hasMore: offset + applications.length < countResult.total
                }
            }
        });
    } catch (error) {
        console.error('Applications fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch applications'
        });
    }
});

// Get application by ID
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const applicationId = req.params.id;

        const application = await db.get(`
            SELECT a.*, s.name as scheme_name, s.ministry, s.brief_description,
                   s.application_url, s.required_documents
            FROM applications a
            JOIN schemes s ON a.scheme_id = s.id
            WHERE a.id = ? AND a.user_id = ?
        `, [applicationId, userId]);

        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Application not found'
            });
        }

        res.json({
            success: true,
            data: application
        });
    } catch (error) {
        console.error('Application fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch application'
        });
    }
});

// Create new application
router.post('/', authenticateToken, validate('application'), async (req, res) => {
    try {
        const userId = req.user.userId;
        const { schemeId, applicationDate, acknowledgmentNumber, portalUrl, notes } = req.validatedData;

        // Check if scheme exists
        const scheme = await db.get('SELECT id, name FROM schemes WHERE id = ?', [schemeId]);
        if (!scheme) {
            return res.status(404).json({
                success: false,
                message: 'Scheme not found'
            });
        }

        // Check if user already applied for this scheme
        const existingApplication = await db.get(`
            SELECT id FROM applications WHERE user_id = ? AND scheme_id = ?
        `, [userId, schemeId]);

        if (existingApplication) {
            return res.status(400).json({
                success: false,
                message: 'You have already applied for this scheme'
            });
        }

        const result = await db.run(`
            INSERT INTO applications (
                user_id, scheme_id, application_date, acknowledgment_number,
                application_status, portal_url, notes
            ) VALUES (?, ?, ?, ?, 'submitted', ?, ?)
        `, [userId, schemeId, applicationDate, acknowledgmentNumber, portalUrl, notes]);

        const application = await db.get(`
            SELECT a.*, s.name as scheme_name
            FROM applications a
            JOIN schemes s ON a.scheme_id = s.id
            WHERE a.id = ?
        `, [result.lastID]);

        res.status(201).json({
            success: true,
            message: 'Application recorded successfully',
            data: application
        });
    } catch (error) {
        console.error('Application creation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to record application'
        });
    }
});

// Update application status
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const applicationId = req.params.id;
        const { applicationStatus, acknowledgmentNumber, portalUrl, notes } = req.body;

        // Validate status
        const validStatuses = ['submitted', 'under_review', 'approved', 'rejected', 'pending_documents'];
        if (applicationStatus && !validStatuses.includes(applicationStatus)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid application status'
            });
        }

        // Check if application belongs to user
        const existingApplication = await db.get(`
            SELECT id FROM applications WHERE id = ? AND user_id = ?
        `, [applicationId, userId]);

        if (!existingApplication) {
            return res.status(404).json({
                success: false,
                message: 'Application not found'
            });
        }

        // Build update query
        const updateFields = [];
        const updateValues = [];

        if (applicationStatus) {
            updateFields.push('application_status = ?');
            updateValues.push(applicationStatus);
        }
        if (acknowledgmentNumber !== undefined) {
            updateFields.push('acknowledgment_number = ?');
            updateValues.push(acknowledgmentNumber);
        }
        if (portalUrl !== undefined) {
            updateFields.push('portal_url = ?');
            updateValues.push(portalUrl);
        }
        if (notes !== undefined) {
            updateFields.push('notes = ?');
            updateValues.push(notes);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No fields to update'
            });
        }

        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        updateValues.push(applicationId, userId);

        await db.run(`
            UPDATE applications 
            SET ${updateFields.join(', ')}
            WHERE id = ? AND user_id = ?
        `, updateValues);

        const updatedApplication = await db.get(`
            SELECT a.*, s.name as scheme_name
            FROM applications a
            JOIN schemes s ON a.scheme_id = s.id
            WHERE a.id = ?
        `, [applicationId]);

        res.json({
            success: true,
            message: 'Application updated successfully',
            data: updatedApplication
        });
    } catch (error) {
        console.error('Application update error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update application'
        });
    }
});

// Delete application
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const applicationId = req.params.id;

        // Check if application belongs to user
        const existingApplication = await db.get(`
            SELECT id FROM applications WHERE id = ? AND user_id = ?
        `, [applicationId, userId]);

        if (!existingApplication) {
            return res.status(404).json({
                success: false,
                message: 'Application not found'
            });
        }

        await db.run(`
            DELETE FROM applications WHERE id = ? AND user_id = ?
        `, [applicationId, userId]);

        res.json({
            success: true,
            message: 'Application deleted successfully'
        });
    } catch (error) {
        console.error('Application deletion error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete application'
        });
    }
});

// Get application statistics for user
router.get('/stats/overview', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;

        const stats = await Promise.all([
            // Total applications
            db.get('SELECT COUNT(*) as total FROM applications WHERE user_id = ?', [userId]),
            
            // Applications by status
            db.query(`
                SELECT application_status, COUNT(*) as count 
                FROM applications 
                WHERE user_id = ? 
                GROUP BY application_status
            `, [userId]),
            
            // Recent applications
            db.query(`
                SELECT a.id, a.application_date, a.application_status, s.name as scheme_name
                FROM applications a
                JOIN schemes s ON a.scheme_id = s.id
                WHERE a.user_id = ?
                ORDER BY a.created_at DESC
                LIMIT 5
            `, [userId])
        ]);

        res.json({
            success: true,
            data: {
                totalApplications: stats[0].total,
                byStatus: stats[1],
                recentApplications: stats[2]
            }
        });
    } catch (error) {
        console.error('Application stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch application statistics'
        });
    }
});

module.exports = router;