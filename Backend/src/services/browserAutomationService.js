const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

class BrowserAutomationService {
    constructor() {
        this.sessions = new Map(); // Track active browser sessions
        this.tempDir = path.join(__dirname, '../../temp');
        this.ensureTempDir();
    }

    async ensureTempDir() {
        try {
            await fs.mkdir(this.tempDir, { recursive: true });
        } catch (error) {
            console.error('Failed to create temp directory:', error);
        }
    }

    /**
     * Fill government scheme application form using user profile data
     * @param {Object} userProfile - User's profile data from database
     * @param {string} applicationUrl - Government portal application URL
     * @param {string} sessionId - Unique session identifier
     * @returns {Promise<Object>} - Result with browser session URL and status
     */
    async fillApplicationForm(userProfile, applicationUrl, sessionId) {
        try {
            console.log(`Starting form filling automation for session ${sessionId}`);
            console.log(`Target URL: ${applicationUrl}`);
            console.log(`User profile: ${JSON.stringify(userProfile, null, 2)}`);
            
            // Create browser session with proper configuration
            const browserSession = await this.createBrowserSession(sessionId);
            
            // Navigate to application URL with proper error handling
            await this.navigateToApplication(sessionId, applicationUrl);
            
            // Handle potential redirects and wait for final page
            const finalUrl = await this.handleRedirectsAndWait(sessionId);
            
            // Take initial screenshot for debugging
            const screenshotPath = path.join(this.tempDir, `${sessionId}_initial.png`);
            await this.executeCommand(sessionId, 'screenshot', [screenshotPath]);
            
            // Get page snapshot to identify form fields
            const snapshot = await this.getPageSnapshot(sessionId);
            console.log(`Page snapshot obtained for ${finalUrl}`);
            
            // Analyze form and fill fields with enhanced logic
            const fillResult = await this.analyzeAndFillForm(sessionId, snapshot, userProfile);
            
            // Handle form submission if requested
            const submissionResult = await this.handleFormSubmission(sessionId, fillResult);
            
            // Take final screenshot
            const finalScreenshotPath = path.join(this.tempDir, `${sessionId}_filled.png`);
            await this.executeCommand(sessionId, 'screenshot', [finalScreenshotPath]);
            
            // Get browser session URL for user continuation
            const browserUrl = await this.getBrowserSessionUrl(sessionId);
            
            return {
                success: true,
                sessionId,
                initialUrl: applicationUrl,
                finalUrl: finalUrl.trim(),
                browserUrl,
                fieldsFound: fillResult.fieldsFound,
                fieldsFilled: fillResult.fieldsFilled,
                formSubmitted: submissionResult.submitted,
                screenshots: {
                    initial: screenshotPath,
                    final: finalScreenshotPath
                },
                message: `Form filling completed. ${fillResult.fieldsFilled} out of ${fillResult.fieldsFound} fields filled.`,
                instructions: 'Click "Continue in Browser" to review and submit the form.'
            };
            
        } catch (error) {
            console.error('Form filling automation failed:', error);
            
            // Take error screenshot for debugging
            try {
                const errorScreenshotPath = path.join(this.tempDir, `${sessionId}_error.png`);
                await this.executeCommand(sessionId, 'screenshot', [errorScreenshotPath]);
            } catch (screenshotError) {
                console.error('Failed to take error screenshot:', screenshotError);
            }
            
            return {
                success: false,
                sessionId,
                error: error.message,
                message: 'Form filling automation failed. Please try manual application.',
                fallbackUrl: applicationUrl
            };
        }
    }

    /**
     * Navigate to application URL with proper error handling
     */
    async navigateToApplication(sessionId, applicationUrl) {
        console.log(`Navigating to: ${applicationUrl}`);
        
        // Open the application URL
        await this.executeCommand(sessionId, 'open', [applicationUrl]);
        
        // Wait for page to load completely
        await this.executeCommand(sessionId, 'wait', ['--load', 'networkidle']);
        
        // Additional wait for dynamic content
        await this.delay(2000);
    }

    /**
     * Handle redirects and wait for final page to load
     */
    async handleRedirectsAndWait(sessionId) {
        let previousUrl = '';
        let currentUrl = '';
        let redirectCount = 0;
        const maxRedirects = 5;
        
        // Monitor for redirects
        while (redirectCount < maxRedirects) {
            currentUrl = await this.executeCommand(sessionId, 'get', ['url']);
            
            if (currentUrl === previousUrl) {
                // No more redirects, page is stable
                break;
            }
            
            console.log(`Redirect ${redirectCount + 1}: ${currentUrl}`);
            previousUrl = currentUrl;
            redirectCount++;
            
            // Wait for page to stabilize after redirect
            await this.executeCommand(sessionId, 'wait', ['--load', 'networkidle']);
            await this.delay(1500);
        }
        
        // Final wait for any dynamic content
        await this.delay(2000);
        
        return currentUrl;
    }

