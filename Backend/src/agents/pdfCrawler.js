const BaseCrawler = require('./baseCrawler');
const pdfParse = require('pdf-parse');
const axios = require('axios');

class PDFCrawler extends BaseCrawler {
    constructor() {
        super();
        this.processedPDFs = 0;
    }

    async crawlPDFSchemes() {
        console.log('Starting PDF scheme crawl...');
        
        try {
            // Get PDF sources from database
            const pdfSources = await this.db.query(`
                SELECT source_url FROM crawler_sources 
                WHERE source_type = 'pdf' AND is_active = 1
            `);

            let totalProcessed = 0;
            for (const source of pdfSources) {
                try {
                    const processed = await this.processPDFSource(source.source_url);
                    totalProcessed += processed;
                    await this.randomDelay(5000, 8000); // Longer delay for PDF processing
                } catch (error) {
                    console.error(`Error processing PDF source ${source.source_url}:`, error.message);
                }
            }

            console.log(`PDF crawl completed. Total PDFs processed: ${totalProcessed}`);
            return totalProcessed;
        } catch (error) {
            console.error('Error in PDF crawl:', error);
            return 0;
        }
    }

    async processPDFSource(pdfUrl) {
        try {
            console.log(`Processing PDF: ${pdfUrl}`);
            
            // Download PDF
            const pdfBuffer = await this.downloadPDF(pdfUrl);
            if (!pdfBuffer) return 0;

            // Parse PDF content
            const pdfData = await pdfParse(pdfBuffer);
            const text = pdfData.text;

            if (!text || text.length < 100) {
                console.log(`PDF content too short or empty: ${pdfUrl}`);
                return 0;
            }

            // Extract scheme information from PDF text
            const schemes = this.extractSchemesFromText(text, pdfUrl);
            
            let savedCount = 0;
            for (const scheme of schemes) {
                try {
                    const schemeId = await this.saveScheme(scheme);
                    if (schemeId) savedCount++;
                } catch (error) {
                    console.error(`Error saving scheme from PDF:`, error.message);
                }
            }

            await this.updateCrawlerSource(pdfUrl, savedCount);
            this.processedPDFs++;
            
            console.log(`Extracted ${savedCount} schemes from PDF: ${pdfUrl}`);
            return savedCount;
        } catch (error) {
            console.error(`Error processing PDF ${pdfUrl}:`, error);
            return 0;
        }
    }

    async downloadPDF(url) {
        try {
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            if (response.status === 200) {
                return Buffer.from(response.data);
            }
            return null;
        } catch (error) {
            console.error(`Failed to download PDF ${url}:`, error.message);
            return null;
        }
    }

    extractSchemesFromText(text, sourceUrl) {
        const schemes = [];
        
        try {
            // Split text into sections that might contain scheme information
            const sections = this.splitIntoSections(text);
            
            for (const section of sections) {
                const scheme = this.parseSchemeSection(section, sourceUrl);
                if (scheme) {
                    schemes.push(scheme);
                }
            }
        } catch (error) {
            console.error('Error extracting schemes from text:', error);
        }

        return schemes;
    }

    splitIntoSections(text) {
        // Split by common section indicators
        const sectionIndicators = [
            /scheme\s*name/i,
            /scheme\s*title/i,
            /yojana/i,
            /pradhan\s*mantri/i,
            /ministry/i,
            /department/i
        ];

        const sections = [];
        let currentSection = '';
        const lines = text.split('\n');

        for (const line of lines) {
            const trimmedLine = line.trim();
            
            // Check if this line starts a new section
            const isNewSection = sectionIndicators.some(indicator => 
                indicator.test(trimmedLine)
            );

            if (isNewSection && currentSection.length > 100) {
                sections.push(currentSection);
                currentSection = trimmedLine;
            } else {
                currentSection += '\n' + trimmedLine;
            }
        }

        // Add the last section
        if (currentSection.length > 100) {
            sections.push(currentSection);
        }

        return sections;
    }

    parseSchemeSection(section, sourceUrl) {
        try {
            const lines = section.split('\n').map(line => line.trim()).filter(line => line.length > 0);
            
            if (lines.length < 3) return null;

            // Extract scheme name (usually the first meaningful line)
            const schemeName = this.extractSchemeName(lines);
            if (!schemeName) return null;

            // Extract other components
            const ministry = this.extractMinistry(section);
            const description = this.extractDescription(section);
            const benefits = this.extractBenefits(section);
            const eligibility = this.extractEligibility(section);
            const category = this.categorizeScheme(section);

            return {
                scheme_name: schemeName,
                ministry: ministry || 'Government of India',
                description: description || '',
                benefits: benefits || '',
                eligibility_text: eligibility || '',
                category: category,
                application_mode: 'online',
                official_url: sourceUrl
            };
        } catch (error) {
            console.error('Error parsing scheme section:', error);
            return null;
        }
    }

