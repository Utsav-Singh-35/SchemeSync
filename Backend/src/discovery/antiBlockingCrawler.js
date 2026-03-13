const axios = require('axios');
const cheerio = require('cheerio');
const { getDatabase } = require('../database/connection');

class AntiBlockingCrawler {
    constructor(sharedDb = null) {
        this.db = sharedDb || getDatabase();
        this.requestDelay = 5000; // 5 seconds between requests
        this.maxRetries = 3;
        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/91.0.864.59'
        ];
        this.robotsCache = new Map();
    }

    async initialize() {
        // Only connect if we own the database connection
        if (!this.db.isConnected) {
            await this.db.connect();
        }
        console.log('Anti-blocking crawler initialized');
    }

    getRandomUserAgent() {
        return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
    }

    async checkRobotsTxt(baseUrl) {
        if (this.robotsCache.has(baseUrl)) {
            return this.robotsCache.get(baseUrl);
        }

        try {
            const robotsUrl = `${baseUrl}/robots.txt`;
            const response = await axios.get(robotsUrl, {
                timeout: 10000,
                headers: { 'User-Agent': this.getRandomUserAgent() }
            });

            const robotsRules = this.parseRobotsTxt(response.data);
            this.robotsCache.set(baseUrl, robotsRules);
            return robotsRules;
        } catch (error) {
            // If robots.txt doesn't exist, assume crawling is allowed
            const defaultRules = { crawlDelay: 1, disallowed: [] };
            this.robotsCache.set(baseUrl, defaultRules);
            return defaultRules;
        }
    }

    parseRobotsTxt(robotsContent) {
        const rules = { crawlDelay: 1, disallowed: [] };
        const lines = robotsContent.split('\n');
        let isRelevantSection = false;

        for (const line of lines) {
            const trimmed = line.trim().toLowerCase();
            
            if (trimmed.startsWith('user-agent:')) {
                const userAgent = trimmed.split(':')[1].trim();
                isRelevantSection = userAgent === '*' || userAgent.includes('bot');
            } else if (isRelevantSection) {
                if (trimmed.startsWith('crawl-delay:')) {
                    const delay = parseInt(trimmed.split(':')[1].trim());
                    if (!isNaN(delay)) {
                        rules.crawlDelay = Math.max(delay, 1);
                    }
                } else if (trimmed.startsWith('disallow:')) {
                    const path = trimmed.split(':')[1].trim();
                    if (path) {
                        rules.disallowed.push(path);
                    }
                }
            }
        }

        return rules;
    }

    isPathAllowed(path, robotsRules) {
        return !robotsRules.disallowed.some(disallowed => 
            path.startsWith(disallowed) || disallowed === '/'
        );
    }

    async makeRequest(url, options = {}) {
        const baseUrl = new URL(url).origin;
        const path = new URL(url).pathname;
        
        // Check robots.txt
        const robotsRules = await this.checkRobotsTxt(baseUrl);
        
        if (!this.isPathAllowed(path, robotsRules)) {
            throw new Error(`Path ${path} is disallowed by robots.txt`);
        }

        // Respect crawl delay
        const delay = Math.max(robotsRules.crawlDelay * 1000, this.requestDelay);
        await this.randomDelay(delay, delay + 2000);

        const requestOptions = {
            timeout: 30000,
            headers: {
                'User-Agent': this.getRandomUserAgent(),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                ...options.headers
            },
            ...options
        };

        return await this.retryRequest(url, requestOptions);
    }

    async retryRequest(url, options, attempt = 1) {
        try {
            console.log(`🌐 Requesting: ${url} (attempt ${attempt})`);
            const response = await axios.get(url, options);
            return response;
        } catch (error) {
            if (attempt < this.maxRetries) {
                const backoffDelay = Math.pow(2, attempt) * 1000; // Exponential backoff
                console.log(`⏳ Request failed, retrying in ${backoffDelay}ms...`);
                await this.randomDelay(backoffDelay, backoffDelay + 1000);
                return this.retryRequest(url, options, attempt + 1);
            } else {
                console.error(`❌ Request failed after ${this.maxRetries} attempts: ${error.message}`);
                throw error;
            }
        }
    }

    async crawlPage(url) {
        try {
            const response = await this.makeRequest(url);
            const $ = cheerio.load(response.data);
            
            return {
                success: true,
                html: response.data,
                $: $,
                url: url,
                statusCode: response.status
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                url: url
            };
        }
    }

    async discoverSchemeUrls(portalUrl, selectors = []) {
        console.log(`🔍 Discovering scheme URLs from: ${portalUrl}`);
        
        const result = await this.crawlPage(portalUrl);
        if (!result.success) {
            console.error(`Failed to crawl ${portalUrl}: ${result.error}`);
            return [];
        }

        const $ = result.$;
        const discoveredUrls = new Set();

        // Default selectors for scheme links
        const defaultSelectors = [
            'a[href*="scheme"]',
            'a[href*="yojana"]', 
            'a[href*="benefit"]',
            'a[href*="welfare"]',
            '.scheme-link a',
            '.scheme-item a',
            '.program-link a'
        ];

        const allSelectors = [...defaultSelectors, ...selectors];

        for (const selector of allSelectors) {
            $(selector).each((i, element) => {
                const href = $(element).attr('href');
                if (href && this.isValidSchemeUrl(href)) {
                    const fullUrl = href.startsWith('http') ? href : new URL(href, portalUrl).href;
                    discoveredUrls.add(fullUrl);
                }
            });
        }

        const urls = Array.from(discoveredUrls);
        console.log(`📋 Discovered ${urls.length} scheme URLs from ${portalUrl}`);
        return urls;
    }

    isValidSchemeUrl(href) {
        if (!href) return false;
        
        const invalidPatterns = [
            'javascript:', 'mailto:', 'tel:', '#',
            '.pdf', '.doc', '.jpg', '.png', '.gif',
            'facebook.com', 'twitter.com', 'youtube.com',
            'login', 'register', 'contact'
        ];
        
        const validPatterns = [
            'scheme', 'yojana', 'benefit', 'welfare', 'program'
        ];
        
        const lowerHref = href.toLowerCase();
        
        // Must not contain invalid patterns
        if (invalidPatterns.some(pattern => lowerHref.includes(pattern))) {
            return false;
        }
        
        // Should contain at least one valid pattern
        return validPatterns.some(pattern => lowerHref.includes(pattern));
    }

    async extractSchemeData(url, parser = null) {
        console.log(`📄 Extracting scheme data from: ${url}`);
        
        const result = await this.crawlPage(url);
        if (!result.success) {
            console.error(`Failed to extract from ${url}: ${result.error}`);
            return null;
        }

        const $ = result.$;
        
        // Use custom parser if provided, otherwise use default extraction
        if (parser && typeof parser.extract === 'function') {
            return parser.extract($, url);
        }
        
        return this.defaultSchemeExtraction($, url);
    }

    defaultSchemeExtraction($, url) {
        const schemeName = this.extractText($, [
            '.scheme-title', '.main-heading', 'h1', '.page-title',
            '.scheme-name', '.title', 'h2'
        ]);
        
        const description = this.extractText($, [
            '.description', '.about', '.scheme-description', 
            '.overview', '.content p', '.main-content p'
        ]);
        
        const benefits = this.extractText($, [
            '.benefits', '.scheme-benefits', '.advantages',
            '.financial-assistance', '.support'
        ]);
        
        const eligibility = this.extractText($, [
            '.eligibility', '.eligibility-criteria', '.who-can-apply',
            '.target-group', '.beneficiaries'
        ]);
        
        const ministry = this.extractText($, [
            '.ministry', '.department', '.ministry-name',
            '.dept', '.implementing-agency'
        ]);

        // Validate critical fields
        if (!schemeName || schemeName.length < 5) {
            console.log(`Skipping ${url}: Invalid scheme name`);
            return null;
        }

        return {
            scheme_name: this.cleanText(schemeName),
            ministry: ministry ? this.cleanText(ministry) : null,
            description: description ? this.cleanText(description) : null,
            benefits: benefits ? this.cleanText(benefits) : null,
            eligibility_text: eligibility ? this.cleanText(eligibility) : null,
            category: this.categorizeScheme(schemeName, description),
            application_mode: 'online',
            official_url: url,
            extracted_at: new Date().toISOString()
        };
    }

    extractText($, selectors) {
        for (const selector of selectors) {
            const element = $(selector).first();
            if (element.length > 0) {
                const text = element.text().trim();
                if (text && text.length > 10) {
                    return text;
                }
            }
        }
        return null;
    }

    cleanText(text) {
        if (!text) return '';
        return text
            .replace(/\s+/g, ' ')
            .replace(/\n+/g, ' ')
            .trim();
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

module.exports = AntiBlockingCrawler;