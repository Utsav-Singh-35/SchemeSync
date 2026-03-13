const cheerio = require('cheerio');

class MinistryParser {
    constructor() {
        this.name = 'Ministry Parser';
        this.ministryDomains = [
            'agricoop.nic.in',
            'mohfw.gov.in', 
            'education.gov.in',
            'rural.nic.in',
            'wcd.nic.in',
            'msme.gov.in',
            'socialjustice.nic.in',
            'labour.gov.in'
        ];
    }

    canParse(url) {
        return this.ministryDomains.some(domain => url.includes(domain));
    }

    extract($, url) {
        const ministry = this.identifyMinistry(url);
        const schemeName = this.extractSchemeName($);
        const description = this.extractDescription($);
        const benefits = this.extractBenefits($);
        const eligibility = this.extractEligibility($);
        const applicationProcess = this.extractApplicationProcess($);
        const documents = this.extractDocuments($);

        if (!schemeName || schemeName.length < 5) {
            return null;
        }

        return {
            scheme_name: this.cleanText(schemeName),
            ministry: ministry,
            description: description ? this.cleanText(description) : null,
            benefits: benefits ? this.cleanText(benefits) : null,
            eligibility_text: eligibility ? this.cleanText(eligibility) : null,
            application_process: applicationProcess ? this.cleanText(applicationProcess) : null,
            required_documents: documents ? this.cleanText(documents) : null,
            category: this.categorizeByMinistry(ministry, schemeName, description),
            application_mode: 'online',
            official_url: url,
            parser_used: this.name,
            extracted_at: new Date().toISOString()
        };
    }

    identifyMinistry(url) {
        const ministryMap = {
            'agricoop.nic.in': 'Ministry of Agriculture and Farmers Welfare',
            'mohfw.gov.in': 'Ministry of Health and Family Welfare',
            'education.gov.in': 'Ministry of Education',
            'rural.nic.in': 'Ministry of Rural Development',
            'wcd.nic.in': 'Ministry of Women and Child Development',
            'msme.gov.in': 'Ministry of Micro, Small and Medium Enterprises',
            'socialjustice.nic.in': 'Ministry of Social Justice and Empowerment',
            'labour.gov.in': 'Ministry of Labour and Employment'
        };

        for (const [domain, ministry] of Object.entries(ministryMap)) {
            if (url.includes(domain)) {
                return ministry;
            }
        }

        return 'Unknown Ministry';
    }

    extractSchemeName($) {
        const selectors = [
            '.scheme-title',
            '.page-title h1',
            '.main-heading',
            '.content-title',
            'h1.title',
            '.scheme-name',
            'h1',
            'h2.heading'
        ];

        for (const selector of selectors) {
            const element = $(selector).first();
            if (element.length > 0) {
                let text = element.text().trim();
                
                // Remove common prefixes
                text = text.replace(/^(Scheme:|Programme:|Initiative:)/i, '').trim();
                
                if (text && text.length > 5) {
                    return text;
                }
            }
        }
        return null;
    }

    extractDescription($) {
        const selectors = [
            '.scheme-description',
            '.about',
            '.overview',
            '.description',
            '.scheme-details .content',
            '.main-content p:first-of-type',
            '.content-area p:first-of-type'
        ];

        for (const selector of selectors) {
            const element = $(selector).first();
            if (element.length > 0) {
                const text = element.text().trim();
                if (text && text.length > 30) {
                    return text;
                }
            }
        }

        // Fallback: get first substantial paragraph
        const paragraphs = $('p').filter((i, el) => {
            const text = $(el).text().trim();
            return text.length > 30 && !text.toLowerCase().includes('copyright');
        });

        if (paragraphs.length > 0) {
            return $(paragraphs[0]).text().trim();
        }

        return null;
    }

    extractBenefits($) {
        const selectors = [
            '.benefits',
            '.scheme-benefits',
            '.financial-assistance',
            '.support',
            '.assistance-provided',
            '.benefit-details'
        ];

        let benefits = [];

        for (const selector of selectors) {
            $(selector).each((i, element) => {
                const $el = $(element);
                
                // Look for structured lists
                const listItems = $el.find('li, .benefit-item').map((j, li) => {
                    return $(li).text().trim();
                }).get().filter(text => text.length > 5);

                if (listItems.length > 0) {
                    benefits.push(...listItems);
                } else {
                    // Look for paragraph content
                    const paragraphs = $el.find('p').map((j, p) => {
                        return $(p).text().trim();
                    }).get().filter(text => text.length > 10);

                    if (paragraphs.length > 0) {
                        benefits.push(...paragraphs);
                    } else {
                        const text = $el.text().trim();
                        if (text && text.length > 10) {
                            benefits.push(text);
                        }
                    }
                }
            });
        }

        // Look for benefit keywords in content
        if (benefits.length === 0) {
            const benefitKeywords = ['₹', 'rupees', 'amount', 'subsidy', 'grant', 'assistance'];
            $('p, div').each((i, el) => {
                const text = $(el).text().trim();
                if (text.length > 20 && benefitKeywords.some(keyword => text.toLowerCase().includes(keyword))) {
                    benefits.push(text);
                }
            });
        }

        return benefits.length > 0 ? benefits.slice(0, 5).join('; ') : null;
    }

