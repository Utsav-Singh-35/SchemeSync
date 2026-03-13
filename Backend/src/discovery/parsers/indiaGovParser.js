const cheerio = require('cheerio');

class IndiaGovParser {
    constructor() {
        this.name = 'IndiaGov Parser';
        this.supportedDomains = ['india.gov.in'];
    }

    canParse(url) {
        return this.supportedDomains.some(domain => url.includes(domain));
    }

    extract($, url) {
        // India.gov.in specific extraction logic
        const schemeName = this.extractSchemeName($);
        const ministry = this.extractMinistry($);
        const description = this.extractDescription($);
        const benefits = this.extractBenefits($);
        const eligibility = this.extractEligibility($);
        const documents = this.extractDocuments($);

        // Validate critical fields
        if (!schemeName || schemeName.length < 5) {
            return null;
        }

        return {
            scheme_name: this.cleanText(schemeName),
            ministry: ministry ? this.cleanText(ministry) : null,
            description: description ? this.cleanText(description) : null,
            benefits: benefits ? this.cleanText(benefits) : null,
            eligibility_text: eligibility ? this.cleanText(eligibility) : null,
            required_documents: documents ? this.cleanText(documents) : null,
            category: this.categorizeScheme(schemeName, description),
            application_mode: 'online',
            official_url: url,
            parser_used: this.name,
            extracted_at: new Date().toISOString()
        };
    }

    extractSchemeName($) {
        const selectors = [
            '.scheme-title',
            '.main-heading', 
            'h1.page-title',
            '.content-header h1',
            '.scheme-name',
            'h1',
            'h2.title'
        ];

        for (const selector of selectors) {
            const element = $(selector).first();
            if (element.length > 0) {
                const text = element.text().trim();
                if (text && text.length > 5) {
                    return text;
                }
            }
        }
        return null;
    }

    extractMinistry($) {
        const selectors = [
            '.ministry-name',
            '.department',
            '.implementing-agency',
            '.ministry',
            '.dept-name',
            '[class*="ministry"]',
            '[class*="department"]'
        ];

        for (const selector of selectors) {
            const element = $(selector).first();
            if (element.length > 0) {
                const text = element.text().trim();
                if (text && text.length > 5 && text.toLowerCase().includes('ministry')) {
                    return text;
                }
            }
        }

        // Look for ministry in breadcrumbs or navigation
        const breadcrumbs = $('.breadcrumb a, .nav-breadcrumb a').map((i, el) => $(el).text()).get();
        for (const crumb of breadcrumbs) {
            if (crumb.toLowerCase().includes('ministry')) {
                return crumb.trim();
            }
        }

        return null;
    }

    extractDescription($) {
        const selectors = [
            '.scheme-description',
            '.about-scheme',
            '.overview',
            '.description',
            '.content p:first-of-type',
            '.main-content p:first-of-type',
            '.scheme-details p:first-of-type'
        ];

        for (const selector of selectors) {
            const element = $(selector).first();
            if (element.length > 0) {
                const text = element.text().trim();
                if (text && text.length > 20) {
                    return text;
                }
            }
        }
        return null;
    }

    extractBenefits($) {
        const selectors = [
            '.benefits',
            '.scheme-benefits',
            '.financial-assistance',
            '.support-provided',
            '.assistance',
            '[class*="benefit"]'
        ];

        let benefits = [];

        for (const selector of selectors) {
            $(selector).each((i, element) => {
                const $el = $(element);
                
                // Check for list items
                const listItems = $el.find('li').map((j, li) => $(li).text().trim()).get();
                if (listItems.length > 0) {
                    benefits.push(...listItems);
                } else {
                    const text = $el.text().trim();
                    if (text && text.length > 10) {
                        benefits.push(text);
                    }
                }
            });
        }

        return benefits.length > 0 ? benefits.join('; ') : null;
    }

    extractEligibility($) {
        const selectors = [
            '.eligibility',
            '.eligibility-criteria',
            '.who-can-apply',
            '.target-beneficiaries',
            '.beneficiaries',
            '[class*="eligib"]'
        ];

        let eligibility = [];

        for (const selector of selectors) {
            $(selector).each((i, element) => {
                const $el = $(element);
                
                // Check for list items
                const listItems = $el.find('li').map((j, li) => $(li).text().trim()).get();
                if (listItems.length > 0) {
                    eligibility.push(...listItems);
                } else {
                    const text = $el.text().trim();
                    if (text && text.length > 10) {
                        eligibility.push(text);
                    }
                }
            });
        }

        return eligibility.length > 0 ? eligibility.join('; ') : null;
    }

    extractDocuments($) {
        const selectors = [
            '.required-documents',
            '.documents-needed',
            '.document-list',
            '.documents',
            '[class*="document"]'
        ];

        let documents = [];

        for (const selector of selectors) {
            $(selector).each((i, element) => {
                const $el = $(element);
                
                const listItems = $el.find('li').map((j, li) => $(li).text().trim()).get();
                if (listItems.length > 0) {
                    documents.push(...listItems);
                } else {
                    const text = $el.text().trim();
                    if (text && text.length > 5) {
                        documents.push(text);
                    }
                }
            });
        }

        return documents.length > 0 ? documents.join('; ') : null;
    }

    categorizeScheme(name, description) {
        const text = `${name || ''} ${description || ''}`.toLowerCase();
        
        const categories = {
            'agriculture': ['farm', 'agriculture', 'crop', 'kisan', 'rural', 'irrigation'],
            'education': ['education', 'student', 'scholarship', 'school', 'college', 'study'],
            'health': ['health', 'medical', 'hospital', 'treatment', 'insurance', 'ayushman'],
            'employment': ['employment', 'job', 'skill', 'training', 'rozgar', 'mgnrega'],
            'housing': ['housing', 'home', 'shelter', 'awas', 'construction', 'pmay'],
            'social_security': ['pension', 'widow', 'disability', 'elderly', 'social', 'security'],
            'women_child': ['women', 'child', 'mother', 'maternity', 'girl', 'beti'],
            'financial': ['loan', 'credit', 'bank', 'finance', 'mudra', 'subsidy']
        };
        
        for (const [category, keywords] of Object.entries(categories)) {
            if (keywords.some(keyword => text.includes(keyword))) {
                return category;
            }
        }
        
        return 'general';
    }

    cleanText(text) {
        if (!text) return '';
        return text
            .replace(/\s+/g, ' ')
            .replace(/\n+/g, ' ')
            .replace(/[^\w\s\-.,;:()\[\]]/g, '')
            .trim();
    }
}

module.exports = IndiaGovParser;