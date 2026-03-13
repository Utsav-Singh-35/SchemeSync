const express = require('express');
const { getDatabase } = require('../database/connection');
const { validate } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const db = getDatabase();

// Get all family members for authenticated user
router.get('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;

        const familyMembers = await db.query(`
            SELECT id, name, age, gender, relationship, occupation, annual_income,
                   is_student, is_disabled, education_level, created_at
            FROM family_members
            WHERE user_id = ?
            ORDER BY created_at ASC
        `, [userId]);

        res.json({
            success: true,
            data: familyMembers
        });
    } catch (error) {
        console.error('Family members fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch family members'
        });
    }
});

// Add new family member
router.post('/', authenticateToken, validate('familyMember'), async (req, res) => {
    try {
        const userId = req.user.userId;
        const { name, age, relationship, occupation, isStudent, hasDisability, ...otherData } = req.validatedData;

        const result = await db.run(`
            INSERT INTO family_members (
                user_id, name, age, gender, relationship, occupation, annual_income,
                is_student, is_disabled, education_level
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            userId,
            name,
            age || null,
            otherData.gender || null,
            relationship,
            occupation || null,
            otherData.annualIncome || null,
            isStudent ? 1 : 0,
            hasDisability ? 1 : 0,
            otherData.educationLevel || null
        ]);

        const familyMember = await db.get(`
            SELECT * FROM family_members WHERE id = ?
        `, [result.lastID]);

        res.status(201).json({
            success: true,
            message: 'Family member added successfully',
            data: familyMember
        });
    } catch (error) {
        console.error('Add family member error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add family member'
        });
    }
});

// Update family member
router.put('/:id', authenticateToken, validate('familyMember'), async (req, res) => {
    try {
        const userId = req.user.userId;
        const familyMemberId = req.params.id;
        const { name, age, relationship, occupation, isStudent, hasDisability, ...otherData } = req.validatedData;

        // Check if family member belongs to user
        const existingMember = await db.get(`
            SELECT id FROM family_members WHERE id = ? AND user_id = ?
        `, [familyMemberId, userId]);

        if (!existingMember) {
            return res.status(404).json({
                success: false,
                message: 'Family member not found'
            });
        }

        await db.run(`
            UPDATE family_members SET
                name = ?, age = ?, gender = ?, relationship = ?, occupation = ?,
                annual_income = ?, is_student = ?, is_disabled = ?, education_level = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
        `, [
            name,
            age || null,
            otherData.gender || null,
            relationship,
            occupation || null,
            otherData.annualIncome || null,
            isStudent ? 1 : 0,
            hasDisability ? 1 : 0,
            otherData.educationLevel || null,
            familyMemberId,
            userId
        ]);

        const updatedMember = await db.get(`
            SELECT * FROM family_members WHERE id = ?
        `, [familyMemberId]);

        res.json({
            success: true,
            message: 'Family member updated successfully',
            data: updatedMember
        });
    } catch (error) {
        console.error('Update family member error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update family member'
        });
    }
});

// Delete family member
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const familyMemberId = req.params.id;

        // Check if family member belongs to user
        const existingMember = await db.get(`
            SELECT id FROM family_members WHERE id = ? AND user_id = ?
        `, [familyMemberId, userId]);

        if (!existingMember) {
            return res.status(404).json({
                success: false,
                message: 'Family member not found'
            });
        }

        await db.run(`
            DELETE FROM family_members WHERE id = ? AND user_id = ?
        `, [familyMemberId, userId]);

        res.json({
            success: true,
            message: 'Family member deleted successfully'
        });
    } catch (error) {
        console.error('Delete family member error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete family member'
        });
    }
});

module.exports = router;