    /**
     * Handle form submission if appropriate
     */
    async handleFormSubmission(sessionId, fillResult) {
        // For security, we don't auto-submit forms
        // User should review and submit manually
        return {
            submitted: false,
            reason: 'Manual review required for security'
        };
    }

    /**
     * Create a new browser session with enhanced configuration
     */
    async createBrowserSession(sessionId) {
        const session = {
            id: sessionId,
            createdAt: new Date(),
            active: true
        };
        
        this.sessions.set(sessionId, session);
        
        // Initialize browser session - agent-browser will create session automatically
        console.log(`Created browser session: ${sessionId}`);
        
        return session;
    }

    /**
     * Execute agent-browser command with proper session management
     */
    async executeCommand(sessionId, command, args = []) {
        return new Promise((resolve, reject) => {
            // Build full command with session and headed mode
            const fullArgs = ['--session', sessionId, '--headed', command, ...args];
            
            console.log(`Executing: agent-browser ${fullArgs.join(' ')}`);
            
            // Handle Windows executable path
            let executable = 'agent-browser';
            if (process.platform === 'win32') {
                executable = 'agent-browser.cmd';
            }
            
            const childProcess = spawn(executable, fullArgs, {
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: process.platform === 'win32'
            });
            
            let stdout = '';
            let stderr = '';
            
            childProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            
            childProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            childProcess.on('close', (code) => {
                if (code === 0) {
                    resolve(stdout.trim());
                } else {
                    reject(new Error(`Command failed with code ${code}: ${stderr}`));
                }
            });
            
            childProcess.on('error', (error) => {
                reject(new Error(`Failed to execute command: ${error.message}`));
            });
        });
    }

    /**
     * Get page snapshot to identify form fields
     */
    async getPageSnapshot(sessionId) {
        try {
            // Get interactive elements snapshot with refs
            const snapshotOutput = await this.executeCommand(sessionId, 'snapshot', ['-i']);
            
            return {
                success: true,
                data: {
                    snapshot: snapshotOutput
                }
            };
        } catch (error) {
            console.error('Failed to get page snapshot:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Analyze form fields and fill with user data
     */
    async analyzeAndFillForm(sessionId, snapshot, userProfile) {
        const fieldsFound = [];
        const fieldsFilled = [];
        
        console.log('Analyzing form fields...');
        
        // Parse snapshot to find form fields
        const formFields = this.extractFormFields(snapshot);
        console.log(`Found ${formFields.length} form fields`);
        
        for (const field of formFields) {
            fieldsFound.push(field);
            
            try {
                const value = this.mapProfileDataToField(field, userProfile);
                
                if (value) {
                    console.log(`Filling field "${field.label}" (${field.name}) with: ${value}`);
                    
                    // Fill the field using the ref with enhanced error handling
                    await this.fillFieldSafely(sessionId, field, value);
                    fieldsFilled.push({ ...field, value });
                    
                    // Delay between field fills to avoid detection
                    await this.delay(800);
                } else {
                    console.log(`No value found for field "${field.label}" (${field.name})`);
                }
            } catch (error) {
                console.error(`Failed to fill field ${field.name}:`, error);
            }
        }
        
        console.log(`Form analysis complete: ${fieldsFilled.length}/${fieldsFound.length} fields filled`);
        
        return {
            fieldsFound: fieldsFound.length,
            fieldsFilled: fieldsFilled.length,
            details: { fieldsFound, fieldsFilled }
        };
    }

    /**
     * Safely fill a form field with retry logic using agent-browser refs
     */
    async fillFieldSafely(sessionId, field, value) {
        const maxRetries = 3;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`Filling field @${field.ref} with value: ${value} (attempt ${attempt})`);
                
                // Use agent-browser fill command with ref
                await this.executeCommand(sessionId, 'fill', [`@${field.ref}`, value]);
                
                // Small delay after filling
                await this.delay(300);
                
                return; // Success
            } catch (error) {
                console.error(`Fill attempt ${attempt} failed for field @${field.ref}:`, error);
                
                if (attempt === maxRetries) {
                    throw error;
                }
                
                await this.delay(500);
            }
        }
    }

    /**
     * Extract form fields from agent-browser snapshot
     */
    extractFormFields(snapshot) {
        const fields = [];
        
        if (!snapshot.success || !snapshot.data) {
            return fields;
        }
        
        // Parse the snapshot text to find interactive elements with refs
        const snapshotText = snapshot.data.snapshot || '';
        const lines = snapshotText.split('\n');
        
        for (const line of lines) {
            // Parse agent-browser snapshot format: - textbox "Customer name:" [ref=e1]
            const refMatch = line.match(/^-\s+(\w+)\s+"([^"]*)".*\[ref=(\w+)\]/);
            if (refMatch) {
                const [, type, label, ref] = refMatch;
                
                // Only include form-related elements
                if (this.isFormElement(type)) {
                    fields.push({
                        ref,
                        type: type.toLowerCase(),
                        label: label.trim(),
                        name: this.inferFieldName(label, line)
                    });
                }
            }
        }
        
