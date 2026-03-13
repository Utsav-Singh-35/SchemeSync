const Joi = require('joi');

// Validation schemas
const schemas = {
    register: Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().min(8).required(),
        name: Joi.string().min(2).max(100).required(),
        age: Joi.number().integer().min(0).max(120).optional(),
        date_of_birth: Joi.date().max('now').optional(),
        gender: Joi.string().valid('male', 'female', 'other').optional(),
        occupation: Joi.string().max(100).optional(),
        annual_income: Joi.number().integer().min(0).optional(),
        address: Joi.string().max(500).optional(),
        district: Joi.string().max(100).optional(),
        state: Joi.string().max(100).optional(),
        category: Joi.string().valid('general', 'obc', 'sc', 'st', 'ews').optional(),
        is_student: Joi.boolean().optional(),
        is_farmer: Joi.boolean().optional(),
        is_disabled: Joi.boolean().optional(),
        phone_number: Joi.string().pattern(/^[0-9+\-\s()]+$/).optional()
    }),

    login: Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().required()
    }),

    profileUpdate: Joi.object({
        name: Joi.string().min(2).max(100).optional(),
        dateOfBirth: Joi.date().max('now').optional(),
        gender: Joi.string().valid('male', 'female', 'other').optional(),
        occupation: Joi.string().max(100).optional(),
        annualIncome: Joi.number().integer().min(0).optional(),
        address: Joi.string().max(500).optional(),
        district: Joi.string().max(100).optional(),
        state: Joi.string().max(100).optional(),
        phoneNumber: Joi.string().pattern(/^[0-9+\-\s()]+$/).optional()
    }),

    familyMember: Joi.object({
        name: Joi.string().min(2).max(100).required(),
        age: Joi.number().integer().min(0).max(120).optional(),
        relationship: Joi.string().valid('self', 'spouse', 'child', 'parent', 'grandparent', 'dependent').required(),
        occupation: Joi.string().max(100).optional(),
        isStudent: Joi.boolean().optional(),
        hasDisability: Joi.boolean().optional()
    }),

    schemeSearch: Joi.object({
        query: Joi.string().min(1).max(200).optional(),
        category: Joi.string().max(50).optional(),
        limit: Joi.number().integer().min(1).max(100).default(20),
        offset: Joi.number().integer().min(0).default(0)
    }),

    application: Joi.object({
        schemeId: Joi.number().integer().required(),
        applicationDate: Joi.date().max('now').required(),
        acknowledgmentNumber: Joi.string().max(100).optional(),
        portalUrl: Joi.string().uri().optional(),
        notes: Joi.string().max(1000).optional()
    })
};

// Validation middleware factory
const validate = (schemaName) => {
    return (req, res, next) => {
        const schema = schemas[schemaName];
        if (!schema) {
            return res.status(500).json({
                success: false,
                message: 'Validation schema not found'
            });
        }

        const { error, value } = schema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));

            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors
            });
        }

        req.validatedData = value;
        next();
    };
};

// Query parameter validation
const validateQuery = (schemaName) => {
    return (req, res, next) => {
        const schema = schemas[schemaName];
        if (!schema) {
            return res.status(500).json({
                success: false,
                message: 'Validation schema not found'
            });
        }

        const { error, value } = schema.validate(req.query, {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));

            return res.status(400).json({
                success: false,
                message: 'Query validation failed',
                errors
            });
        }

        req.validatedQuery = value;
        next();
    };
};

module.exports = {
    validate,
    validateQuery,
    schemas
};