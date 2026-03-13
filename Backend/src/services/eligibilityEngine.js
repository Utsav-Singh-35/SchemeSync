const { getDatabase } = require('../database/connection');

class EligibilityEngine {
    constructor() {
        this.db = getDatabase();
    }

    async evaluateUserEligibility(userId, schemeId = null) {
        // Get user profile and family members
        const user = await this.getUserProfile(userId);
        const familyMembers = await this.getFamilyMembers(userId);
        
        // Get schemes to evaluate
        const schemes = schemeId 
            ? [await this.getScheme(schemeId)]
            : await this.getAllActiveSchemes();

        const results = [];

        for (const scheme of schemes) {
            const eligibility = await this.evaluateSchemeEligibility(user, familyMembers, scheme);
            results.push({
                scheme,
                eligibility
            });
        }

        return results;
    }

    async evaluateSchemeEligibility(user, familyMembers, scheme) {
        try {
            // Get eligibility tags for the scheme
            const eligibilityTags = await this.db.query(
                'SELECT tag_type, tag_value FROM eligibility_tags WHERE scheme_id = ?',
                [scheme.id]
            );

            const evaluation = {
                status: 'eligible', // eligible, likely_eligible, not_eligible, unknown
                score: 100,
                reasons: [],
                missingInfo: []
            };

            // Evaluate each eligibility criterion
            for (const tag of eligibilityTags) {
                const result = this.evaluateTag(user, familyMembers, tag);
                
                if (result.status === 'not_eligible') {
                    evaluation.status = 'not_eligible';
                    evaluation.score = 0;
                    evaluation.reasons.push(result.reason);
                    break; // No need to check further if already not eligible
                } else if (result.status === 'unknown') {
                    if (evaluation.status === 'eligible') {
                        evaluation.status = 'unknown';
                    }
                    evaluation.missingInfo.push(result.missingInfo);
                    evaluation.score -= 20;
                } else if (result.status === 'likely') {
                    if (evaluation.status === 'eligible') {
                        evaluation.status = 'likely_eligible';
                    }
                    evaluation.score -= 10;
                }

                if (result.reason) {
                    evaluation.reasons.push(result.reason);
                }
            }

            // If no specific tags, do text-based evaluation
            if (eligibilityTags.length === 0 && scheme.eligibility_text) {
                const textEvaluation = this.evaluateEligibilityText(user, familyMembers, scheme.eligibility_text);
                evaluation.status = textEvaluation.status;
                evaluation.reasons = textEvaluation.reasons;
                evaluation.score = textEvaluation.score;
            }

            return evaluation;
        } catch (error) {
            console.error('Error evaluating eligibility:', error);
            return {
                status: 'unknown',
                score: 0,
                reasons: ['Error evaluating eligibility'],
                missingInfo: []
            };
        }
    }

    evaluateTag(user, familyMembers, tag) {
        const { tag_type, tag_value } = tag;

        switch (tag_type) {
            case 'age_min':
                return this.evaluateAgeMin(user, familyMembers, parseInt(tag_value));
            case 'age_max':
                return this.evaluateAgeMax(user, familyMembers, parseInt(tag_value));
            case 'income_limit':
                return this.evaluateIncomeLimit(user, parseInt(tag_value));
            case 'student_required':
                return this.evaluateStudentRequired(user, familyMembers, tag_value === 'true');
            case 'farmer_required':
                return this.evaluateFarmerRequired(user, familyMembers);
            case 'disability_required':
                return this.evaluateDisabilityRequired(user, familyMembers, tag_value === 'true');
            case 'gender_required':
                return this.evaluateGenderRequired(user, tag_value);
            case 'state_required':
                return this.evaluateStateRequired(user, tag_value);
            default:
                return { status: 'unknown', reason: `Unknown tag type: ${tag_type}` };
        }
    }

    evaluateAgeMin(user, familyMembers, minAge) {
        if (!user.date_of_birth) {
            return {
                status: 'unknown',
                missingInfo: 'Date of birth required'
            };
        }

        const userAge = this.calculateAge(user.date_of_birth);
        if (userAge >= minAge) {
            return {
                status: 'eligible',
                reason: `Age requirement met (${userAge} >= ${minAge})`
            };
        }

        // Check family members
        for (const member of familyMembers) {
            if (member.age && member.age >= minAge) {
                return {
                    status: 'eligible',
                    reason: `Family member meets age requirement (${member.age} >= ${minAge})`
                };
            }
        }

        return {
            status: 'not_eligible',
            reason: `Age requirement not met (minimum ${minAge} years)`
        };
    }

    evaluateAgeMax(user, familyMembers, maxAge) {
        if (!user.date_of_birth) {
            return {
                status: 'unknown',
                missingInfo: 'Date of birth required'
            };
        }

        const userAge = this.calculateAge(user.date_of_birth);
        if (userAge <= maxAge) {
            return {
                status: 'eligible',
                reason: `Age requirement met (${userAge} <= ${maxAge})`
            };
        }

        return {
            status: 'not_eligible',
            reason: `Age requirement not met (maximum ${maxAge} years)`
        };
    }

