/**
 * Robust voice intent parser.
 * Uses a scoring approach — every intent accumulates evidence points,
 * highest score wins. No single regex can block a correct result.
 */

export type VoiceIntent =
  | 'navigate' | 'search' | 'filter' | 'clear_filters'
  | 'save_scheme' | 'go_back' | 'help' | 'stop' | 'unknown';

export interface ParsedIntent {
  intent: VoiceIntent;
  entities: {
    page?: string;
    query?: string;
    category?: string;
    level?: string;
    state?: string;
    beneficiary?: string;
  };
  confidence: number;
  rawTranscript: string;
}

// ─── Page definitions ─────────────────────────────────────────────────────────
const PAGES = [
  { page: '/dashboard', words: ['dashboard', 'home', 'main', 'homepage', 'start'] },
  { page: '/profile',   words: ['profile', 'account', 'settings', 'personal', 'my info', 'edit profile', 'update profile'] },
  { page: '/saved',     words: ['saved', 'bookmark', 'bookmarks', 'favourites', 'favorites', 'my saved', 'wishlist'] },
  { page: '/search',    words: ['search page', 'browse', 'explore'] },
  { page: '/applications', words: ['application', 'applications', 'applied', 'track', 'my application'] },
];

// ─── Navigation verbs ─────────────────────────────────────────────────────────
const NAV_VERBS = [
  'go', 'open', 'take me', 'navigate', 'switch', 'move', 'jump',
  'visit', 'load', 'launch', 'head', 'return', 'back to', 'show my',
  'show me my', 'bring me', 'i want to go', 'i want to see my',
  'i want to open', 'let me see', 'let me go',
];

// ─── Search verbs ─────────────────────────────────────────────────────────────
const SEARCH_VERBS = [
  'search', 'find', 'look', 'get', 'fetch', 'list', 'display',
  'show me schemes', 'show schemes', 'find schemes', 'search for',
];

// ─── States ───────────────────────────────────────────────────────────────────
const STATES: Record<string, string> = {
  'andhra pradesh': 'Andhra Pradesh', 'arunachal pradesh': 'Arunachal Pradesh',
  'assam': 'Assam', 'bihar': 'Bihar', 'chhattisgarh': 'Chhattisgarh',
  'goa': 'Goa', 'gujarat': 'Gujarat', 'haryana': 'Haryana',
  'himachal pradesh': 'Himachal Pradesh', 'jharkhand': 'Jharkhand',
  'karnataka': 'Karnataka', 'kerala': 'Kerala', 'madhya pradesh': 'Madhya Pradesh',
  'maharashtra': 'Maharashtra', 'manipur': 'Manipur', 'meghalaya': 'Meghalaya',
  'mizoram': 'Mizoram', 'nagaland': 'Nagaland', 'odisha': 'Odisha',
  'punjab': 'Punjab', 'rajasthan': 'Rajasthan', 'sikkim': 'Sikkim',
  'tamil nadu': 'Tamil Nadu', 'telangana': 'Telangana', 'tripura': 'Tripura',
  'uttar pradesh': 'Uttar Pradesh', 'uttarakhand': 'Uttarakhand',
  'west bengal': 'West Bengal', 'delhi': 'Delhi',
};

// ─── Categories ───────────────────────────────────────────────────────────────
const CATEGORIES: [RegExp, string][] = [
  [/\b(education|educational|scholarship|scholarships|study|studies|school|college|university|academic)\b/, 'education'],
  [/\b(health|medical|medicine|hospital|healthcare|treatment|disease)\b/, 'health'],
  [/\b(agriculture|agricultural|farming|farm|farmer|kisan|crop|crops)\b/, 'agriculture'],
  [/\b(employment|job|jobs|work|career|employment)\b/, 'employment'],
  [/\b(housing|house|home|shelter|accommodation|flat|apartment)\b/, 'housing'],
  [/\b(women|woman|female|girl|girls|mahila)\b/, 'women'],
  [/\b(children|child|kids|kid|minor|bal)\b/, 'children'],
  [/\b(disability|disabled|divyang|handicap|differently abled)\b/, 'disability'],
  [/\b(senior citizen|elderly|old age|pension|pensioner|vridha)\b/, 'senior citizen'],
  [/\b(skill|skills|training|vocational|apprentice)\b/, 'skill development'],
  [/\b(financial|finance|loan|loans|subsidy|subsidies|money|fund)\b/, 'financial'],
  [/\b(social welfare|welfare|social)\b/, 'social welfare'],
];

// ─── Beneficiaries ────────────────────────────────────────────────────────────
const BENEFICIARIES: [RegExp, string][] = [
  [/\bstudents?\b/, 'student'],
  [/\bfarmers?\b/, 'farmer'],
  [/\b(women|woman|female)\b/, 'women'],
  [/\byouth\b/, 'youth'],
  [/\b(disabled|divyang)\b/, 'disabled'],
  [/\b(bpl|below poverty|poor)\b/, 'bpl'],
  [/\b(minority|minorities)\b/, 'minority'],
  [/\b(sc|st|scheduled caste|scheduled tribe)\b/, 'sc/st'],
  [/\bobc\b/, 'obc'],
];

