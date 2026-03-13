const axios = require('axios');
const cheerio = require('cheerio');
const { getDatabase } = require('../database/connection');

class DatasetIngester {
    constructor(sharedDb = null) {
        this.db = sharedDb || getDatabase();
        this.dataGovBaseUrl = 'https://data.gov.in';
        this.axiosInstance = axios.create({
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
    }

    async initialize() {
        // Only connect if we own the database connection
        if (!this.db.isConnected) {
            await this.db.connect();
        }
        console.log('Dataset ingester initialized');
    }

    async discoverSchemeDatasets() {
        console.log('🔍 Discovering scheme datasets from data.gov.in...');
        
        const searchTerms = [
            'government schemes',
            'welfare schemes', 
            'subsidy schemes',
            'benefits programs',
            'pradhan mantri',
            'central schemes',
            'state schemes'
        ];

        const discoveredDatasets = [];

        for (const term of searchTerms) {
            try {
                const datasets = await this.searchDatasets(term);
                discoveredDatasets.push(...datasets);
                await this.randomDelay(2000, 4000);
            } catch (error) {
                console.error(`Error searching for "${term}":`, error.message);
            }
        }

        // Remove duplicates
        const uniqueDatasets = this.deduplicateDatasets(discoveredDatasets);
        console.log(`📊 Found ${uniqueDatasets.length} unique scheme datasets`);
        
        return uniqueDatasets;
    }

    async searchDatasets(searchTerm) {
        try {
            const searchUrl = `${this.dataGovBaseUrl}/search?query=${encodeURIComponent(searchTerm)}`;
            const response = await this.axiosInstance.get(searchUrl);
            const $ = cheerio.load(response.data);
            
            const datasets = [];
            
            $('.dataset-item, .search-result').each((i, element) => {
                const $el = $(element);
                const title = $el.find('.dataset-title, h3, .title').text().trim();
                const description = $el.find('.dataset-description, .description, p').text().trim();
                const link = $el.find('a').attr('href');
                
                if (title && link && this.isSchemeRelated(title, description)) {
                    datasets.push({
                        title,
                        description,
                        url: link.startsWith('http') ? link : `${this.dataGovBaseUrl}${link}`,
                        source: 'data.gov.in',
                        searchTerm,
                        discoveredAt: new Date().toISOString()
                    });
                }
            });
            
            return datasets;
        } catch (error) {
            console.error(`Error searching datasets for "${searchTerm}":`, error.message);
            return [];
        }
    }

    isSchemeRelated(title, description) {
        const schemeKeywords = [
            'scheme', 'yojana', 'pradhan mantri', 'welfare', 'subsidy',
            'benefit', 'assistance', 'support', 'program', 'initiative',
            'mission', 'abhiyan', 'kisan', 'awas', 'jan aushadhi'
        ];
        
        const text = `${title} ${description}`.toLowerCase();
        return schemeKeywords.some(keyword => text.includes(keyword));
    }

    deduplicateDatasets(datasets) {
        const seen = new Set();
        return datasets.filter(dataset => {
            const key = `${dataset.title}_${dataset.url}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    async ingestDataset(dataset) {
        console.log(`📥 Ingesting dataset: ${dataset.title}`);
        
        try {
            // Record dataset source
            await this.recordDatasetSource(dataset);
            
            // Attempt to download and parse dataset
            const datasetContent = await this.downloadDataset(dataset.url);
            
            if (datasetContent) {
                const schemes = await this.parseDatasetContent(datasetContent, dataset);
                
                let ingestedCount = 0;
                for (const scheme of schemes) {
                    const schemeId = await this.saveScheme(scheme);
                    if (schemeId) ingestedCount++;
                }
                
                console.log(`✅ Ingested ${ingestedCount} schemes from ${dataset.title}`);
                return ingestedCount;
            }
            
            return 0;
        } catch (error) {
            console.error(`Error ingesting dataset ${dataset.title}:`, error.message);
            return 0;
        }
    }

    async downloadDataset(url) {
        try {
            const response = await this.axiosInstance.get(url);
            
            // Check if it's a direct download link or a page with download links
            const contentType = response.headers['content-type'] || '';
            
            if (contentType.includes('json')) {
                return { type: 'json', data: response.data };
            } else if (contentType.includes('csv')) {
                return { type: 'csv', data: response.data };
            } else if (contentType.includes('xml')) {
                return { type: 'xml', data: response.data };
            } else {
                // It's likely an HTML page, look for download links
                const $ = cheerio.load(response.data);
                const downloadLinks = [];
                
                $('a[href*=".json"], a[href*=".csv"], a[href*=".xml"]').each((i, el) => {
                    const href = $(el).attr('href');
                    if (href) {
                        downloadLinks.push(href.startsWith('http') ? href : `${this.dataGovBaseUrl}${href}`);
                    }
                });
                
                // Try to download the first available dataset file
                if (downloadLinks.length > 0) {
                    return await this.downloadDataset(downloadLinks[0]);
                }
            }
            
            return null;
        } catch (error) {
            console.error(`Error downloading dataset from ${url}:`, error.message);
            return null;
        }
    }

    async parseDatasetContent(content, dataset) {
        const schemes = [];
        
        try {
            if (content.type === 'json') {
                schemes.push(...this.parseJSONDataset(content.data, dataset));
            } else if (content.type === 'csv') {
                schemes.push(...this.parseCSVDataset(content.data, dataset));
            } else if (content.type === 'xml') {
                schemes.push(...this.parseXMLDataset(content.data, dataset));
            }
        } catch (error) {
            console.error('Error parsing dataset content:', error.message);
        }
        
        return schemes;
    }

    parseJSONDataset(data, dataset) {
        const schemes = [];
        
        try {
            // Handle different JSON structures
            let records = [];
            
            if (Array.isArray(data)) {
                records = data;
            } else if (data.records) {
                records = data.records;
            } else if (data.data) {
                records = data.data;
            } else if (data.result && data.result.records) {
                records = data.result.records;
            }
            
            for (const record of records) {
                const scheme = this.extractSchemeFromRecord(record, dataset);
                if (scheme) schemes.push(scheme);
            }
        } catch (error) {
            console.error('Error parsing JSON dataset:', error.message);
        }
        
        return schemes;
    }

    parseCSVDataset(csvData, dataset) {
        const schemes = [];
        
        try {
            const lines = csvData.split('\n');
            if (lines.length < 2) return schemes;
            
            const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
            
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
                if (values.length === headers.length) {
                    const record = {};
                    headers.forEach((header, index) => {
                        record[header] = values[index];
                    });
                    
                    const scheme = this.extractSchemeFromRecord(record, dataset);
                    if (scheme) schemes.push(scheme);
                }
            }
        } catch (error) {
            console.error('Error parsing CSV dataset:', error.message);
        }
        
        return schemes;
    }

    parseXMLDataset(xmlData, dataset) {
        // Basic XML parsing - would need more sophisticated parsing for complex XML
        const schemes = [];
        
        try {
            const $ = cheerio.load(xmlData, { xmlMode: true });
            
            $('record, item, scheme').each((i, element) => {
                const $el = $(element);
                const record = {};
                
                $el.children().each((j, child) => {
                    const $child = $(child);
                    record[$child.prop('tagName')] = $child.text();
                });
                
                const scheme = this.extractSchemeFromRecord(record, dataset);
                if (scheme) schemes.push(scheme);
            });
        } catch (error) {
            console.error('Error parsing XML dataset:', error.message);
        }
        
        return schemes;
    }

    extractSchemeFromRecord(record, dataset) {
        // Map common field names to our schema
        const fieldMappings = {
            scheme_name: ['scheme_name', 'name', 'title', 'scheme_title', 'schemeName'],
            description: ['description', 'desc', 'details', 'summary', 'about'],
            benefits: ['benefits', 'benefit', 'assistance', 'support', 'amount'],
            eligibility: ['eligibility', 'eligible', 'criteria', 'conditions'],
            ministry: ['ministry', 'department', 'dept', 'ministry_name'],
            official_url: ['url', 'link', 'website', 'portal', 'official_url']
        };
        
        const scheme = {
            dataset_source: dataset.url,
            dataset_title: dataset.title,
            ingested_at: new Date().toISOString()
        };
        
        // Extract fields using mappings
        for (const [schemeField, possibleKeys] of Object.entries(fieldMappings)) {
            for (const key of possibleKeys) {
                const value = record[key] || record[key.toLowerCase()] || record[key.toUpperCase()];
                if (value && value.trim()) {
                    scheme[schemeField] = value.trim();
                    break;
                }
            }
        }
        
        // Validate required fields
        if (!scheme.scheme_name || scheme.scheme_name.length < 5) {
            return null;
        }
        
        // Set defaults
        scheme.category = this.categorizeScheme(scheme.scheme_name, scheme.description);
        scheme.application_mode = 'online';
        scheme.is_active = 1;
        
        return scheme;
    }

    categorizeScheme(name, description) {
        const text = `${name || ''} ${description || ''}`.toLowerCase();
        
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
        
        for (const [category, keywords] of Object.entries(categories)) {
            if (keywords.some(keyword => text.includes(keyword))) {
                return category;
            }
        }
        
        return 'general';
    }

    async recordDatasetSource(dataset) {
        await this.db.run(`
            INSERT OR IGNORE INTO crawler_sources (source_url, source_type, is_active)
            VALUES (?, 'dataset', 1)
        `, [dataset.url]);
    }

    async saveScheme(schemeData) {
        try {
            // Check for duplicates
            const existing = await this.checkDuplicate(schemeData);
            if (existing) {
                console.log(`Duplicate scheme skipped: ${schemeData.scheme_name}`);
                return existing.id;
            }

            const result = await this.db.run(`
                INSERT INTO schemes (
                    scheme_name, ministry, description, benefits, eligibility_text,
                    category, application_mode, official_url, is_active
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                schemeData.scheme_name,
                schemeData.ministry,
                schemeData.description,
                schemeData.benefits,
                schemeData.eligibility,
                schemeData.category,
                schemeData.application_mode,
                schemeData.official_url,
                schemeData.is_active
            ]);

            return result.id;
        } catch (error) {
            console.error('Error saving scheme:', error.message);
            return null;
        }
    }

    async checkDuplicate(schemeData) {
        const existing = await this.db.get(`
            SELECT id, scheme_name FROM schemes 
            WHERE LOWER(scheme_name) = LOWER(?)
        `, [schemeData.scheme_name]);

        return existing;
    }

    async randomDelay(min = 1000, max = 3000) {
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    async cleanup() {
        // Don't close shared database connection
        if (this.db && !this.db.isShared) {
            await this.db.close();
        }
    }
}

module.exports = DatasetIngester;