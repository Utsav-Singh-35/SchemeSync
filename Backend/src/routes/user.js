const express = require('express');
const { getDatabase } = require('../database/connection');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const db = getDatabase();

// Get user documents
router.get('/documents', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;

        // Get user documents from database
        const documents = await db.query(`
            SELECT id, filename, original_name, file_type, category, 
                   upload_date, file_size, mime_type, s3_key
            FROM user_documents 
            WHERE user_id = ? AND is_active = 1
            ORDER BY upload_date DESC
        `, [userId]);

        res.json({
            success: true,
            data: documents.map(doc => ({
                id: doc.id,
                filename: doc.filename,
                originalName: doc.original_name,
                type: doc.category,
                category: doc.category,
                uploadDate: doc.upload_date,
                fileSize: doc.file_size,
                mimeType: doc.mime_type,
                downloadUrl: `/api/user/documents/${doc.id}/download`
            }))
        });
    } catch (error) {
        console.error('Get documents error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch documents'
        });
    }
});

// Add new profile field dynamically
router.post('/profile/add-field', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { field_name, field_value, source } = req.body;

        if (!field_name || field_value === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Field name and value are required'
            });
        }

        // Check if this is a standard profile field
        const standardFields = [
            'age', 'gender', 'date_of_birth', 'annual_income', 'occupation',
            'employment_status', 'state', 'district', 'address', 'pin_code',
            'category', 'religion', 'is_student', 'is_farmer', 'is_disabled',
            'disability_percentage', 'is_widow', 'is_senior_citizen', 
            'family_size', 'marital_status', 'phone_number'
        ];

        if (standardFields.includes(field_name)) {
            // Update standard profile field
            const existingProfile = await db.get(
                'SELECT id FROM user_profiles WHERE user_id = ?', 
                [userId]
            );

            if (existingProfile) {
                await db.run(`
                    UPDATE user_profiles 
                    SET ${field_name} = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = ?
                `, [field_value, userId]);
            } else {
                await db.run(`
                    INSERT INTO user_profiles (user_id, ${field_name})
                    VALUES (?, ?)
                `, [userId, field_value]);
            }
        } else {
            // Store as custom field
            await db.run(`
                INSERT OR REPLACE INTO user_custom_fields 
                (user_id, field_name, field_value, source, created_at)
                VALUES (?, ?, ?, ?, ?)
            `, [userId, field_name, field_value, source || 'manual', new Date().toISOString()]);
        }

        res.json({
            success: true,
            message: 'Profile field added successfully',
            data: {
                fieldName: field_name,
                fieldValue: field_value,
                isStandard: standardFields.includes(field_name)
            }
        });
    } catch (error) {
        console.error('Add profile field error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add profile field'
        });
    }
});

// Get user profile with custom fields
router.get('/profile/complete', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;

        // Get standard profile
        const user = await db.get(`
            SELECT u.id, u.email, u.name, u.created_at,
                   up.age, up.gender, up.date_of_birth, up.annual_income, up.occupation,
                   up.employment_status, up.state, up.district, up.address, up.pin_code,
                   up.category, up.religion, up.is_student, up.is_farmer, up.is_disabled,
                   up.disability_percentage, up.is_widow, up.is_senior_citizen, up.family_size,
                   up.marital_status, up.phone_number
            FROM users u
            LEFT JOIN user_profiles up ON u.id = up.user_id
            WHERE u.id = ?
        `, [userId]);

        // Get custom fields
        const customFields = await db.query(`
            SELECT field_name, field_value, source, created_at
            FROM user_custom_fields
            WHERE user_id = ?
            ORDER BY created_at DESC
        `, [userId]);

        // Merge custom fields into user object
        const customFieldsObj = {};
        customFields.forEach(field => {
            customFieldsObj[field.field_name] = field.field_value;
        });

        res.json({
            success: true,
            data: {
                user: { ...user, ...customFieldsObj },
                customFields: customFields
            }
        });
    } catch (error) {
        console.error('Get complete profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch complete profile'
        });
    }
});

// Upload document
router.post('/documents/upload', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        // This would handle file upload logic
        // For now, return a placeholder response
        
        res.json({
            success: true,
            message: 'Document upload endpoint - implementation needed',
            data: {
                uploadUrl: '/api/user/documents/upload',
                supportedTypes: ['pdf', 'jpg', 'jpeg', 'png'],
                maxSize: '5MB'
            }
        });
    } catch (error) {
        console.error('Document upload error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload document'
        });
    }
});

module.exports = router;