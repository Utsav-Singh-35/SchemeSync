const axios = require('axios');
const cheerio = require('cheerio');
const { getDatabase } = require('../database/connection');

class BaseCrawler {
    constructor() {
        this.db = getDatabase();
        this.axiosInstance = axios.create({
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
    }

    async initialize() {
        try {
            console.log('Lightweight crawler initialized successfully');
        } catch (error) {
            console.error('Failed to initialize crawler:', error);
            throw error;
        }
    }

    async cleanup() {
        // No cleanup needed for axios/cheerio
        console.log('Crawler cleanup completed');
    }

    async navigateToUrl(url, timeout = 30000) {
        try {
            const response = await this.axiosInstance.get(url, { timeout });
            this.currentHtml = response.data;
            this.$ = cheerio.load(this.currentHtml);
            console.log(`Successfully fetched: ${url}`);
            return true;
        } catch (error) {
            console.error(`Failed to fetch ${url}:`, error.message);
            return false;
        }
    }

    async extractText(selector) {
        try {
            if (!this.$) return null;
            
            const element = this.$(selector).first();
            if (element.length > 0) {
                return element.text().trim();
            }
            return null;
        } catch (error) {
            console.error(`Error extracting text from ${selector}:`, error);
            return null;
        }
    }

    async extractMultipleTexts(selector) {
        try {
            if (!this.$) return [];
            
            const texts = [];
            this.$(selector).each((i, element) => {
                const text = this.$(element).text().trim();
                if (text.length > 0) {
                    texts.push(text);
                }
            });
            return texts;
        } catch (error) {
            console.error(`Error extracting multiple texts from ${selector}:`, error);
            return [];
        }
    }

    async extractLinks(selector) {
        try {
            if (!this.$) return [];
            
            const links = [];
            this.$(selector).each((i, element) => {
                const $el = this.$(element);
                const href = $el.attr('href');
                const text = $el.text().trim();
                
                if (href && text) {
                    links.push({ text, href });
                }
            });
            return links;
        } catch (error) {
            console.error(`Error extracting links from ${selector}:`, error);
            return [];
        }
    }

    async saveScheme(schemeData) {
        try {
            // Check for duplicates
            const existingScheme = await this.checkDuplicate(schemeData);
            if (existingScheme) {
                console.log(`Scheme already exists: ${schemeData.scheme_name}`);
                return existingScheme.id;
            }

            // Insert new scheme
            const result = await this.db.run(`
                INSERT INTO schemes (
                    scheme_name, ministry, description, benefits, eligibility_text,
                    category, application_mode, official_url, last_updated
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `, [
                schemeData.scheme_name,
                schemeData.ministry,
                schemeData.description,
                schemeData.benefits,
                schemeData.eligibility_text,
                schemeData.category,
                schemeData.application_mode || 'online',
                schemeData.official_url
            ]);

            console.log(`Saved new scheme: ${schemeData.scheme_name} (ID: ${result.id})`);

            // Save eligibility tags if provided
            if (schemeData.eligibility_tags && schemeData.eligibility_tags.length > 0) {
                await this.saveEligibilityTags(result.id, schemeData.eligibility_tags);
            }

            // Save documents if provided
            if (schemeData.documents && schemeData.documents.length > 0) {
                await this.saveDocuments(result.id, schemeData.documents);
            }

            return result.id;
        } catch (error) {
            console.error('Error saving scheme:', error);
            throw error;
        }
    }

    async checkDuplicate(schemeData) {
        // Check by exact name match
        let existingScheme = await this.db.get(`
            SELECT id, scheme_name FROM schemes 
            WHERE LOWER(scheme_name) = LOWER(?)
        `, [schemeData.scheme_name]);

        if (existingScheme) {
            return existingScheme;
        }

        // Check by official URL
        if (schemeData.official_url) {
            existingScheme = await this.db.get(`
                SELECT id, scheme_name FROM schemes 
                WHERE official_url = ?
            `, [schemeData.official_url]);

            if (existingScheme) {
                return existingScheme;
            }
        }

        // Check by similar name (fuzzy matching)
        const similarSchemes = await this.db.query(`
            SELECT id, scheme_name FROM schemes 
            WHERE ministry = ? AND is_active = 1
        `, [schemeData.ministry]);

        for (const scheme of similarSchemes) {
            if (this.calculateSimilarity(schemeData.scheme_name, scheme.scheme_name) > 0.8) {
                return scheme;
            }
        }

        return null;
    }

    // Calculate string similarity using Levenshtein distance
    calculateSimilarity(str1, str2) {
        if (!str1 || !str2) return 0;
        
        const s1 = str1.toLowerCase().trim();
        const s2 = str2.toLowerCase().trim();
        
        if (s1 === s2) return 1;
        
        const longer = s1.length > s2.length ? s1 : s2;
        const shorter = s1.length > s2.length ? s2 : s1;
        
        if (longer.length === 0) return 1;
        
        const distance = this.levenshteinDistance(longer, shorter);
        return (longer.length - distance) / longer.length;
    }

    // Levenshtein distance calculation
    levenshteinDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }

    async saveEligibilityTags(schemeId, tags) {
        for (const tag of tags) {
            await this.db.run(`
                INSERT INTO eligibility_tags (scheme_id, tag_type, tag_value)
                VALUES (?, ?, ?)
            `, [schemeId, tag.type, tag.value]);
        }
    }

    async saveDocuments(schemeId, documents) {
        for (const doc of documents) {
            await this.db.run(`
                INSERT INTO scheme_documents (scheme_id, document_name, description, is_mandatory)
                VALUES (?, ?, ?, ?)
            `, [schemeId, doc.name, doc.description || '', doc.mandatory || true]);
        }
    }

    async updateCrawlerSource(sourceUrl, schemesFound) {
        await this.db.run(`
            UPDATE crawler_sources 
            SET last_crawled = CURRENT_TIMESTAMP, schemes_found = ?
            WHERE source_url = ?
        `, [schemesFound, sourceUrl]);
    }

    // Utility method to clean and normalize text
    cleanText(text) {
        if (!text) return '';
        return text
            .replace(/\s+/g, ' ')
            .replace(/\n+/g, ' ')
            .trim();
    }

    // Extract scheme category from text
    categorizeScheme(text) {
        const categories = {
            'agriculture': ['farm', 'agriculture', 'crop', 'kisan', 'rural'],
            'education': ['education', 'student', 'scholarship', 'school', 'college'],
            'health': ['health', 'medical', 'hospital', 'treatment', 'insurance'],
            'employment': ['employment', 'job', 'skill', 'training', 'rozgar'],
            'housing': ['housing', 'home', 'shelter', 'awas', 'construction'],
            'social_security': ['pension', 'widow', 'disability', 'elderly', 'social'],
            'women_child': ['women', 'child', 'mother', 'maternity', 'girl'],
            'financial': ['loan', 'credit', 'bank', 'finance', 'mudra']
        };

        const lowerText = text.toLowerCase();
        
        for (const [category, keywords] of Object.entries(categories)) {
            if (keywords.some(keyword => lowerText.includes(keyword))) {
                return category;
            }
        }
        
        return 'general';
    }

    // Extract eligibility tags from text
    extractEligibilityTags(eligibilityText) {
        const tags = [];
        const text = eligibilityText.toLowerCase();

        // Age extraction
        const ageMatch = text.match(/(\d+)\s*(?:to|-)?\s*(\d+)?\s*years?/);
        if (ageMatch) {
            if (ageMatch[2]) {
                tags.push({ type: 'age_min', value: ageMatch[1] });
                tags.push({ type: 'age_max', value: ageMatch[2] });
            } else if (text.includes('above') || text.includes('minimum')) {
                tags.push({ type: 'age_min', value: ageMatch[1] });
            } else if (text.includes('below') || text.includes('maximum')) {
                tags.push({ type: 'age_max', value: ageMatch[1] });
            }
        }

        // Income extraction
        const incomeMatch = text.match(/(?:income|earning).*?(?:below|under|less than).*?(?:rs\.?|₹)\s*(\d+(?:,\d+)*)\s*(?:lakh|lakhs?)?/);
        if (incomeMatch) {
            let amount = incomeMatch[1].replace(/,/g, '');
            if (text.includes('lakh')) {
                amount = parseInt(amount) * 100000;
            }
            tags.push({ type: 'income_limit', value: amount.toString() });
        }

        // Occupation-based tags
        if (text.includes('farmer') || text.includes('agriculture')) {
            tags.push({ type: 'farmer_required', value: 'true' });
        }
        if (text.includes('student')) {
            tags.push({ type: 'student_required', value: 'true' });
        }
        if (text.includes('rural')) {
            tags.push({ type: 'rural_required', value: 'true' });
        }
        if (text.includes('disability') || text.includes('disabled')) {
            tags.push({ type: 'disability_required', value: 'true' });
        }

        // Gender-based tags
        if (text.includes('women') || text.includes('female')) {
            tags.push({ type: 'gender_required', value: 'female' });
        }

        return tags;
    }

    // Wait for a random delay to avoid being detected as bot
    async randomDelay(min = 1000, max = 3000) {
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        await new Promise(resolve => setTimeout(resolve, delay));
    }
}

module.exports = BaseCrawler;