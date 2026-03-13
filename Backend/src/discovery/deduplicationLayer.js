const { getDatabase } = require('../database/connection');

class DeduplicationLayer {
    constructor(sharedDb = null) {
        this.db = sharedDb || getDatabase();
        this.similarityThreshold = 0.8; // 80% similarity threshold
    }

    async initialize() {
        // Only connect if we own the database connection
        if (!this.db.isConnected) {
            await this.db.connect();
        }
        console.log('Deduplication layer initialized');
    }

    async checkDuplicate(schemeData) {
        // Multi-layer duplicate detection
        const checks = [
            await this.exactNameMatch(schemeData),
            await this.urlMatch(schemeData),
            await this.ministryNameMatch(schemeData),
            await this.fuzzyNameMatch(schemeData)
        ];

        // Return first match found
        for (const match of checks) {
            if (match) {
                return match;
            }
        }

        return null;
    }

    async exactNameMatch(schemeData) {
        const existing = await this.db.get(`
            SELECT * FROM schemes 
            WHERE LOWER(TRIM(scheme_name)) = LOWER(TRIM(?))
        `, [schemeData.scheme_name]);

        if (existing) {
            console.log(`🔍 Exact name match found: ${schemeData.scheme_name}`);
            return { type: 'exact_name', existing, confidence: 1.0 };
        }

        return null;
    }

    async urlMatch(schemeData) {
        if (!schemeData.official_url) return null;

        const existing = await this.db.get(`
            SELECT * FROM schemes 
            WHERE official_url = ?
        `, [schemeData.official_url]);

        if (existing) {
            console.log(`🔍 URL match found: ${schemeData.official_url}`);
            return { type: 'url', existing, confidence: 1.0 };
        }

        return null;
    }

    async ministryNameMatch(schemeData) {
        if (!schemeData.ministry) return null;

        const existing = await this.db.get(`
            SELECT * FROM schemes 
            WHERE LOWER(ministry) = LOWER(?) 
            AND LOWER(TRIM(scheme_name)) = LOWER(TRIM(?))
        `, [schemeData.ministry, schemeData.scheme_name]);

        if (existing) {
            console.log(`🔍 Ministry + name match found: ${schemeData.ministry} - ${schemeData.scheme_name}`);
            return { type: 'ministry_name', existing, confidence: 0.95 };
        }

        return null;
    }

    async fuzzyNameMatch(schemeData) {
        // Get all schemes for fuzzy matching
        const allSchemes = await this.db.query(`
            SELECT id, scheme_name, ministry, official_url 
            FROM schemes
        `);

        for (const existing of allSchemes) {
            const similarity = this.calculateSimilarity(
                schemeData.scheme_name.toLowerCase(),
                existing.scheme_name.toLowerCase()
            );

            if (similarity >= this.similarityThreshold) {
                console.log(`🔍 Fuzzy match found: ${schemeData.scheme_name} ≈ ${existing.scheme_name} (${(similarity * 100).toFixed(1)}%)`);
                return { type: 'fuzzy_name', existing, confidence: similarity };
            }
        }

        return null;
    }

    calculateSimilarity(str1, str2) {
        // Normalize and tokenize
        const tokens1 = this.normalizeSchemeText(str1);
        const tokens2 = this.normalizeSchemeText(str2);
        
        // Calculate Jaccard similarity for semantic matching
        const intersection = tokens1.filter(token => tokens2.includes(token));
        const union = [...new Set([...tokens1, ...tokens2])];
        
        if (union.length === 0) return 1.0;
        
        const jaccardSimilarity = intersection.length / union.length;
        
        // Boost similarity for common scheme synonyms
        const synonymBoost = this.calculateSynonymBoost(tokens1, tokens2);
        
        return Math.min(1.0, jaccardSimilarity + synonymBoost);
    }
    
    normalizeSchemeText(text) {
        return text.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(token => token.length > 2)
            .map(token => this.normalizeSynonyms(token));
    }
    
    normalizeSynonyms(token) {
        const synonymMap = {
            'yojana': 'scheme',
            'pradhan': 'pm',
            'mantri': 'minister',
            'kisan': 'farmer',
            'swasthya': 'health',
            'shiksha': 'education'
        };
        return synonymMap[token] || token;
    }
    
