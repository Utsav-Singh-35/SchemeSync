const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDatabase } = require('../database/connection');
const { validate } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const db = getDatabase();

// JWT secret - consistent across the app
const JWT_SECRET = process.env.JWT_SECRET || 'dev-fallback-secret-change-in-production';

// Register new user
router.post('/register', validate('register'), async (req, res) => {
    try {
        const { email, password, name, ...profileData } = req.validatedData;

        // Check if user already exists
        const existingUser = await db.get('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User already exists with this email'
            });
        }

        // Hash password
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Create user
        const result = await db.run(`
            INSERT INTO users (email, password_hash, name)
            VALUES (?, ?, ?)
        `, [email, passwordHash, name]);

        const userId = result.id;

        // Create user profile if additional data provided
        if (Object.keys(profileData).length > 0) {
            const profileFields = ['user_id'];
            const profileValues = [userId];
            
            // Map profile data to correct column names
            const fieldMapping = {
                age: 'age',
                gender: 'gender',
                date_of_birth: 'date_of_birth',
                annual_income: 'annual_income',
                occupation: 'occupation',
                employment_status: 'employment_status',
                state: 'state',
                district: 'district',
                address: 'address',
                pin_code: 'pin_code',
                category: 'category',
                religion: 'religion',
                is_student: 'is_student',
                is_farmer: 'is_farmer',
                is_disabled: 'is_disabled',
                disability_percentage: 'disability_percentage',
                is_widow: 'is_widow',
                is_senior_citizen: 'is_senior_citizen',
                family_size: 'family_size',
                marital_status: 'marital_status',
                phone_number: 'phone_number'
            };
            
            Object.entries(profileData).forEach(([key, value]) => {
                if (value !== undefined && value !== null && fieldMapping[key]) {
                    profileFields.push(fieldMapping[key]);
                    profileValues.push(value);
                }
            });

            if (profileFields.length > 1) {
                const placeholders = profileFields.map(() => '?').join(', ');
                await db.run(`
                    INSERT INTO user_profiles (${profileFields.join(', ')})
                    VALUES (${placeholders})
                `, profileValues);
            }
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId, email, name },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: {
                user: { id: userId, email, name },
                token
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Registration failed'
        });
    }
});

// Login user
router.post('/login', validate('login'), async (req, res) => {
    try {
        const { email, password } = req.validatedData;

        // Find user
        const user = await db.get(`
            SELECT id, email, name, password_hash 
            FROM users 
            WHERE email = ?
        `, [email]);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: user.id, email: user.email, name: user.name },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            message: 'Login successful',
            data: {
                user: { id: user.id, email: user.email, name: user.name },
                token
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed'
        });
    }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;

        // Get user with profile
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

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get family members
        const familyMembers = await db.query(`
            SELECT id, name, age, gender, relationship, occupation, annual_income,
                   is_student, is_disabled, education_level
            FROM family_members
            WHERE user_id = ?
        `, [userId]);

        res.json({
            success: true,
            data: {
                user,
                familyMembers
            }
        });
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch profile'
        });
    }
});

// Update user profile
router.put('/profile', authenticateToken, validate('profileUpdate'), async (req, res) => {
    try {
        const userId = req.user.userId;
        const profileData = req.validatedData;
        
        console.log('📝 Profile update request for user:', userId);
        console.log('📦 Validated data:', profileData);

        // Check if profile exists
        const existingProfile = await db.get('SELECT id FROM user_profiles WHERE user_id = ?', [userId]);

        if (existingProfile) {
            // Update existing profile
            const updateFields = [];
            const updateValues = [];
            
            Object.entries(profileData).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    updateFields.push(`${key} = ?`);
                    updateValues.push(value);
                }
            });

            if (updateFields.length > 0) {
                updateValues.push(userId);
                const query = `
                    UPDATE user_profiles 
                    SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = ?
                `;
                console.log('🔄 Update query:', query);
                console.log('🔄 Update values:', updateValues);
                
                const result = await db.run(query, updateValues);
                console.log('✅ Update result:', result);
            }
        } else {
            // Create new profile
            const profileFields = ['user_id'];
            const profileValues = [userId];
            
            Object.entries(profileData).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    profileFields.push(key);
                    profileValues.push(value);
                }
            });

            const query = `
                INSERT INTO user_profiles (${profileFields.join(', ')})
                VALUES (${profileFields.map(() => '?').join(', ')})
            `;
            console.log('➕ Insert query:', query);
            console.log('➕ Insert values:', profileValues);
            
            await db.run(query, profileValues);
        }

        res.json({
            success: true,
            message: 'Profile updated successfully'
        });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update profile'
        });
    }
});

// Change password
router.put('/password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.userId;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Current password and new password are required'
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 8 characters long'
            });
        }

        // Get current password hash
        const user = await db.get('SELECT password_hash FROM users WHERE id = ?', [userId]);
        
        // Verify current password
        const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Hash new password
        const saltRounds = 12;
        const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

        // Update password
        await db.run(`
            UPDATE users 
            SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [newPasswordHash, userId]);

        res.json({
            success: true,
            message: 'Password updated successfully'
        });
    } catch (error) {
        console.error('Password update error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update password'
        });
    }
});

module.exports = router;