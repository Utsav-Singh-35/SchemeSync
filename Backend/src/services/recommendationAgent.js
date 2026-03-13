/**
 * Scheme Recommendation Agent
 * Scores and ranks schemes for a user based on their full profile,
 * family data, location, occupation, and eligibility signals.
 */

const { getDatabase } = require('../database/connection');

class RecommendationAgent {
    constructor() {
        this.db = getDatabase();
    }

    async getUserProfile(userId) {
        return this.db.get(`
            SELECT u.id, u.name, u.email,
                   up.age, up.gender, up.annual_income, up.occupation,
                   up.employment_status, up.state, up.district, up.category,
                   up.religion, up.is_student, up.is_farmer, up.is_disabled,
                   up.disability_percentage, up.is_widow, up.is_senior_citizen,
                   up.family_size, up.marital_status, up.phone_number
            FROM users u
            LEFT JOIN user_profiles up ON u.id = up.user_id
            WHERE u.id = ?
        `, [userId]);
    }

    async getFamilyMembers(userId) {
        return this.db.query(
            `SELECT * FROM family_members WHERE user_id = ?`, [userId]
        );
    }

    async getSavedSchemeIds(userId) {
        const rows = await this.db.query(
            `SELECT scheme_id FROM saved_schemes WHERE user_id = ?`, [userId]
        );
        return new Set(rows.map(r => r.scheme_id));
    }

    async getAllActiveSchemes() {
        return this.db.query(
            `SELECT * FROM schemes WHERE is_active = 1 ORDER BY last_updated DESC`
        );
    }

    /**
     * Main entry point — returns ranked recommended schemes for a user
     */
    async getRecommendations(userId, limit = 10) {
        const profile = await this.getUserProfile(userId);
        if (!profile) throw new Error('User profile not found');

        const [family, savedIds, schemes] = await Promise.all([
            this.getFamilyMembers(userId),
            this.getSavedSchemeIds(userId),
            this.getAllActiveSchemes()
        ]);

        const scored = schemes
            .map(scheme => this.scoreScheme(profile, family, scheme, savedIds))
            .filter(r => r.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);

        return {
            recommendations: scored,
            profileCompleteness: this.profileCompleteness(profile),
            totalEvaluated: schemes.length
        };
    }