    calculateSynonymBoost(tokens1, tokens2) {
        const synonymPairs = [
            ['scheme', 'yojana'],
            ['pm', 'pradhan'],
            ['farmer', 'kisan']
        ];
        
        let boost = 0;
        for (const [syn1, syn2] of synonymPairs) {
            if ((tokens1.includes(syn1) && tokens2.includes(syn2)) ||
                (tokens1.includes(syn2) && tokens2.includes(syn1))) {
                boost += 0.2;
            }
        }
        return Math.min(0.4, boost);
    }

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
                        matrix[i - 1][j - 1] + 1, // substitution
                        matrix[i][j - 1] + 1,     // insertion
                        matrix[i - 1][j] + 1      // deletion
                    );
                }
            }
        }

        return matrix[str2.length][str1.length];
    }

    async mergeSchemes(newScheme, duplicateMatch) {
        const existing = duplicateMatch.existing;
        const mergeStrategy = this.determineMergeStrategy(duplicateMatch.type, duplicateMatch.confidence);

        console.log(`🔄 Merging schemes using strategy: ${mergeStrategy}`);

        switch (mergeStrategy) {
            case 'update_existing':
                return await this.updateExistingScheme(existing.id, newScheme, existing);
            
            case 'prefer_dataset':
                return await this.preferDatasetSource(existing.id, newScheme, existing);
            
            case 'merge_fields':
                return await this.mergeSchemeFields(existing.id, newScheme, existing);
            
            case 'skip_new':
                console.log(`⏭️ Skipping new scheme: ${newScheme.scheme_name}`);
                return existing.id;
            
            default:
                return await this.mergeSchemeFields(existing.id, newScheme, existing);
        }
    }

    determineMergeStrategy(matchType, confidence) {
        if (matchType === 'exact_name' && confidence === 1.0) {
            return 'merge_fields';
        }
        
        if (matchType === 'url' && confidence === 1.0) {
            return 'update_existing';
        }
        
        if (matchType === 'ministry_name' && confidence >= 0.95) {
            return 'prefer_dataset';
        }
        
        if (matchType === 'fuzzy_name' && confidence >= 0.9) {
            return 'merge_fields';
        }
        
        return 'skip_new';
    }

    async updateExistingScheme(existingId, newScheme, existing) {
        const updateFields = [];
        const updateValues = [];

        // Update fields that are empty in existing but present in new
        const fieldsToUpdate = [
            'description', 'benefits', 'eligibility_text', 
            'required_documents', 'application_process'
        ];

        for (const field of fieldsToUpdate) {
            if (!existing[field] && newScheme[field]) {
                updateFields.push(`${field} = ?`);
                updateValues.push(newScheme[field]);
            }
        }

        // Always update last_updated timestamp
        updateFields.push('updated_at = CURRENT_TIMESTAMP');

        if (updateFields.length > 1) { // More than just timestamp
            updateValues.push(existingId);
            
            await this.db.run(`
                UPDATE schemes 
                SET ${updateFields.join(', ')}
                WHERE id = ?
            `, updateValues);

            console.log(`✅ Updated existing scheme: ${existing.scheme_name}`);
        }

        return existingId;
    }

    async preferDatasetSource(existingId, newScheme, existing) {
        // If new scheme is from dataset source, prefer it
        if (newScheme.dataset_source) {
            const fieldsToUpdate = [
                'description', 'benefits', 'eligibility_text', 'ministry'
            ];

            const updateFields = [];
            const updateValues = [];

            for (const field of fieldsToUpdate) {
                if (newScheme[field]) {
                    updateFields.push(`${field} = ?`);
                    updateValues.push(newScheme[field]);
                }
            }

            updateFields.push('updated_at = CURRENT_TIMESTAMP');
            updateValues.push(existingId);

            if (updateFields.length > 1) {
                await this.db.run(`
                    UPDATE schemes 
                    SET ${updateFields.join(', ')}
                    WHERE id = ?
                `, updateValues);

                console.log(`✅ Updated with dataset data: ${existing.scheme_name}`);
            }
        }

        return existingId;
    }

    async mergeSchemeFields(existingId, newScheme, existing) {
        const mergedData = {
            scheme_name: this.mergeText(existing.scheme_name, newScheme.scheme_name, 'prefer_existing'),
            ministry: this.mergeText(existing.ministry, newScheme.ministry, 'prefer_longer'),
            description: this.mergeText(existing.description, newScheme.description, 'prefer_longer'),
            benefits: this.mergeText(existing.benefits, newScheme.benefits, 'combine'),
            eligibility_text: this.mergeText(existing.eligibility_text, newScheme.eligibility_text, 'combine'),
            required_documents: this.mergeText(existing.required_documents, newScheme.required_documents, 'combine'),
            application_process: this.mergeText(existing.application_process, newScheme.application_process, 'prefer_new')
        };

        await this.db.run(`
            UPDATE schemes 
            SET ministry = ?, description = ?, benefits = ?, 
                eligibility_text = ?, required_documents = ?, 
                application_process = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [
            mergedData.ministry,
            mergedData.description,
            mergedData.benefits,
            mergedData.eligibility_text,
            mergedData.required_documents,
            mergedData.application_process,
            existingId
        ]);

        console.log(`✅ Merged scheme fields: ${existing.scheme_name}`);
        return existingId;
    }

    mergeText(existing, newText, strategy) {
        if (!existing && !newText) return null;
        if (!existing) return newText;
        if (!newText) return existing;

        switch (strategy) {
            case 'prefer_existing':
                return existing;
            
            case 'prefer_new':
                return newText;
            
            case 'prefer_longer':
                return existing.length >= newText.length ? existing : newText;
            
            case 'combine':
                // Avoid duplicating similar content
                if (this.calculateSimilarity(existing.toLowerCase(), newText.toLowerCase()) > 0.7) {
                    return existing.length >= newText.length ? existing : newText;
                }
                return `${existing}; ${newText}`;
            
            default:
                return existing;
        }
    }

    async getDeduplicationStats() {
        const stats = await this.db.get(`
            SELECT 
                COUNT(*) as total_schemes,
                COUNT(DISTINCT scheme_name) as unique_names,
                COUNT(DISTINCT official_url) as unique_urls,
                COUNT(DISTINCT ministry) as unique_ministries
            FROM schemes
        `);

        const duplicatesByName = await this.db.get(`
            SELECT COUNT(*) as duplicate_names
            FROM (
                SELECT scheme_name, COUNT(*) as cnt
                FROM schemes
                GROUP BY LOWER(TRIM(scheme_name))
                HAVING cnt > 1
            )
        `);

        return {
            ...stats,
            potential_duplicates: duplicatesByName.duplicate_names || 0,
            deduplication_rate: stats.total_schemes > 0 ? 
                ((stats.total_schemes - (duplicatesByName.duplicate_names || 0)) / stats.total_schemes * 100).toFixed(2) : 0
        };
    }

    async cleanup() {
        // Don't close shared database connection
        if (this.db && !this.db.isShared) {
            await this.db.close();
        }
    }
}

module.exports = DeduplicationLayer;