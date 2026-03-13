/**
 * Comprehensive Eligibility Engine
 * Updated to work with the comprehensive scheme data and user profile structure
 */

const { getDatabase } = require('../database/connection');

class ComprehensiveEligibilityEngine {
    constructor() {
        this.db = getDatabase();
    }

    /**
     * Evaluate user eligibility for schemes
     * @param {number} userId - User ID
     * @param {string[]} schemeIds - Optional array of specific scheme IDs to evaluate
     * @returns {Promise<Array>} Array of eligibility results
     */
    async evaluateUserEligibility(userId, schemeIds = null) {
        try {
            // Get user profile and family members
            const userProfile = await this.getUserProfile(userId);
            if (!userProfile) {
                throw new Error('User profile not found');
            }

            const familyMembers = await this.getFamilyMembers(userId);

            // Get schemes to evaluate
            let schemes;
            if (schemeIds && schemeIds.length > 0) {
                const placeholders = schemeIds.map(() => '?').join(',');
                schemes = await this.db.query(`
                    SELECT * FROM schemes 
                    WHERE id IN (${placeholders}) AND is_active = 1
                `, schemeIds);
            } else {
                schemes = await this.getAllActiveSchemes();
            }

            // Evaluate each scheme
            const results = [];
            for (const scheme of schemes) {
                const eligibility = await this.evaluateSchemeEligibility(userProfile, familyMembers, scheme);
                results.push({
                    scheme_id: scheme.id,
                    scheme: scheme,
                    eligibility: eligibility
                });
            }

            return results;
        } catch (error) {
            console.error('Eligibility evaluation error:', error);
            throw error;
        }
    }

    /**
     * Evaluate eligibility for a specific scheme
     * @param {Object} userProfile - User profile data
     * @param {Array} familyMembers - Family members data
     * @param {Object} scheme - Scheme data
     * @returns {Promise<Object>} Eligibility result
     */
    async evaluateSchemeEligibility(userProfile, familyMembers, scheme) {
        const eligibility = {
            status: 'eligible', // eligible, not_eligible, likely_eligible, insufficient_data
            score: 100,
            matchedCriteria: [],
            failedCriteria: [],
            missingData: [],
            recommendations: []
        };

        try {
            // Get parsed eligibility criteria for this scheme
            const criteria = await this.db.query(`
                SELECT * FROM eligibility_criteria WHERE scheme_id = ?
            `, [scheme.id]);

            // If no structured criteria, fall back to text analysis
            if (criteria.length === 0) {
                return this.evaluateEligibilityText(userProfile, familyMembers, scheme);
            }

            // Evaluate each criterion
            for (const criterion of criteria) {
                const result = this.evaluateCriterion(userProfile, familyMembers, criterion);
                
                if (result.status === 'matched') {
                    eligibility.matchedCriteria.push(result);
                } else if (result.status === 'failed') {
                    eligibility.failedCriteria.push(result);
                    if (criterion.is_mandatory) {
                        eligibility.status = 'not_eligible';
                        eligibility.score = Math.max(0, eligibility.score - 30);
                    } else {
                        eligibility.score = Math.max(0, eligibility.score - 10);
                    }
                } else if (result.status === 'missing_data') {
                    eligibility.missingData.push(result);
                    eligibility.score = Math.max(0, eligibility.score - 5);
                }
            }

            // Determine final status
            if (eligibility.failedCriteria.some(c => c.mandatory)) {
                eligibility.status = 'not_eligible';
            } else if (eligibility.missingData.length > 0) {
                eligibility.status = 'insufficient_data';
            } else if (eligibility.score >= 80) {
                eligibility.status = 'eligible';
            } else if (eligibility.score >= 60) {
                eligibility.status = 'likely_eligible';
            } else {
                eligibility.status = 'not_eligible';
            }

            // Generate recommendations
            this.generateRecommendations(eligibility);

            return eligibility;
        } catch (error) {
            console.error('Scheme eligibility evaluation error:', error);
            return {
                status: 'error',
                score: 0,
                error: error.message
            };
        }
    }

