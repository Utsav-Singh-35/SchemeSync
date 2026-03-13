const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDatabase } = require('../database/connection');

class AuthService {
    constructor() {
        this.db = getDatabase();
        this.jwtSecret = process.env.JWT_SECRET;
        this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';
        
        // Validate JWT secret in production
        if (process.env.NODE_ENV === 'production' && (!this.jwtSecret || this.jwtSecret.length < 32)) {
            throw new Error('JWT_SECRET must be at least 32 characters in production');
        }
        
        // Fallback for development only
        if (!this.jwtSecret) {
            if (process.env.NODE_ENV === 'production') {
                throw new Error('JWT_SECRET is required in production');
            }
            console.warn('WARNING: Using fallback JWT secret in development');
            this.jwtSecret = 'dev-fallback-secret-change-in-production';
        }
    }

    async hashPassword(password) {
        const saltRounds = 12;
        return await bcrypt.hash(password, saltRounds);
    }

    async comparePassword(password, hash) {
        return await bcrypt.compare(password, hash);
    }

    generateToken(userId, email) {
        return jwt.sign(
            { userId, email },
            this.jwtSecret,
            { expiresIn: this.jwtExpiresIn }
        );
    }

    verifyToken(token) {
        try {
            return jwt.verify(token, this.jwtSecret);
        } catch (error) {
            throw new Error('Invalid token');
        }
    }

    async register(userData) {
        const { email, password, name, dateOfBirth, gender, occupation, 
                annualIncome, address, district, state, phoneNumber } = userData;

        // Check if user already exists
        const existingUser = await this.db.get(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if (existingUser) {
            throw new Error('User already exists with this email');
        }

        // Hash password
        const passwordHash = await this.hashPassword(password);

        // Insert user
        const result = await this.db.run(`
            INSERT INTO users (
                email, password_hash, name, date_of_birth, gender,
                occupation, annual_income, address, district, state, phone_number
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            email, passwordHash, name, dateOfBirth, gender,
            occupation, annualIncome, address, district, state, phoneNumber
        ]);

        // Generate token
        const token = this.generateToken(result.id, email);

        return {
            userId: result.id,
            email,
            name,
            token
        };
    }

    async login(email, password) {
        // Get user
        const user = await this.db.get(
            'SELECT id, email, password_hash, name FROM users WHERE email = ?',
            [email]
        );

        if (!user) {
            throw new Error('Invalid email or password');
        }

        // Verify password
        const isValidPassword = await this.comparePassword(password, user.password_hash);
        if (!isValidPassword) {
            throw new Error('Invalid email or password');
        }

        // Generate token
        const token = this.generateToken(user.id, user.email);

        return {
            userId: user.id,
            email: user.email,
            name: user.name,
            token
        };
    }

    async getUserById(userId) {
        const user = await this.db.get(`
            SELECT id, email, name, date_of_birth, gender, occupation,
                   annual_income, address, district, state, phone_number,
                   created_at, updated_at
            FROM users WHERE id = ?
        `, [userId]);

        if (!user) {
            throw new Error('User not found');
        }

        return user;
    }

    async updateProfile(userId, updateData) {
        const allowedFields = [
            'name', 'date_of_birth', 'gender', 'occupation',
            'annual_income', 'address', 'district', 'state', 'phone_number'
        ];

        const updates = [];
        const values = [];

        Object.keys(updateData).forEach(key => {
            if (allowedFields.includes(key) && updateData[key] !== undefined) {
                updates.push(`${key} = ?`);
                values.push(updateData[key]);
            }
        });

        if (updates.length === 0) {
            throw new Error('No valid fields to update');
        }

        values.push(userId);
        updates.push('updated_at = CURRENT_TIMESTAMP');

        const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
        await this.db.run(sql, values);

        return await this.getUserById(userId);
    }
}

module.exports = AuthService;