    extractSchemeName(lines) {
        // Look for scheme name patterns
        const namePatterns = [
            /^(.+?)\s*scheme/i,
            /^(.+?)\s*yojana/i,
            /pradhan\s*mantri\s*(.+)/i,
            /^([A-Z][^.!?]*[A-Z].*)/
        ];

        for (const line of lines.slice(0, 5)) { // Check first 5 lines
            for (const pattern of namePatterns) {
                const match = line.match(pattern);
                if (match && match[1] && match[1].length > 5 && match[1].length < 100) {
                    return this.cleanText(match[1]);
                }
            }
            
            // If line looks like a title (proper case, reasonable length)
            if (line.length > 10 && line.length < 100 && /^[A-Z]/.test(line)) {
                return this.cleanText(line);
            }
        }

        return null;
    }

    extractMinistry(text) {
        const ministryPatterns = [
            /ministry\s+of\s+([^.\n]+)/i,
            /department\s+of\s+([^.\n]+)/i,
            /govt\.\s*of\s+([^.\n]+)/i
        ];

        for (const pattern of ministryPatterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                return this.cleanText(`Ministry of ${match[1]}`);
            }
        }

        return null;
    }

    extractDescription(text) {
        // Look for description patterns
        const descPatterns = [
            /description[:\s]+([^.]+\.)/i,
            /objective[:\s]+([^.]+\.)/i,
            /about[:\s]+([^.]+\.)/i,
            /overview[:\s]+([^.]+\.)/i
        ];

        for (const pattern of descPatterns) {
            const match = text.match(pattern);
            if (match && match[1] && match[1].length > 20) {
                return this.cleanText(match[1]);
            }
        }

        // Fallback: extract first substantial paragraph
        const paragraphs = text.split('\n\n');
        for (const para of paragraphs) {
            const cleaned = this.cleanText(para);
            if (cleaned.length > 50 && cleaned.length < 500) {
                return cleaned;
            }
        }

        return null;
    }

    extractBenefits(text) {
        const benefitPatterns = [
            /benefits?[:\s]+([^.]+\.)/i,
            /assistance[:\s]+([^.]+\.)/i,
            /support[:\s]+([^.]+\.)/i,
            /amount[:\s]+([^.]+\.)/i,
            /rs\.?\s*(\d+[^.]*\.)/i
        ];

        for (const pattern of benefitPatterns) {
            const match = text.match(pattern);
            if (match && match[1] && match[1].length > 10) {
                return this.cleanText(match[1]);
            }
        }

        return null;
    }

    extractEligibility(text) {
        const eligibilityPatterns = [
            /eligibility[:\s]+([^.]+\.)/i,
            /eligible[:\s]+([^.]+\.)/i,
            /criteria[:\s]+([^.]+\.)/i,
            /who\s+can\s+apply[:\s]+([^.]+\.)/i,
            /target\s+group[:\s]+([^.]+\.)/i
        ];

        for (const pattern of eligibilityPatterns) {
            const match = text.match(pattern);
            if (match && match[1] && match[1].length > 10) {
                return this.cleanText(match[1]);
            }
        }

        return null;
    }

    async addPDFSources() {
        // Add common government PDF sources
        const pdfSources = [
            'https://www.india.gov.in/sites/upload_files/npi/files/coi/scheme-booklet.pdf',
            'https://pmkisan.gov.in/Documents/PMKisanSchemeGuidelines.pdf',
            'https://www.pmjay.gov.in/sites/default/files/2018-07/PMJAY%20Scheme%20Document_0.pdf'
        ];

        for (const url of pdfSources) {
            try {
                await this.db.run(`
                    INSERT OR IGNORE INTO crawler_sources (source_url, source_type, is_active)
                    VALUES (?, 'pdf', 1)
                `, [url]);
            } catch (error) {
                console.error(`Error adding PDF source ${url}:`, error);
            }
        }

        console.log(`Added ${pdfSources.length} PDF sources to crawler`);
    }
}

module.exports = PDFCrawler;