    /**
     * Evaluate a specific eligibility criterion
     * @param {Object} userProfile - User profile
     * @param {Array} familyMembers - Family members
     * @param {Object} criterion - Eligibility criterion
     * @returns {Object} Evaluation result
     */
    evaluateCriterion(userProfile, familyMembers, criterion) {
        const { criteria_type, criteria_value, is_mandatory } = criterion;

        switch (criteria_type) {
            case 'age_min':
                return this.evaluateAgeMin(userProfile, parseInt(criteria_value), is_mandatory);
            
            case 'age_max':
                return this.evaluateAgeMax(userProfile, parseInt(criteria_value), is_mandatory);
            
            case 'income_max':
                return this.evaluateIncomeMax(userProfile, parseInt(criteria_value), is_mandatory);
            
            case 'gender':
                return this.evaluateGender(userProfile, criteria_value, is_mandatory);
            
            case 'category':
                return this.evaluateCategory(userProfile, criteria_value, is_mandatory);
            
            case 'state':
                return this.evaluateState(userProfile, criteria_value, is_mandatory);
            
            case 'is_student':
                return this.evaluateStudentStatus(userProfile, criteria_value === 'true', is_mandatory);
            
            case 'is_farmer':
                return this.evaluateFarmerStatus(userProfile, criteria_value === 'true', is_mandatory);
            
            case 'is_disabled':
                return this.evaluateDisabilityStatus(userProfile, criteria_value === 'true', is_mandatory);
            
            case 'family_size_max':
                return this.evaluateFamilySize(userProfile, familyMembers, parseInt(criteria_value), 'less_than_equal', is_mandatory);
            
            case 'family_size_min':
                return this.evaluateFamilySize(userProfile, familyMembers, parseInt(criteria_value), 'greater_than_equal', is_mandatory);
            
            default:
                return {
                    status: 'unknown',
                    criterion: criteria_type,
                    message: `Unknown criterion type: ${criteria_type}`,
                    mandatory: is_mandatory
                };
        }
    }

    evaluateAgeMin(userProfile, minAge, mandatory) {
        if (!userProfile.age && !userProfile.date_of_birth) {
            return {
                status: 'missing_data',
                criterion: 'age_min',
                required: minAge,
                message: 'Age or date of birth required',
                mandatory
            };
        }

        const userAge = userProfile.age || this.calculateAge(userProfile.date_of_birth);
        const passed = userAge >= minAge;

        return {
            status: passed ? 'matched' : 'failed',
            criterion: 'age_min',
            required: minAge,
            actual: userAge,
            message: passed ? `Age requirement met (${userAge} >= ${minAge})` : `Age requirement not met (${userAge} < ${minAge})`,
            mandatory
        };
    }

    evaluateAgeMax(userProfile, maxAge, mandatory) {
        if (!userProfile.age && !userProfile.date_of_birth) {
            return {
                status: 'missing_data',
                criterion: 'age_max',
                required: maxAge,
                message: 'Age or date of birth required',
                mandatory
            };
        }

        const userAge = userProfile.age || this.calculateAge(userProfile.date_of_birth);
        const passed = userAge <= maxAge;

        return {
            status: passed ? 'matched' : 'failed',
            criterion: 'age_max',
            required: maxAge,
            actual: userAge,
            message: passed ? `Age requirement met (${userAge} <= ${maxAge})` : `Age requirement not met (${userAge} > ${maxAge})`,
            mandatory
        };
    }

    evaluateIncomeMax(userProfile, maxIncome, mandatory) {
        if (!userProfile.annual_income) {
            return {
                status: 'missing_data',
                criterion: 'income_max',
                required: maxIncome,
                message: 'Annual income required',
                mandatory
            };
        }

        const passed = userProfile.annual_income <= maxIncome;

        return {
            status: passed ? 'matched' : 'failed',
            criterion: 'income_max',
            required: maxIncome,
            actual: userProfile.annual_income,
            message: passed ? `Income requirement met (₹${userProfile.annual_income} <= ₹${maxIncome})` : `Income too high (₹${userProfile.annual_income} > ₹${maxIncome})`,
            mandatory
        };
    }

    evaluateGender(userProfile, requiredGender, mandatory) {
        if (!userProfile.gender) {
            return {
                status: 'missing_data',
                criterion: 'gender',
                required: requiredGender,
                message: 'Gender information required',
                mandatory
            };
        }

        const passed = userProfile.gender.toLowerCase() === requiredGender.toLowerCase();

        return {
            status: passed ? 'matched' : 'failed',
            criterion: 'gender',
            required: requiredGender,
            actual: userProfile.gender,
            message: passed ? `Gender requirement met` : `Gender requirement not met (required: ${requiredGender})`,
            mandatory
        };
    }

    evaluateCategory(userProfile, requiredCategory, mandatory) {
        if (!userProfile.category) {
            return {
                status: 'missing_data',
                criterion: 'category',
                required: requiredCategory,
                message: 'Category information required',
                mandatory
            };
        }

        const passed = userProfile.category.toLowerCase() === requiredCategory.toLowerCase();

        return {
            status: passed ? 'matched' : 'failed',
            criterion: 'category',
            required: requiredCategory,
            actual: userProfile.category,
            message: passed ? `Category requirement met` : `Category requirement not met (required: ${requiredCategory})`,
            mandatory
        };
    }

    evaluateState(userProfile, requiredState, mandatory) {
        if (!userProfile.state) {
            return {
                status: 'missing_data',
                criterion: 'state',
                required: requiredState,
                message: 'State information required',
                mandatory
            };
        }

        const passed = userProfile.state.toLowerCase() === requiredState.toLowerCase();

        return {
            status: passed ? 'matched' : 'failed',
            criterion: 'state',
            required: requiredState,
            actual: userProfile.state,
            message: passed ? `State requirement met` : `State requirement not met (required: ${requiredState})`,
            mandatory
        };
    }

