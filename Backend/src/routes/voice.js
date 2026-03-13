const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SYSTEM_PROMPT = `You are a voice command parser for SchemeSync, a government welfare schemes discovery app.

The app has these pages: /dashboard, /profile, /saved, /search, /applications

Given a voice transcript, extract the user's intent and entities. Respond ONLY with valid JSON, no markdown, no explanation.

Intent types:
- "navigate" — user wants to go to a page
- "search" — user wants to search for schemes
- "filter" — user wants to filter results on the search page
- "clear_filters" — user wants to clear all filters
- "save_scheme" — user wants to save the current scheme
- "go_back" — user wants to go back
- "help" — user wants help
- "stop" — user wants to cancel

Entities to extract:
- page: one of /dashboard, /profile, /saved, /search, /applications (only for navigate intent)
- query: clean search keywords only, no action words (only for search intent)
- category: one of education, health, agriculture, employment, housing, women, children, disability, senior citizen, skill development, financial (if mentioned)
- level: "central" or "state" (if mentioned)
- state: Indian state name (if mentioned)
- beneficiary: student, farmer, women, youth, disabled, bpl, minority, obc (if mentioned)

Rules:
- For "search for educational schemes and click autofill" → intent=search, query="educational", ignore the "click autofill" part
- For "go to dashboard" or "open dashboard" or "take me to dashboard" → intent=navigate, page=/dashboard
- For "show me farming schemes in Maharashtra" → intent=search, query="farming", state="Maharashtra"
- Strip all action words (click, autofill, apply, open, show, find, search for) from the query
- query should be clean keywords only like "education", "farming Maharashtra", "health for women"
- If the user says a page name with any navigation word, always use navigate intent

Response format (strict JSON):
{
  "intent": "search",
  "entities": {
    "query": "education",
    "category": "education",
    "level": null,
    "state": null,
    "beneficiary": "student",
    "page": null
  },
  "confidence": 0.95
}`;

router.post('/parse', optionalAuth, async (req, res) => {
    try {
        const { transcript } = req.body;
        if (!transcript || typeof transcript !== 'string') {
            return res.status(400).json({ success: false, message: 'transcript is required' });
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent([
            SYSTEM_PROMPT,
            `Voice transcript: "${transcript.trim()}"`
        ]);

        const raw = result.response.text().trim();

        // Strip markdown code fences if Gemini wraps in ```json
        const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

        let parsed;
        try {
            parsed = JSON.parse(cleaned);
        } catch {
            console.error('Gemini returned non-JSON:', raw);
            return res.status(500).json({ success: false, message: 'Failed to parse AI response' });
        }

        res.json({ success: true, data: parsed });
    } catch (error) {
        console.error('Voice parse error:', error?.message || error);
        console.error('Full error:', JSON.stringify(error, null, 2));
        res.status(500).json({ success: false, message: error?.message || 'Voice parsing failed' });
    }
});

module.exports = router;