        console.log(`Extracted ${fields.length} form fields from snapshot`);
        return fields;
    }

    /**
     * Check if element type is a form element
     */
    isFormElement(type) {
        const formTypes = [
            'textbox', 'input', 'searchbox', 'combobox', 'listbox',
            'spinbutton', 'slider', 'checkbox', 'radio', 'button'
        ];
        
        return formTypes.includes(type.toLowerCase());
    }

    /**
     * Infer field name from label and context
     */
    /**
         * Infer field name from label and context for Indian government forms
         */
        inferFieldName(label, context) {
            const lowerLabel = label.toLowerCase();

            // Remove common suffixes
            const cleanLabel = lowerLabel.replace(/[:\s]*$/, '');

            // Direct label mappings for the test form
            if (cleanLabel.includes('customer name') || cleanLabel.includes('name')) return 'name';
            if (cleanLabel.includes('telephone') || cleanLabel.includes('phone')) return 'phone';
            if (cleanLabel.includes('e-mail') || cleanLabel.includes('email')) return 'email';
            if (cleanLabel.includes('delivery time')) return 'deliveryTime';
            if (cleanLabel.includes('delivery instructions')) return 'instructions';

            // Indian government form specific mappings
            if (cleanLabel.includes('applicant name') || cleanLabel.includes('full name')) return 'name';
            if (cleanLabel.includes('first name') || cleanLabel.includes('given name')) return 'firstName';
            if (cleanLabel.includes('last name') || cleanLabel.includes('surname')) return 'lastName';
            if (cleanLabel.includes('father') && cleanLabel.includes('name')) return 'fatherName';
            if (cleanLabel.includes('mother') && cleanLabel.includes('name')) return 'motherName';
            if (cleanLabel.includes('age') || cleanLabel.includes('years old')) return 'age';
            if (cleanLabel.includes('date of birth') || cleanLabel.includes('dob')) return 'dateOfBirth';
            if (cleanLabel.includes('gender') || cleanLabel.includes('sex')) return 'gender';
            if (cleanLabel.includes('income') || cleanLabel.includes('salary')) return 'income';
            if (cleanLabel.includes('annual income')) return 'annualIncome';
            if (cleanLabel.includes('occupation') || cleanLabel.includes('profession')) return 'occupation';
            if (cleanLabel.includes('state') || cleanLabel.includes('pradesh')) return 'state';
            if (cleanLabel.includes('district') || cleanLabel.includes('zilla')) return 'district';
            if (cleanLabel.includes('address') || cleanLabel.includes('residence')) return 'address';
            if (cleanLabel.includes('pincode') || cleanLabel.includes('pin code')) return 'pincode';
            if (cleanLabel.includes('category') || cleanLabel.includes('caste')) return 'category';
            if (cleanLabel.includes('aadhaar') || cleanLabel.includes('aadhar')) return 'aadhaar';
            if (cleanLabel.includes('pan')) return 'pan';
            if (cleanLabel.includes('marital status')) return 'maritalStatus';

            // Fallback to generic name
            return cleanLabel.replace(/[^a-zA-Z0-9]/g, '');
        }


    /**
     * Map user profile data to form field with enhanced Indian government form support
     */
    mapProfileDataToField(field, userProfile) {
        const fieldName = field.name.toLowerCase();
        
        // Enhanced mappings for Indian government forms
        const mappings = {
            'name': userProfile.name,
            'fullname': userProfile.name,
            'applicantname': userProfile.name,
            'firstname': userProfile.name?.split(' ')[0],
            'lastname': userProfile.name?.split(' ').slice(1).join(' '),
            'fathername': userProfile.father_name,
            'mothername': userProfile.mother_name,
            'email': userProfile.email,
            'phone': userProfile.phone_number,
            'mobile': userProfile.phone_number,
            'contact': userProfile.phone_number,
            'age': userProfile.age?.toString(),
            'dateofbirth': userProfile.date_of_birth,
            'dob': userProfile.date_of_birth,
            'gender': this.formatGender(userProfile.gender),
            'income': userProfile.annual_income?.toString(),
            'annualincome': userProfile.annual_income?.toString(),
            'yearlyincome': userProfile.annual_income?.toString(),
            'occupation': userProfile.occupation,
            'profession': userProfile.occupation,
            'job': userProfile.occupation,
            'state': userProfile.state,
            'district': userProfile.district,
            'address': userProfile.address,
            'residence': userProfile.address,
            'pincode': userProfile.pin_code,
            'postalcode': userProfile.pin_code,
            'category': this.formatCategory(userProfile.category),
            'caste': this.formatCategory(userProfile.category),
            'reservation': this.formatCategory(userProfile.category),
            'aadhaar': userProfile.aadhaar_number,
            'aadhar': userProfile.aadhaar_number,
            'uid': userProfile.aadhaar_number,
            'pan': userProfile.pan_number,
            'bankaccount': userProfile.bank_account_number,
            'accountnumber': userProfile.bank_account_number,
            'ifsc': userProfile.ifsc_code,
            'bankcode': userProfile.ifsc_code,
            'maritalstatus': this.formatMaritalStatus(userProfile.marital_status),
            'married': this.formatMaritalStatus(userProfile.marital_status),
            'familysize': userProfile.family_size?.toString(),
            'householdsize': userProfile.family_size?.toString(),
            'disability': this.formatBoolean(userProfile.is_disabled),
            'handicap': this.formatBoolean(userProfile.is_disabled),
            'bpl': this.formatBoolean(userProfile.is_bpl),
            'belowpoverty': this.formatBoolean(userProfile.is_bpl),
            'rationcard': userProfile.ration_card_number,
            'foodcard': userProfile.ration_card_number,
            'voterid': userProfile.voter_id,
            'epic': userProfile.voter_id
        };
        
        // Try exact match first
        if (mappings[fieldName]) {
            return mappings[fieldName];
        }
        
        // Try partial matches
        for (const [key, value] of Object.entries(mappings)) {
            if (fieldName.includes(key) && value) {
                return value;
            }
        }
        
        return null;
    }

    /**
     * Format gender for government forms
     */
    formatGender(gender) {
        if (!gender) return null;
        const g = gender.toLowerCase();
        if (g.includes('male') && !g.includes('female')) return 'Male';
        if (g.includes('female')) return 'Female';
        if (g.includes('other') || g.includes('third')) return 'Other';
        return gender;
    }

    /**
     * Format category for government forms
     */
    formatCategory(category) {
        if (!category) return null;
        const c = category.toLowerCase();
        if (c.includes('general')) return 'General';
        if (c.includes('obc')) return 'OBC';
        if (c.includes('sc')) return 'SC';
        if (c.includes('st')) return 'ST';
        if (c.includes('ews')) return 'EWS';
        return category;
    }

    /**
     * Format marital status for government forms
     */
    formatMaritalStatus(status) {
        if (!status) return null;
        const s = status.toLowerCase();
        if (s.includes('single') || s.includes('unmarried')) return 'Single';
        if (s.includes('married')) return 'Married';
        if (s.includes('divorced')) return 'Divorced';
        if (s.includes('widow')) return 'Widowed';
        return status;
    }

    /**
     * Format boolean values for government forms
     */
    formatBoolean(value) {
        if (value === true || value === 1 || value === '1') return 'Yes';
        if (value === false || value === 0 || value === '0') return 'No';
        return null;
    }

    /**
     * Get browser session URL for user to continue (agent-browser specific)
     */
    async getBrowserSessionUrl(sessionId) {
        try {
            // Get CDP URL for the session
            const cdpUrl = await this.executeCommand(sessionId, 'get', ['cdp-url']);
            return cdpUrl;
        } catch (error) {
            console.error('Failed to get session URL:', error);
            // Return a message instead of URL since agent-browser manages the session
            return `Session ${sessionId} is active. Use agent-browser commands to continue.`;
        }
    }

    /**
     * Close browser session
     */
    async closeBrowserSession(sessionId) {
        try {
            await this.executeCommand(sessionId, 'close');
            this.sessions.delete(sessionId);
            console.log(`Closed browser session: ${sessionId}`);
            return true;
        } catch (error) {
            console.error('Failed to close session:', error);
            // Still remove from our tracking even if close failed
            this.sessions.delete(sessionId);
            return false;
        }
    }

    /**
     * Utility function for delays
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Clean up old sessions and temp files
     */
    async cleanup() {
        const now = new Date();
        const maxAge = 30 * 60 * 1000; // 30 minutes
        
        for (const [sessionId, session] of this.sessions.entries()) {
            if (now - session.createdAt > maxAge) {
                await this.closeBrowserSession(sessionId);
            }
        }
        
        // Clean up old temp files
        try {
            const files = await fs.readdir(this.tempDir);
            for (const file of files) {
                const filePath = path.join(this.tempDir, file);
                const stats = await fs.stat(filePath);
                if (now - stats.mtime > maxAge) {
                    await fs.unlink(filePath);
                }
            }
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    }
}

module.exports = BrowserAutomationService;