    evaluateStudentStatus(userProfile, required, mandatory) {
        const isStudent = userProfile.is_student || userProfile.employment_status === 'student';
        const passed = isStudent === required;

        return {
            status: passed ? 'matched' : 'failed',
            criterion: 'is_student',
            required: required,
            actual: isStudent,
            message: passed ? `Student status requirement met` : `Student status requirement not met`,
            mandatory
        };
    }

    evaluateFarmerStatus(userProfile, required, mandatory) {
        const passed = userProfile.is_farmer === required;

        return {
            status: passed ? 'matched' : 'failed',
            criterion: 'is_farmer',
            required: required,
            actual: userProfile.is_farmer,
            message: passed ? `Farmer status requirement met` : `Farmer status requirement not met`,
            mandatory
        };
    }

    evaluateDisabilityStatus(userProfile, required, mandatory) {
        const passed = userProfile.is_disabled === required;

        return {
            status: passed ? 'matched' : 'failed',
            criterion: 'is_disabled',
            required: required,
            actual: userProfile.is_disabled,
            message: passed ? `Disability status requirement met` : `Disability status requirement not met`,
            mandatory
        };
    }

    evaluateFamilySize(userProfile, familyMembers, requiredSize, operator, mandatory) {
        const actualSize = familyMembers.length + 1; // +1 for the user
        let passed = false;

        switch (operator) {
            case 'less_than_equal':
                passed = actualSize <= requiredSize;
                break;
            case 'greater_than_equal':
                passed = actualSize >= requiredSize;
                break;
            case 'equals':
                passed = actualSize === requiredSize;
                break;
        }

        return {
            status: passed ? 'matched' : 'failed',
            criterion: 'family_size',
            required: requiredSize,
            actual: actualSize,
            message: passed ? `Family size requirement met` : `Family size requirement not met`,
            mandatory
        };
    }

    /**
     * Fallback text-based eligibility evaluation
     */
    async evaluateEligibilityText(userProfile, familyMembers, scheme) {
        const eligibility = {
            status: 'likely_eligible',
            score: 70,
            matchedCriteria: [],
            failedCriteria: [],
            missingData: [],
            recommendations: ['Complete your profile for better eligibility matching']
        };

        // Basic text analysis for common patterns
        const eligibilityText = (scheme.eligibility_criteria || '').toLowerCase();
        
        // Check age requirements
        if (eligibilityText.includes('age') && userProfile.age) {
            const ageMatch = eligibilityText.match(/(\d+)\s*(?:years?|yrs?)/);
            if (ageMatch) {
                const requiredAge = parseInt(ageMatch[1]);
                if (userProfile.age >= requiredAge) {
                    eligibility.matchedCriteria.push({
                        criterion: 'age',
                        message: `Age requirement likely met`
                    });
                } else {
                    eligibility.failedCriteria.push({
                        criterion: 'age',
                        message: `May not meet age requirement`
                    });
                    eligibility.score -= 20;
                }
            }
        }

        // Check gender requirements
        if (eligibilityText.includes('women') || eligibilityText.includes('female')) {
            if (userProfile.gender === 'female') {
                eligibility.matchedCriteria.push({
                    criterion: 'gender',
                    message: 'Gender requirement met'
                });
            } else {
                eligibility.status = 'not_eligible';
                eligibility.score = 0;
            }
        }

        return eligibility;
    }

    generateRecommendations(eligibility) {
        const recommendations = [];

        // Add recommendations based on missing data
        eligibility.missingData.forEach(missing => {
            switch (missing.criterion) {
                case 'age_min':
                case 'age_max':
                    recommendations.push('Add your date of birth to your profile');
                    break;
                case 'income_max':
                    recommendations.push('Add your annual income information');
                    break;
                case 'gender':
                    recommendations.push('Add gender information to your profile');
                    break;
                case 'category':
                    recommendations.push('Add your category (SC/ST/OBC/EWS/General) information');
                    break;
                case 'state':
                    recommendations.push('Add your state information');
                    break;
            }
        });

        // Add recommendations based on failed criteria
        eligibility.failedCriteria.forEach(failed => {
            if (!failed.mandatory) {
                recommendations.push(`Consider if you meet the ${failed.criterion} requirement`);
            }
        });

        eligibility.recommendations = [...new Set(recommendations)]; // Remove duplicates
    }

    calculateAge(dateOfBirth) {
        if (!dateOfBirth) return null;
        const today = new Date();
        const birthDate = new Date(dateOfBirth);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        
        return age;
    }

    async getUserProfile(userId) {
        return await this.db.get(`
            SELECT up.*, u.email, u.name
            FROM user_profiles up
            JOIN users u ON up.user_id = u.id
            WHERE up.user_id = ?
        `, [userId]);
    }

    async getFamilyMembers(userId) {
        return await this.db.query(`
            SELECT * FROM family_members WHERE user_id = ?
        `, [userId]);
    }

    async getAllActiveSchemes() {
        return await this.db.query(`
            SELECT * FROM schemes WHERE is_active = 1 ORDER BY last_updated DESC
        `);
    }
}

module.exports = ComprehensiveEligibilityEngine;