    evaluateIncomeLimit(user, incomeLimit) {
        if (!user.annual_income) {
            return {
                status: 'unknown',
                missingInfo: 'Annual income information required'
            };
        }

        if (user.annual_income <= incomeLimit) {
            return {
                status: 'eligible',
                reason: `Income requirement met (₹${user.annual_income} <= ₹${incomeLimit})`
            };
        }

        return {
            status: 'not_eligible',
            reason: `Income exceeds limit (₹${user.annual_income} > ₹${incomeLimit})`
        };
    }

    evaluateStudentRequired(user, familyMembers, required) {
        if (!required) return { status: 'eligible' };

        // Check if user or any family member is a student
        const hasStudent = familyMembers.some(member => member.is_student);
        
        if (hasStudent) {
            return {
                status: 'eligible',
                reason: 'Student requirement met'
            };
        }

        return {
            status: 'not_eligible',
            reason: 'Student requirement not met'
        };
    }

    evaluateFarmerRequired(user, familyMembers) {
        const farmerOccupations = ['farmer', 'agriculture', 'farming', 'agricultural worker'];
        
        // Check user occupation
        if (user.occupation && farmerOccupations.some(occ => 
            user.occupation.toLowerCase().includes(occ))) {
            return {
                status: 'eligible',
                reason: 'Farmer requirement met'
            };
        }

        // Check family members
        for (const member of familyMembers) {
            if (member.occupation && farmerOccupations.some(occ => 
                member.occupation.toLowerCase().includes(occ))) {
                return {
                    status: 'eligible',
                    reason: 'Family member meets farmer requirement'
                };
            }
        }

        return {
            status: 'likely',
            reason: 'Farmer status unclear from occupation data'
        };
    }

    evaluateDisabilityRequired(user, familyMembers, required) {
        if (!required) return { status: 'eligible' };

        const hasDisability = familyMembers.some(member => member.has_disability);
        
        if (hasDisability) {
            return {
                status: 'eligible',
                reason: 'Disability requirement met'
            };
        }

        return {
            status: 'not_eligible',
            reason: 'Disability requirement not met'
        };
    }

    evaluateGenderRequired(user, requiredGender) {
        if (!user.gender) {
            return {
                status: 'unknown',
                missingInfo: 'Gender information required'
            };
        }

        if (user.gender === requiredGender) {
            return {
                status: 'eligible',
                reason: `Gender requirement met (${requiredGender})`
            };
        }

        return {
            status: 'not_eligible',
            reason: `Gender requirement not met (requires ${requiredGender})`
        };
    }

    evaluateStateRequired(user, requiredState) {
        if (!user.state) {
            return {
                status: 'unknown',
                missingInfo: 'State information required'
            };
        }

        if (user.state.toLowerCase() === requiredState.toLowerCase()) {
            return {
                status: 'eligible',
                reason: `State requirement met (${requiredState})`
            };
        }

        return {
            status: 'not_eligible',
            reason: `State requirement not met (requires ${requiredState})`
        };
    }

    evaluateEligibilityText(user, familyMembers, eligibilityText) {
        // Simple keyword-based evaluation for schemes without structured tags
        const text = eligibilityText.toLowerCase();
        const reasons = [];
        let score = 50; // Start with neutral score

        // Age-based checks
        if (text.includes('age') && user.date_of_birth) {
            const userAge = this.calculateAge(user.date_of_birth);
            reasons.push(`User age: ${userAge} years`);
        }

        // Income-based checks
        if (text.includes('income') || text.includes('bpl') || text.includes('poverty')) {
            if (user.annual_income) {
                if (user.annual_income < 200000) { // Rough BPL threshold
                    score += 20;
                    reasons.push('Income appears to meet criteria');
                } else {
                    score -= 20;
                    reasons.push('Income may exceed criteria');
                }
            }
        }

        // Occupation-based checks
        if (text.includes('farmer') || text.includes('agriculture')) {
            if (user.occupation && user.occupation.toLowerCase().includes('farm')) {
                score += 20;
                reasons.push('Occupation matches scheme focus');
            }
        }

        let status = 'unknown';
        if (score >= 70) status = 'likely_eligible';
        else if (score >= 40) status = 'unknown';
        else status = 'not_eligible';

        return { status, score, reasons };
    }

    calculateAge(dateOfBirth) {
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
            SELECT * FROM users WHERE id = ?
        `, [userId]);
    }

    async getFamilyMembers(userId) {
        return await this.db.query(`
            SELECT * FROM family_members WHERE user_id = ?
        `, [userId]);
    }

    async getScheme(schemeId) {
        return await this.db.get(`
            SELECT * FROM schemes WHERE id = ? AND is_active = 1
        `, [schemeId]);
    }

    async getAllActiveSchemes() {
        return await this.db.query(`
            SELECT * FROM schemes WHERE is_active = 1
            ORDER BY last_updated DESC
        `);
    }
}

module.exports = EligibilityEngine;