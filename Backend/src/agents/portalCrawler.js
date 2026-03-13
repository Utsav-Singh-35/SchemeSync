const BaseCrawler = require('./baseCrawler');

class PortalCrawler extends BaseCrawler {
    constructor() {
        super();
        this.crawledSchemes = 0;
    }

    async crawlIndiaGovSchemes() {
        const url = 'https://www.india.gov.in/my-government/schemes';
        console.log(`Starting crawl of India.gov.in schemes...`);

        try {
            const success = await this.navigateToUrl(url);
            if (!success) return 0;

            await this.randomDelay();

            // Extract scheme links
            const schemeLinks = await this.extractLinks('a[href*="scheme"], .scheme-link, .content-area a');
            console.log(`Found ${schemeLinks.length} potential scheme links`);

            let processedCount = 0;
            for (const link of schemeLinks.slice(0, 10)) { // Limit to avoid overload
                try {
                    if (this.isValidSchemeLink(link.href)) {
                        await this.crawlSchemeDetail(link.href, link.text);
                        processedCount++;
                        await this.randomDelay(2000, 4000);
                    }
                } catch (error) {
                    console.error(`Error processing scheme link ${link.href}:`, error.message);
                }
            }

            await this.updateCrawlerSource(url, processedCount);
            return processedCount;
        } catch (error) {
            console.error('Error crawling India.gov.in:', error);
            return 0;
        }
    }

    async crawlPMJAY() {
        const url = 'https://www.pmjay.gov.in/';
        console.log(`Starting crawl of PM-JAY...`);

        try {
            const success = await this.navigateToUrl(url);
            if (!success) return 0;

            await this.randomDelay();

            // Extract scheme information - NO FALLBACKS
            const schemeName = await this.extractText('.scheme-title, .main-heading, h1, .page-title');
            const ministry = await this.extractText('.ministry, .department, .ministry-name');
            const description = await this.extractText('.about-content, .scheme-description, .main-content p');
            const benefits = await this.extractText('.benefits, .coverage-details, .scheme-benefits');
            const eligibilityText = await this.extractText('.eligibility, .who-can-avail, .eligibility-criteria');

            // Validate critical fields - skip if missing
            if (!schemeName || !description) {
                console.log(`Skipping PM-JAY: Missing critical fields (name: ${!!schemeName}, description: ${!!description})`);
                return 0;
            }

            const schemeData = {
                scheme_name: this.cleanText(schemeName),
                ministry: ministry ? this.cleanText(ministry) : null,
                description: this.cleanText(description),
                benefits: benefits ? this.cleanText(benefits) : null,
                eligibility_text: eligibilityText ? this.cleanText(eligibilityText) : null,
                category: this.categorizeScheme(`${schemeName} ${description}`),
                application_mode: 'online',
                official_url: url
            };

            // Extract eligibility tags from text if available
            if (eligibilityText) {
                schemeData.eligibility_tags = this.extractEligibilityTags(eligibilityText);
            }

            const schemeId = await this.saveScheme(schemeData);
            if (schemeId) {
                this.crawledSchemes++;
                await this.updateCrawlerSource(url, 1);
                return 1;
            }
            return 0;
        } catch (error) {
            console.error('Error crawling PM-JAY:', error);
            return 0;
        }
    }

    async crawlPMKisan() {
        const url = 'https://pmkisan.gov.in/';
        console.log(`Starting crawl of PM-Kisan...`);

        try {
            const success = await this.navigateToUrl(url);
            if (!success) return 0;

            await this.randomDelay();

            // Extract scheme information - NO FALLBACKS
            const schemeName = await this.extractText('.scheme-title, .main-heading, h1, .page-title');
            const ministry = await this.extractText('.ministry, .department, .ministry-name');
            const description = await this.extractText('.scheme-info, .about-scheme, .scheme-description');
            const benefits = await this.extractText('.benefits-section, .scheme-benefits, .benefits');
            const eligibilityText = await this.extractText('.eligibility-criteria, .eligibility, .who-can-apply');

            // Validate critical fields - skip if missing
            if (!schemeName || !description) {
                console.log(`Skipping PM-Kisan: Missing critical fields (name: ${!!schemeName}, description: ${!!description})`);
                return 0;
            }

            const schemeData = {
                scheme_name: this.cleanText(schemeName),
                ministry: ministry ? this.cleanText(ministry) : null,
                description: this.cleanText(description),
                benefits: benefits ? this.cleanText(benefits) : null,
                eligibility_text: eligibilityText ? this.cleanText(eligibilityText) : null,
                category: this.categorizeScheme(`${schemeName} ${description}`),
                application_mode: 'online',
                official_url: url
            };

            // Extract eligibility tags from text if available
            if (eligibilityText) {
                schemeData.eligibility_tags = this.extractEligibilityTags(eligibilityText);
            }

            const schemeId = await this.saveScheme(schemeData);
            if (schemeId) {
                this.crawledSchemes++;
                await this.updateCrawlerSource(url, 1);
                return 1;
            }
            return 0;
        } catch (error) {
            console.error('Error crawling PM-Kisan:', error);
            return 0;
        }
    }

