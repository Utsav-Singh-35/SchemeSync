const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getDatabase } = require('../database/connection');

class IntelligentNavigationService {
  constructor() {
    // Initialize Google Gemini instead of OpenAI
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'demo-key');
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    this.db = getDatabase();
    this.maxAnalysisLength = 50000;
    this.confidenceThreshold = 0.7;
    this.knowledgeBase = this.initializeKnowledgeBase();
  }

  initializeKnowledgeBase() {
    return {
      // Common patterns for Indian government portals
      loginPatterns: [
        { pattern: 'digilocker', action: 'digilocker_login', confidence: 0.9 },
        { pattern: 'aadhaar.*login', action: 'aadhaar_login', confidence: 0.85 },
        { pattern: 'mobile.*otp', action: 'mobile_otp_login', confidence: 0.8 },
        { pattern: 'user.*id.*password', action: 'credential_login', confidence: 0.75 }
      ],
      
      navigationPatterns: [
        { pattern: 'apply.*online', action: 'click_apply', confidence: 0.9 },
        { pattern: 'new.*application', action: 'click_new_application', confidence: 0.85 },
        { pattern: 'citizen.*services', action: 'click_citizen_services', confidence: 0.8 },
        { pattern: 'registration.*form', action: 'click_registration', confidence: 0.75 }
      ],
      
      formPatterns: [
        { pattern: 'applicant.*name', type: 'application_form', confidence: 0.9 },
        { pattern: 'beneficiary.*details', type: 'application_form', confidence: 0.85 },
        { pattern: 'personal.*information', type: 'application_form', confidence: 0.8 }
      ],
      
      blockingPatterns: [
        { pattern: 'applications.*closed', status: 'closed', confidence: 0.9 },
        { pattern: 'online.*not.*available', status: 'offline_only', confidence: 0.85 },
        { pattern: 'maintenance.*mode', status: 'maintenance', confidence: 0.8 }
      ]
    };
  }

  async analyzePageIntelligently(pageData) {
    const { url, html, screenshot, objective, userContext, sessionHistory } = pageData;
    
    try {
      // 1. Pre-process and clean HTML
      const cleanedHtml = this.preprocessHTML(html);
      
      // 2. Apply pattern-based quick analysis
      const patternAnalysis = this.applyPatternAnalysis(cleanedHtml, url);
      
      // 3. If pattern analysis is confident enough, return immediately
      if (patternAnalysis.confidence > 0.85) {
        await this.logAnalysis(url, patternAnalysis, 'pattern_based');
        return patternAnalysis;
      }
      
      // 4. Use LLM for complex analysis
      const llmAnalysis = await this.performLLMAnalysis(cleanedHtml, url, objective, userContext, sessionHistory);
      
      // 5. Combine pattern and LLM analysis
      const finalAnalysis = this.combineAnalyses(patternAnalysis, llmAnalysis);
      
      // 6. Log for learning
      await this.logAnalysis(url, finalAnalysis, 'llm_enhanced');
      
      return finalAnalysis;
      
    } catch (error) {
      console.error('Page analysis failed:', error);
      return this.getFallbackAnalysis(url, error);
    }
  }

  preprocessHTML(html) {
    // Remove scripts, styles, and other noise
    let cleaned = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Limit size for LLM processing
    if (cleaned.length > this.maxAnalysisLength) {
      // Extract key sections: forms, navigation, main content
      const keyContent = this.extractKeyContent(cleaned);
      cleaned = keyContent.substring(0, this.maxAnalysisLength);
    }
    
    return cleaned;
  }

  extractKeyContent(html) {
    const keySelectors = [
      'form', 'nav', 'main', '.main-content', '#main',
      '.login', '.application', '.form', '.content',
      'header', '.header', '.navigation', '.menu'
    ];
    
    // This would use a proper HTML parser in production
    let keyContent = '';
    keySelectors.forEach(selector => {
      const regex = new RegExp(`<[^>]*class[^>]*${selector.replace('.', '')}[^>]*>.*?</[^>]*>`, 'gi');
      const matches = html.match(regex);
      if (matches) {
        keyContent += matches.join(' ');
      }
    });
    
    return keyContent || html;
  }

  applyPatternAnalysis(html, url) {
    const lowerHtml = html.toLowerCase();
    const domain = new URL(url).hostname;
    
    let bestMatch = { confidence: 0, action: 'analyze_further' };
    
    // Check for blocking patterns first
    for (const pattern of this.knowledgeBase.blockingPatterns) {
      if (new RegExp(pattern.pattern, 'i').test(lowerHtml)) {
        return {
          action: 'blocked',
          status: pattern.status,
          confidence: pattern.confidence,
          reasoning: `Detected blocking pattern: ${pattern.pattern}`,
          element: null,
          data: null
        };
      }
    }
    
    // Check for form patterns
    for (const pattern of this.knowledgeBase.formPatterns) {
      if (new RegExp(pattern.pattern, 'i').test(lowerHtml)) {
        if (pattern.confidence > bestMatch.confidence) {
          bestMatch = {
            action: 'form_found',
            type: pattern.type,
            confidence: pattern.confidence,
            reasoning: `Detected form pattern: ${pattern.pattern}`,
            element: 'form',
            data: null
          };
        }
      }
    }
    
    // Check for login patterns
    for (const pattern of this.knowledgeBase.loginPatterns) {
      if (new RegExp(pattern.pattern, 'i').test(lowerHtml)) {
        if (pattern.confidence > bestMatch.confidence) {
          bestMatch = {
            action: 'login_required',
            loginType: pattern.action,
            confidence: pattern.confidence,
            reasoning: `Detected login pattern: ${pattern.pattern}`,
            element: this.findLoginElement(html, pattern.pattern),
            data: this.getLoginData(pattern.action)
          };
        }
      }
    }
    
    // Check for navigation patterns
    for (const pattern of this.knowledgeBase.navigationPatterns) {
      if (new RegExp(pattern.pattern, 'i').test(lowerHtml)) {
        if (pattern.confidence > bestMatch.confidence) {
          bestMatch = {
            action: 'click_element',
            target: pattern.action,
            confidence: pattern.confidence,
            reasoning: `Detected navigation pattern: ${pattern.pattern}`,
            element: this.findNavigationElement(html, pattern.pattern),
            data: null
          };
        }
      }
    }
    
    return bestMatch;
  }
  async performLLMAnalysis(html, url, objective, userContext, sessionHistory) {
      const domain = new URL(url).hostname;
      const historyContext = sessionHistory ? sessionHistory.slice(-3).map(h => 
        `Step ${h.step}: ${h.action} on ${h.url} - ${h.result}`
      ).join('\n') : '';

      const systemPrompt = `You are an expert AI assistant specialized in navigating Indian government portals for scheme applications. 

  Your expertise includes:
  - Understanding complex government portal workflows
  - Identifying login methods (DigiLocker, Aadhaar, Mobile OTP)
  - Recognizing application forms vs information pages
  - Detecting when services are unavailable
  - Finding the optimal path to application forms

  Analyze the provided page and determine the next best action to reach the application form.

  CRITICAL RULES:
  1. NEVER suggest automated login - only credential filling
  2. Always prioritize user safety and manual confirmation
  3. Provide specific CSS selectors for elements
  4. Consider the full user journey, not just current page
  5. Detect when online applications are closed/unavailable`;

      const userPrompt = `
  CURRENT CONTEXT:
  - URL: ${url}
  - Domain: ${domain}
  - Objective: ${objective}
  - User Profile: ${JSON.stringify(userContext)}

  NAVIGATION HISTORY:
  ${historyContext}

  PAGE CONTENT:
  ${html}

  ANALYSIS REQUIRED:
  Analyze this government portal page and provide the next action to reach the application form.

  Respond with JSON in this exact format:
  {
    "action": "form_found|login_required|click_element|navigate|blocked|analyze_further",
    "confidence": 0.0-1.0,
    "reasoning": "detailed explanation of analysis",
    "element": "specific CSS selector or null",
    "data": {
      "loginType": "digilocker|aadhaar|mobile_otp|credentials",
      "formFields": ["field1", "field2"],
      "navigationTarget": "target description",
      "blockingReason": "why blocked"
    },
    "nextSteps": ["step1", "step2", "step3"],
    "userInstructions": "clear instructions for user",
    "fallbackOptions": ["option1", "option2"]
  }

  IMPORTANT: Be specific about CSS selectors and provide clear user instructions.`;

      try {
        // Combine system and user prompts for Gemini
        const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

        // Generate content using Gemini
        const result = await this.model.generateContent({
          contents: [{
            role: 'user',
            parts: [{ text: fullPrompt }]
          }],
          generationConfig: {
            temperature: 0.1, // Low temperature for consistent analysis
            maxOutputTokens: 1500,
            topP: 0.8,
            topK: 10
          }
        });

        const response = await result.response;
        const analysisText = response.text();

        // Parse JSON response
        let analysis;
        try {
          // Clean the response text to extract JSON
          const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            analysis = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('No JSON found in response');
          }
        } catch (parseError) {
          console.error('Failed to parse LLM response as JSON:', analysisText);
          throw new Error(`Invalid JSON response from LLM: ${parseError.message}`);
        }

        // Validate and enhance the response
        return this.validateLLMResponse(analysis, url);

      } catch (error) {
        console.error('LLM analysis failed:', error);

        // Provide more specific error handling for Gemini API
        if (error.message?.includes('API_KEY')) {
          throw new Error('Gemini API key is invalid or missing. Please set GEMINI_API_KEY environment variable.');
        } else if (error.message?.includes('quota')) {
          throw new Error('Gemini API quota exceeded. Please check your usage limits.');
        } else if (error.message?.includes('safety')) {
          throw new Error('Content was blocked by Gemini safety filters. Trying fallback analysis.');
        }

        throw new Error(`LLM analysis failed: ${error.message}`);
      }
    }


  validateLLMResponse(analysis, url) {
    // Ensure required fields exist
    const requiredFields = ['action', 'confidence', 'reasoning'];
    for (const field of requiredFields) {
      if (!analysis[field]) {
        throw new Error(`LLM response missing required field: ${field}`);
      }
    }

    // Validate confidence score
    if (analysis.confidence < 0 || analysis.confidence > 1) {
      analysis.confidence = Math.max(0, Math.min(1, analysis.confidence));
    }

    // Ensure data object exists
    if (!analysis.data) {
      analysis.data = {};
    }

    // Add metadata
    analysis.timestamp = new Date().toISOString();
    analysis.url = url;
    analysis.method = 'llm_analysis';

    return analysis;
  }

  combineAnalyses(patternAnalysis, llmAnalysis) {
    // If pattern analysis is highly confident, use it
    if (patternAnalysis.confidence > 0.85) {
      return {
        ...patternAnalysis,
        llmSupport: llmAnalysis,
        method: 'pattern_primary'
      };
    }

    // If LLM analysis is highly confident, use it
    if (llmAnalysis.confidence > 0.8) {
      return {
        ...llmAnalysis,
        patternSupport: patternAnalysis,
        method: 'llm_primary'
      };
    }

    // Combine both analyses
    const combinedConfidence = (patternAnalysis.confidence + llmAnalysis.confidence) / 2;
    
    return {
      action: llmAnalysis.action, // Prefer LLM for action
      confidence: combinedConfidence,
      reasoning: `Combined analysis: ${patternAnalysis.reasoning} | ${llmAnalysis.reasoning}`,
      element: llmAnalysis.element || patternAnalysis.element,
      data: { ...patternAnalysis.data, ...llmAnalysis.data },
      method: 'combined',
      patternAnalysis,
      llmAnalysis
    };
  }

  findLoginElement(html, pattern) {
    // Common login button selectors for government portals
    const loginSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      '.login-btn',
      '.signin-btn',
      '#login',
      '#signin',
      'a[href*="login"]',
      'button:contains("Login")',
      'button:contains("Sign In")',
      'button:contains("DigiLocker")'
    ];

    // This would use proper DOM parsing in production
    for (const selector of loginSelectors) {
      if (html.includes(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))) {
        return selector;
      }
    }

    return 'button[type="submit"]'; // Fallback
  }

  findNavigationElement(html, pattern) {
    // Common navigation selectors
    const navSelectors = [
      'a[href*="apply"]',
      'a[href*="application"]',
      'button:contains("Apply")',
      '.apply-btn',
      '.application-btn',
      '#apply',
      'a:contains("Apply Online")',
      'a:contains("New Application")'
    ];

    for (const selector of navSelectors) {
      if (html.includes(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))) {
        return selector;
      }
    }

    return 'a[href*="apply"]'; // Fallback
  }

  getLoginData(loginType) {
    const loginData = {
      digilocker_login: {
        method: 'digilocker',
        instructions: 'Click DigiLocker login and authenticate using your DigiLocker credentials',
        fields: []
      },
      aadhaar_login: {
        method: 'aadhaar',
        instructions: 'Enter your Aadhaar number for authentication',
        fields: ['aadhaar_number']
      },
      mobile_otp_login: {
        method: 'mobile_otp',
        instructions: 'Enter your mobile number to receive OTP',
        fields: ['mobile_number']
      },
      credential_login: {
        method: 'credentials',
        instructions: 'Enter your username and password',
        fields: ['username', 'password']
      }
    };

    return loginData[loginType] || loginData.credential_login;
  }

  getFallbackAnalysis(url, error) {
    return {
      action: 'analyze_further',
      confidence: 0.1,
      reasoning: `Analysis failed: ${error.message}. Manual intervention required.`,
      element: null,
      data: {
        error: error.message,
        fallback: true
      },
      userInstructions: 'Please manually navigate to the application form. The AI assistant encountered an error.',
      fallbackOptions: [
        'Look for "Apply Online" or "New Application" links',
        'Check the main navigation menu',
        'Search for application or registration forms'
      ]
    };
  }

  async logAnalysis(url, analysis, method) {
    try {
      await this.db.run(`
        INSERT INTO navigation_analysis_logs (
          url, domain, action, confidence, reasoning, method, 
          element, data, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        url,
        new URL(url).hostname,
        analysis.action,
        analysis.confidence,
        analysis.reasoning,
        method,
        analysis.element,
        JSON.stringify(analysis.data),
        new Date().toISOString()
      ]);
    } catch (error) {
      console.error('Failed to log analysis:', error);
    }
  }

  // Learning and improvement methods
  async updateKnowledgeBase(url, actualAction, success) {
    // Update pattern confidence based on success/failure
    const domain = new URL(url).hostname;
    
    try {
      await this.db.run(`
        INSERT OR REPLACE INTO navigation_patterns (
          domain, pattern, action, success_count, total_count, confidence, last_updated
        ) VALUES (?, ?, ?, 
          COALESCE((SELECT success_count FROM navigation_patterns WHERE domain = ? AND action = ?), 0) + ?,
          COALESCE((SELECT total_count FROM navigation_patterns WHERE domain = ? AND action = ?), 0) + 1,
          COALESCE((SELECT success_count FROM navigation_patterns WHERE domain = ? AND action = ?), 0) + ? / 
          (COALESCE((SELECT total_count FROM navigation_patterns WHERE domain = ? AND action = ?), 0) + 1),
          ?
        )
      `, [
        domain, 'learned_pattern', actualAction,
        domain, actualAction, success ? 1 : 0,
        domain, actualAction,
        domain, actualAction, success ? 1 : 0,
        domain, actualAction,
        new Date().toISOString()
      ]);
    } catch (error) {
      console.error('Failed to update knowledge base:', error);
    }
  }

  async getPortalInsights(domain) {
    try {
      const insights = await this.db.query(`
        SELECT action, AVG(confidence) as avg_confidence, COUNT(*) as frequency,
               SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as success_rate
        FROM navigation_analysis_logs nal
        LEFT JOIN navigation_feedback nf ON nal.url = nf.url
        WHERE nal.domain = ?
        GROUP BY action
        ORDER BY frequency DESC
      `, [domain]);

      return insights;
    } catch (error) {
      console.error('Failed to get portal insights:', error);
      return [];
    }
  }
}

module.exports = IntelligentNavigationService;