    extractEligibility($) {
        const selectors = [
            '.eligibility',
            '.eligibility-criteria',
            '.who-can-apply',
            '.target-group',
            '.beneficiaries',
            '.criteria'
        ];

        let eligibility = [];

        for (const selector of selectors) {
            $(selector).each((i, element) => {
                const $el = $(element);
                
                const listItems = $el.find('li').map((j, li) => {
                    return $(li).text().trim();
                }).get().filter(text => text.length > 5);

                if (listItems.length > 0) {
                    eligibility.push(...listItems);
                } else {
                    const text = $el.text().trim();
                    if (text && text.length > 15) {
                        eligibility.push(text);
                    }
                }
            });
        }

        // Look for eligibility patterns in text
        if (eligibility.length === 0) {
            const eligibilityPatterns = [
                /age.*?(\d+).*?(\d+)/i,
                /income.*?below.*?₹?(\d+)/i,
                /farmers?/i,
                /women/i,
                /students?/i
            ];

            $('p, div').each((i, el) => {
                const text = $(el).text().trim();
                if (text.length > 20) {
                    for (const pattern of eligibilityPatterns) {
                        if (pattern.test(text)) {
                            eligibility.push(text);
                            break;
                        }
                    }
                }
            });
        }

        return eligibility.length > 0 ? eligibility.slice(0, 3).join('; ') : null;
    }

    extractApplicationProcess($) {
        const selectors = [
            '.application-process',
            '.how-to-apply',
            '.apply-online',
            '.application-procedure',
            '.process'
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

        // Look for application links
        const applyLinks = $('a[href*="apply"], a[href*="application"]');
        if (applyLinks.length > 0) {
            return `Online application available at: ${$(applyLinks[0]).attr('href')}`;
        }

        return null;
    }

    extractDocuments($) {
        const selectors = [
            '.required-documents',
            '.documents',
            '.document-list',
            '.documents-needed'
        ];

        let documents = [];

        for (const selector of selectors) {
            $(selector).each((i, element) => {
                const $el = $(element);
                
                const listItems = $el.find('li').map((j, li) => {
                    return $(li).text().trim();
                }).get().filter(text => text.length > 3);

                if (listItems.length > 0) {
                    documents.push(...listItems);
                } else {
                    const text = $el.text().trim();
                    if (text && text.length > 10) {
                        documents.push(text);
                    }
                }
            });
        }

        return documents.length > 0 ? documents.slice(0, 10).join('; ') : null;
    }

    categorizeByMinistry(ministry, schemeName, description) {
        const text = `${schemeName || ''} ${description || ''}`.toLowerCase();
        
        // Ministry-based categorization
        if (ministry.includes('Agriculture')) return 'agriculture';
        if (ministry.includes('Health')) return 'health';
        if (ministry.includes('Education')) return 'education';
        if (ministry.includes('Rural')) return 'employment';
        if (ministry.includes('Women')) return 'women_child';
        if (ministry.includes('MSME')) return 'financial';
        if (ministry.includes('Social Justice')) return 'social_security';
        if (ministry.includes('Labour')) return 'employment';

        // Keyword-based fallback
        const categories = {
            'agriculture': ['farm', 'crop', 'kisan', 'irrigation'],
            'education': ['education', 'scholarship', 'student'],
            'health': ['health', 'medical', 'insurance'],
            'employment': ['employment', 'job', 'skill', 'training'],
            'housing': ['housing', 'awas', 'shelter'],
            'social_security': ['pension', 'disability', 'elderly'],
            'women_child': ['women', 'child', 'maternity'],
            'financial': ['loan', 'credit', 'subsidy']
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
            .replace(/[^\w\s\-.,;:()\[\]₹]/g, '')
            .trim();
    }
}

module.exports = MinistryParser;