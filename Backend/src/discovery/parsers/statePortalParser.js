const cheerio = require('cheerio');

class StatePortalParser {
    constructor() {
        this.name = 'State Portal Parser';
        this.stateDomains = {
            'up.gov.in': 'Uttar Pradesh',
            'maharashtra.gov.in': 'Maharashtra',
            'karnataka.gov.in': 'Karnataka',
            'tn.gov.in': 'Tamil Nadu',
            'gujaratindia.gov.in': 'Gujarat',
            'wb.gov.in': 'West Bengal',
            'rajasthan.gov.in': 'Rajasthan',
            'mp.gov.in': 'Madhya Pradesh',
            'ap.gov.in': 'Andhra Pradesh',
            'telangana.gov.in': 'Telangana'
        };
    }

    canParse(url) {
        return Object.keys(this.stateDomains).some(domain => url.includes(domain));
    }

    extract($, url) {
        const state = this.identifyState(url);
        const schemeName = this.extractSchemeName($);
        const description = this.extractDescription($);
        const benefits = this.extractBenefits($);
        const eligibility = this.extractEligibility($);
        const targetGroup = this.extractTargetGroup($);
        const applicationMode = this.extractApplicationMode($);

        if (!schemeName || schemeName.length < 5) {
            return null;
        }

        return {
            scheme_name: this.cleanText(schemeName),
            ministry: `${state} Government`,
            state: state,
            description: description ? this.cleanText(description) : null,
            benefits: benefits ? this.cleanText(benefits) : null,
            eligibility_text: eligibility ? this.cleanText(eligibility) : null,
            target_group: targetGroup ? this.cleanText(targetGroup) : null,
            category: this.categorizeScheme(schemeName, description),
            application_mode: applicationMode || 'online',
            official_url: url,
            parser_used: this.name,
            extracted_at: new Date().toISOString()
        };
    }

    identifyState(url) {
        for (const [domain, state] of Object.entries(this.stateDomains)) {
            if (url.includes(domain)) {
                return state;
            }
        }
        return 'Unknown State';
    }

    extractSchemeName($) {
        const selectors = [
            '.scheme-title',
            '.yojana-title',
            '.page-title h1',
            '.main-heading',
            '.scheme-name',
            'h1.title',
            'h1',
            'h2.scheme-heading'
        ];

        for (const selector of selectors) {
            const element = $(selector).first();
            if (element.length > 0) {
                let text = element.text().trim();
                
                // Remove common state scheme prefixes
                text = text.replace(/^(योजना|Yojana|Scheme|Programme):\s*/i, '').trim();
                
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
            '.yojana-description',
            '.about-scheme',
            '.overview',
            '.description',
            '.scheme-details',
            '.content p:first-of-type'
        ];

        for (const selector of selectors) {
            const element = $(selector).first();
            if (element.length > 0) {
                const text = element.text().trim();
                if (text && text.length > 25) {
                    return text;
                }
            }
        }

        // Look for description in meta tags
        const metaDescription = $('meta[name="description"]').attr('content');
        if (metaDescription && metaDescription.length > 25) {
            return metaDescription.trim();
        }

        return null;
    }

    extractBenefits($) {
        const selectors = [
            '.benefits',
            '.scheme-benefits',
            '.yojana-benefits',
            '.financial-assistance',
            '.लाभ',
            '.benefit-amount'
        ];

        let benefits = [];

        for (const selector of selectors) {
            $(selector).each((i, element) => {
                const $el = $(element);
                
                // Look for amount patterns
                const amountPattern = /₹\s*[\d,]+|रुपये\s*[\d,]+/g;
                const text = $el.text();
                const amounts = text.match(amountPattern);
                
                if (amounts) {
                    benefits.push(`Financial assistance: ${amounts.join(', ')}`);
                }
                
                // Look for list items
                const listItems = $el.find('li').map((j, li) => {
                    return $(li).text().trim();
                }).get().filter(text => text.length > 5);

                if (listItems.length > 0) {
                    benefits.push(...listItems);
                } else {
                    const fullText = $el.text().trim();
                    if (fullText && fullText.length > 15) {
                        benefits.push(fullText);
                    }
                }
            });
        }

        return benefits.length > 0 ? benefits.slice(0, 5).join('; ') : null;
    }

    extractEligibility($) {
        const selectors = [
            '.eligibility',
            '.eligibility-criteria',
            '.पात्रता',
            '.योग्यता',
            '.who-can-apply',
            '.target-beneficiaries'
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

        // Look for common eligibility patterns
        if (eligibility.length === 0) {
            const eligibilityPatterns = [
                /आयु.*?(\d+).*?(\d+)/,
                /age.*?(\d+).*?(\d+)/i,
                /आय.*?₹.*?(\d+)/,
                /income.*?₹.*?(\d+)/i,
                /किसान|farmer/i,
                /महिला|women/i,
                /छात्र|student/i
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

    extractTargetGroup($) {
        const selectors = [
            '.target-group',
            '.beneficiaries',
            '.लक्षित-समूह',
            '.target-beneficiaries'
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

        // Infer from scheme name and content
        const content = $('body').text().toLowerCase();
        const targetGroups = {
            'farmers': ['किसान', 'farmer', 'कृषक'],
            'women': ['महिला', 'women', 'स्त्री'],
            'students': ['छात्र', 'student', 'विद्यार्थी'],
            'elderly': ['बुजुर्ग', 'elderly', 'वृद्ध'],
            'disabled': ['दिव्यांग', 'disabled', 'विकलांग'],
            'youth': ['युवा', 'youth', 'नौजवान']
        };

        for (const [group, keywords] of Object.entries(targetGroups)) {
            if (keywords.some(keyword => content.includes(keyword))) {
                return group;
            }
        }

        return null;
    }

    extractApplicationMode($) {
        const onlineIndicators = [
            'online application',
            'ऑनलाइन आवेदन',
            'digital application',
            'e-application'
        ];

        const offlineIndicators = [
            'offline application',
            'manual application',
            'visit office',
            'कार्यालय में जाएं'
        ];

        const content = $('body').text().toLowerCase();

        if (onlineIndicators.some(indicator => content.includes(indicator))) {
            return 'online';
        }

        if (offlineIndicators.some(indicator => content.includes(indicator))) {
            return 'offline';
        }

        // Check for application links
        const applyLinks = $('a[href*="apply"], a[href*="आवेदन"]');
        if (applyLinks.length > 0) {
            return 'online';
        }

        return 'online'; // Default assumption
    }

    categorizeScheme(schemeName, description) {
        const text = `${schemeName || ''} ${description || ''}`.toLowerCase();
        
        const categories = {
            'agriculture': ['कृषि', 'किसान', 'farm', 'agriculture', 'crop', 'kisan'],
            'education': ['शिक्षा', 'छात्रवृत्ति', 'education', 'scholarship', 'student'],
            'health': ['स्वास्थ्य', 'चिकित्सा', 'health', 'medical', 'hospital'],
            'employment': ['रोजगार', 'नौकरी', 'employment', 'job', 'skill'],
            'housing': ['आवास', 'घर', 'housing', 'home', 'awas'],
            'social_security': ['पेंशन', 'सामाजिक', 'pension', 'social', 'security'],
            'women_child': ['महिला', 'बच्चे', 'women', 'child', 'maternity'],
            'financial': ['ऋण', 'वित्तीय', 'loan', 'financial', 'subsidy']
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

module.exports = StatePortalParser;