// ─── Noise to strip from search query ────────────────────────────────────────
// These are action phrases that should not be part of the search query
const QUERY_NOISE: RegExp[] = [
  /\b(and\s+)?(then\s+)?(click|press|tap|autofill|auto.?fill|fill|apply|open|select|save|bookmark)\b.*/i,
  /\b(the\s+)?(first|second|third|1st|2nd|3rd|top|last)\s+(one|result|scheme|item|card)\b.*/i,
  /\bfor me\b/i,
  /\bplease\b/i,
  /\bcan you\b/i,
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalize(text: string) {
  return text.toLowerCase().replace(/['']/g, "'").trim();
}

function hasAny(text: string, words: string[]): boolean {
  return words.some(w => text.includes(w));
}

function extractState(text: string): string | undefined {
  // Multi-word states first
  for (const [key, val] of Object.entries(STATES)) {
    if (key.includes(' ') && text.includes(key)) return val;
  }
  for (const [key, val] of Object.entries(STATES)) {
    if (!key.includes(' ') && new RegExp(`\\b${key}\\b`).test(text)) return val;
  }
}

function extractCategory(text: string): string | undefined {
  for (const [re, cat] of CATEGORIES) {
    if (re.test(text)) return cat;
  }
}

function extractBeneficiary(text: string): string | undefined {
  for (const [re, ben] of BENEFICIARIES) {
    if (re.test(text)) return ben;
  }
}

function extractLevel(text: string): string | undefined {
  if (/\b(central|national|centre|central government)\b/.test(text)) return 'central';
  if (/\bstate\b/.test(text)) return 'state';
}

function extractPage(text: string): string | undefined {
  for (const { page, words } of PAGES) {
    if (hasAny(text, words)) return page;
  }
}

function cleanQuery(text: string): string {
  let q = text;

  // Remove leading command phrase
  q = q.replace(/^(please\s+)?(can you\s+)?(search|find|look\s*up|look\s*for|show\s*me|get\s*me|fetch|bring\s*up|list|display)\s+(all\s+)?(the\s+)?(schemes?\s+)?(for|about|related\s+to|on|regarding)?\s*/i, '');

  // Remove trailing action noise
  for (const re of QUERY_NOISE) {
    q = q.replace(re, '');
  }

  // Remove generic filler
  q = q
    .replace(/\b(schemes?|programs?|benefits?|government|yojana|please|can you|for me|in india)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return q;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function parseVoiceIntent(transcript: string): ParsedIntent {
  const text = normalize(transcript);

  // ── Hard-coded high-confidence intents ──────────────────────────────────────

  if (/\b(stop|cancel|never mind|nevermind|quit|exit|abort)\b/.test(text)) {
    return { intent: 'stop', entities: {}, confidence: 1, rawTranscript: transcript };
  }

  if (/\b(help|what can you do|commands|options|instructions|what do you do)\b/.test(text)) {
    return { intent: 'help', entities: {}, confidence: 1, rawTranscript: transcript };
  }

  if (/\b(go back|back|previous page|previous screen|go to previous)\b/.test(text)) {
    return { intent: 'go_back', entities: {}, confidence: 1, rawTranscript: transcript };
  }

  if (/\b(save this|save the scheme|bookmark this|add to saved|save it)\b/.test(text)) {
    return { intent: 'save_scheme', entities: {}, confidence: 1, rawTranscript: transcript };
  }

  if (/\b(clear|reset|remove)\b.{0,15}\b(filter|filters|all)\b/.test(text)) {
    return { intent: 'clear_filters', entities: {}, confidence: 1, rawTranscript: transcript };
  }

  if (/\b(filter|show only|only show|narrow down|filter by)\b/.test(text)) {
    return {
      intent: 'filter',
      entities: {
        category: extractCategory(text),
        level: extractLevel(text),
        state: extractState(text),
        beneficiary: extractBeneficiary(text),
      },
      confidence: 0.9,
      rawTranscript: transcript,
    };
  }

  // ── Scoring: navigate vs search ──────────────────────────────────────────────
  let navScore = 0;
  let searchScore = 0;

  // Nav evidence
  if (hasAny(text, NAV_VERBS)) navScore += 3;
  const page = extractPage(text);
  if (page) navScore += 4;

  // Search evidence
  if (hasAny(text, SEARCH_VERBS)) searchScore += 3;
  const category = extractCategory(text);
  const state = extractState(text);
  const beneficiary = extractBeneficiary(text);
  if (category) searchScore += 2;
  if (state) searchScore += 1;
  if (beneficiary) searchScore += 1;

  // "show me" is ambiguous — lean nav if page found, lean search if category found
  if (/\bshow me\b/.test(text) && page && !category) navScore += 2;
  if (/\bshow me\b/.test(text) && category && !page) searchScore += 2;

  // Short utterance with a page word = almost certainly navigation
  if (text.split(' ').length <= 3 && page) navScore += 3;

  // Explicit search phrase overrides nav
  if (/\b(search for|find schemes|look for schemes|show me schemes)\b/.test(text)) {
    searchScore += 4;
    navScore = Math.max(0, navScore - 3);
  }

  if (navScore > searchScore && page) {
    return {
      intent: 'navigate',
      entities: { page },
      confidence: Math.min(0.99, 0.6 + navScore * 0.05),
      rawTranscript: transcript,
    };
  }

  // ── Search ───────────────────────────────────────────────────────────────────
  if (searchScore > 0 || hasAny(text, SEARCH_VERBS)) {
    const query = cleanQuery(text);
    return {
      intent: 'search',
      entities: {
        query: query || undefined,
        category,
        level: extractLevel(text),
        state,
        beneficiary,
      },
      confidence: Math.min(0.95, 0.5 + searchScore * 0.08),
      rawTranscript: transcript,
    };
  }

  // ── Fallback ─────────────────────────────────────────────────────────────────
  return {
    intent: 'search',
    entities: { query: cleanQuery(text) || text },
    confidence: 0.3,
    rawTranscript: transcript,
  };
}