    async crawlMGNREGA() {
        const url = 'https://www.nrega.nic.in/';
        console.log(`Starting crawl of MGNREGA...`);

        try {
            const success = await this.navigateToUrl(url);
            if (!success) return 0;

            await this.randomDelay();

            // Extract scheme information - NO FALLBACKS
            const schemeName = await this.extractText('.scheme-title, .main-heading, h1, .page-title');
            const ministry = await this.extractText('.ministry, .department, .ministry-name');
            const description = await this.extractText('.scheme-description, .about-mgnrega, .about-scheme');
            const benefits = await this.extractText('.benefits, .wage-details, .scheme-benefits');
            const eligibilityText = await this.extractText('.eligibility, .eligibility-criteria, .who-can-apply');

            // Validate critical fields - skip if missing
            if (!schemeName || !description) {
                console.log(`Skipping MGNREGA: Missing critical fields (name: ${!!schemeName}, description: ${!!description})`);
                return 0;
            }

            const schemeData = {
                scheme_name: this.cleanText(schemeName),
                ministry: ministry ? this.cleanText(ministry) : null,
                description: this.cleanText(description),
                benefits: benefits ? this.cleanText(benefits) : null,
                eligibility_text: eligibilityText ? this.cleanText(eligibilityText) : null,
                category: this.categorizeScheme(`${schemeName} ${description}`),
                application_mode: 'both',
                official_url: url
            };

            // Extract eligibility tags from text if available
            if (eligibilityText) {
                schemeData.eligibility_tags = this.extractEligibilityTags(eligibilityText);
            }

            const schemeId = await this.saveScheme(schemeData);
            if (schemeId) {
                this.crawledSchemes++;
                await this.updateCrawlerSource(url, 1);
                return 1;
            }
            return 0;
        } catch (error) {
            console.error('Error crawling MGNREGA:', error);
            return 0;
        }
    }

    async crawlSchemeDetail(url, title) {
        try {
            const success = await this.navigateToUrl(url);
            if (!success) return null;

            await this.randomDelay();

            const description = await this.extractText('.description, .content, .scheme-details p');
            const benefits = await this.extractText('.benefits, .scheme-benefits');
            const eligibility = await this.extractText('.eligibility, .who-can-apply');

            if (!description && !benefits && !eligibility) {
                console.log(`No useful content found for: ${title}`);
                return null;
            }

            const schemeData = {
                scheme_name: this.cleanText(title),
                ministry: await this.extractText('.ministry, .department') || 'Government of India',
                description: this.cleanText(description) || '',
                benefits: this.cleanText(benefits) || '',
                eligibility_text: this.cleanText(eligibility) || '',
                category: this.categorizeScheme(`${title} ${description} ${benefits}`),
                application_mode: 'online',
                official_url: url
            };

            return await this.saveScheme(schemeData);
        } catch (error) {
            console.error(`Error crawling scheme detail ${url}:`, error);
            return null;
        }
    }

    isValidSchemeLink(href) {
        if (!href) return false;
        
        const invalidPatterns = [
            'javascript:', 'mailto:', 'tel:', '#',
            '.pdf', '.doc', '.jpg', '.png', '.gif',
            'facebook.com', 'twitter.com', 'youtube.com'
        ];
        
        return !invalidPatterns.some(pattern => href.toLowerCase().includes(pattern));
    }

    async crawlAllSources() {
        console.log('Starting comprehensive portal crawl...');
        
        try {
            await this.initialize();
            
            let totalSchemes = 0;
            
            // Crawl major government portals
            totalSchemes += await this.crawlPMJAY();
            totalSchemes += await this.crawlPMKisan();
            totalSchemes += await this.crawlMGNREGA();
            totalSchemes += await this.crawlIndiaGovSchemes();
            
            console.log(`Portal crawl completed. Total schemes processed: ${totalSchemes}`);
            return totalSchemes;
        } catch (error) {
            console.error('Error in comprehensive crawl:', error);
            return 0;
        } finally {
            await this.cleanup();
        }
    }
}

module.exports = PortalCrawler;
    async crawlSchemeDetail(url, title) {
        try {
            const success = await this.navigateToUrl(url);
            if (!success) return null;

            await this.randomDelay();

            const description = await this.extractText('.description, .content, .scheme-details p');
            const benefits = await this.extractText('.benefits, .scheme-benefits');
            const eligibility = await this.extractText('.eligibility, .who-can-apply');

            if (!description && !benefits && !eligibility) {
                console.log(`No useful content found for: ${title}`);
                return null;
            }

            const schemeData = {
                scheme_name: this.cleanText(title),
                ministry: await this.extractText('.ministry, .department') || 'Government of India',
                description: this.cleanText(description) || '',
                benefits: this.cleanText(benefits) || '',
                eligibility_text: this.cleanText(eligibility) || '',
                category: this.categorizeScheme(`${title} ${description} ${benefits}`),
                application_mode: 'online',
                official_url: url
            };

            return await this.saveScheme(schemeData);
        } catch (error) {
            console.error(`Error crawling scheme detail ${url}:`, error);
            return null;
        }
    }

    isValidSchemeLink(href) {
        if (!href) return false;
        
        const invalidPatterns = [
            'javascript:', 'mailto:', 'tel:', '#',
            '.pdf', '.doc', '.jpg', '.png', '.gif',
            'facebook.com', 'twitter.com', 'youtube.com'
        ];
        
        return !invalidPatterns.some(pattern => href.toLowerCase().includes(pattern));
    }

    async crawlAllSources() {
        console.log('Starting comprehensive portal crawl...');
        
        try {
            await this.initialize();
            
            let totalSchemes = 0;
            
            // Crawl major government portals
            totalSchemes += await this.crawlPMJAY();
            totalSchemes += await this.crawlPMKisan();
            totalSchemes += await this.crawlMGNREGA();
            totalSchemes += await this.crawlIndiaGovSchemes();
            
            console.log(`Portal crawl completed. Total schemes processed: ${totalSchemes}`);
            return totalSchemes;
        } catch (error) {
            console.error('Error in comprehensive crawl:', error);
            return 0;
        } finally {
            await this.cleanup();
        }
    }
}

module.exports = PortalCrawler;