    /**
     * Score a single scheme against the user profile.
     * Returns { scheme, score, reasons, matchedOn }
     */
    scoreScheme(profile, family, scheme, savedIds) {
        let score = 0;
        const reasons = [];
        const matchedOn = [];

        const tags = this.parseJSON(scheme.tags, []);
        const beneficiaries = this.parseJSON(scheme.target_beneficiaries, []);
        const categories = this.parseJSON(scheme.scheme_category, []);
        const eligibilityText = (
            (scheme.eligibility_criteria || '') + ' ' +
            (scheme.eligibility_criteria_md || '') + ' ' +
            (scheme.brief_description || '') + ' ' +
            (scheme.detailed_description || '')
        ).toLowerCase();

        // --- Age matching ---
        if (profile.age) {
            const ageMin = this.extractNumber(eligibilityText, /minimum age[:\s]+(\d+)/i) ||
                           this.extractNumber(eligibilityText, /age above[:\s]+(\d+)/i) ||
                           this.extractNumber(eligibilityText, /(\d+)\s*years? and above/i);
            const ageMax = this.extractNumber(eligibilityText, /maximum age[:\s]+(\d+)/i) ||
                           this.extractNumber(eligibilityText, /age below[:\s]+(\d+)/i) ||
                           this.extractNumber(eligibilityText, /below (\d+)\s*years/i) ||
                           this.extractNumber(eligibilityText, /upto (\d+)\s*years/i);

            if (ageMin && ageMax) {
                if (profile.age >= ageMin && profile.age <= ageMax) {
                    score += 25;
                    matchedOn.push('age');
                    reasons.push(`Age ${profile.age} fits ${ageMin}–${ageMax} range`);
                } else {
                    score -= 20; // hard mismatch
                }
            } else if (ageMin && profile.age >= ageMin) {
                score += 15;
                matchedOn.push('age');
            } else if (ageMax && profile.age <= ageMax) {
                score += 15;
                matchedOn.push('age');
            }
        }

        // --- Income matching ---
        if (profile.annual_income != null) {
            const incomeMax = this.extractNumber(eligibilityText, /annual income[^₹\d]*(?:₹|rs\.?|inr)?\s*([\d,]+)/i) ||
                              this.extractNumber(eligibilityText, /income[^₹\d]*(?:below|less than|not exceed)[^₹\d]*(?:₹|rs\.?|inr)?\s*([\d,]+)/i);
            if (incomeMax) {
                if (profile.annual_income <= incomeMax) {
                    score += 20;
                    matchedOn.push('income');
                    reasons.push(`Income ₹${profile.annual_income.toLocaleString()} within limit`);
                } else {
                    score -= 15;
                }
            } else if (eligibilityText.includes('bpl') || eligibilityText.includes('below poverty')) {
                if (profile.annual_income < 100000) {
                    score += 20;
                    matchedOn.push('income');
                    reasons.push('Matches BPL income criteria');
                }
            }
        }

        // --- Gender matching ---
        if (profile.gender) {
            const g = profile.gender.toLowerCase();
            if (eligibilityText.includes('women') || eligibilityText.includes('female') || eligibilityText.includes('girl')) {
                if (g === 'female') { score += 20; matchedOn.push('gender'); reasons.push('Scheme for women'); }
                else score -= 25;
            } else if (eligibilityText.includes('men only') || eligibilityText.includes('male only')) {
                if (g === 'male') { score += 10; matchedOn.push('gender'); }
                else score -= 25;
            } else {
                score += 5; // gender neutral
            }
        }

        // --- Category (caste) matching ---
        if (profile.category) {
            const cat = profile.category.toLowerCase();
            const catKeywords = { sc: ['sc', 'scheduled caste'], st: ['st', 'scheduled tribe'], obc: ['obc', 'other backward'], ews: ['ews', 'economically weaker'] };
            const userCatWords = catKeywords[cat] || [];
            const catMatch = userCatWords.some(kw => eligibilityText.includes(kw));
            const allCastes = eligibilityText.includes('all categories') || eligibilityText.includes('all caste');

            if (catMatch) { score += 20; matchedOn.push('category'); reasons.push(`Targets ${cat.toUpperCase()} category`); }
            else if (allCastes) { score += 5; }
        }

        // --- State matching ---
        if (profile.state) {
            const stateText = profile.state.toLowerCase();
            if (scheme.level === 'central' || !scheme.state || scheme.state === 'All States') {
                score += 10; // central schemes apply everywhere
            } else if (eligibilityText.includes(stateText) || (scheme.state || '').toLowerCase().includes(stateText)) {
                score += 20; matchedOn.push('state'); reasons.push(`Available in ${profile.state}`);
            } else if (scheme.level === 'state') {
                score -= 15; // state scheme for different state
            }
        }

        // --- Occupation / status flags ---
        if (profile.is_student) {
            if (eligibilityText.includes('student') || eligibilityText.includes('scholarship') || eligibilityText.includes('education')) {
                score += 25; matchedOn.push('student'); reasons.push('Scheme for students');
            }
        }
        if (profile.is_farmer) {
            if (eligibilityText.includes('farmer') || eligibilityText.includes('agriculture') || eligibilityText.includes('kisan')) {
                score += 25; matchedOn.push('farmer'); reasons.push('Scheme for farmers');
            }
        }
        if (profile.is_disabled) {
            if (eligibilityText.includes('disabled') || eligibilityText.includes('disability') || eligibilityText.includes('divyang') || eligibilityText.includes('handicap')) {
                score += 25; matchedOn.push('disability'); reasons.push('Scheme for persons with disability');
            }
        }
        if (profile.is_senior_citizen) {
            if (eligibilityText.includes('senior citizen') || eligibilityText.includes('elderly') || eligibilityText.includes('old age') || eligibilityText.includes('pension')) {
                score += 25; matchedOn.push('senior'); reasons.push('Scheme for senior citizens');
            }
        }
        if (profile.is_widow) {
            if (eligibilityText.includes('widow') || eligibilityText.includes('widowed')) {
                score += 25; matchedOn.push('widow'); reasons.push('Scheme for widows');
            }
        }

        // --- Occupation text match ---
        if (profile.occupation) {
            const occ = profile.occupation.toLowerCase();
            if (eligibilityText.includes(occ)) {
                score += 15; matchedOn.push('occupation'); reasons.push(`Matches occupation: ${profile.occupation}`);
            }
        }

        // --- Beneficiary tag matching ---
        const beneficiaryStr = beneficiaries.join(' ').toLowerCase();
        if (profile.is_student && beneficiaryStr.includes('student')) { score += 10; }
        if (profile.is_farmer && beneficiaryStr.includes('farmer')) { score += 10; }
        if (profile.gender === 'female' && beneficiaryStr.includes('women')) { score += 10; }
        if (profile.is_senior_citizen && beneficiaryStr.includes('senior')) { score += 10; }
        if (profile.is_disabled && (beneficiaryStr.includes('disabled') || beneficiaryStr.includes('divyang'))) { score += 10; }

        // --- Family members boost ---
        if (family.length > 0) {
            const hasStudentChild = family.some(m => m.is_student && (m.relationship === 'child' || m.age < 25));
            if (hasStudentChild && (eligibilityText.includes('scholarship') || eligibilityText.includes('student'))) {
                score += 10; reasons.push('Child in family is a student');
            }
            const hasDisabledMember = family.some(m => m.is_disabled);
            if (hasDisabledMember && eligibilityText.includes('disabled')) {
                score += 10; reasons.push('Family member with disability');
            }
        }

        // --- Saved scheme penalty (already saved, deprioritize) ---
        if (savedIds.has(scheme.id)) {
            score -= 5;
        }

        // --- Base score for any active scheme ---
        if (score > 0) score += 5;

        return {
            scheme,
            score: Math.max(0, score),
            reasons: reasons.slice(0, 3), // top 3 reasons
            matchedOn
        };
    }

    profileCompleteness(profile) {
        const fields = ['age', 'gender', 'annual_income', 'occupation', 'state', 'district', 'category', 'marital_status', 'family_size', 'phone_number'];
        const filled = fields.filter(f => profile[f] != null && profile[f] !== '').length;
        return Math.round((filled / fields.length) * 100);
    }

    parseJSON(val, fallback) {
        if (val == null) return fallback;
        if (Array.isArray(val)) return val;
        try { 
            const parsed = JSON.parse(val);
            return parsed == null ? fallback : parsed;
        } catch { 
            return fallback; 
        }
    }

    extractNumber(text, regex) {
        const match = text.match(regex);
        if (!match) return null;
        return parseInt(match[1].replace(/,/g, ''), 10);
    }
}

module.exports = RecommendationAgent;
