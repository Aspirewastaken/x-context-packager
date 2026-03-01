/**
 * Tests for the DOM Resilience & Adaptation System
 *
 * These tests extract and validate the logic from content.js without
 * requiring a browser DOM or Chrome extension APIs.
 */

const fs = require('fs');
const path = require('path');

const contentSource = fs.readFileSync(
  path.join(__dirname, '../../content/content.js'),
  'utf8'
);

function extractObjectFromSource(source, varName) {
  const regex = new RegExp(`const ${varName} = \\{`, 'g');
  const match = regex.exec(source);
  if (!match) return null;

  let depth = 0;
  let start = match.index + match[0].length - 1;
  let end = start;

  for (let i = start; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }

  const objectStr = source.substring(start, end);
  try {
    return new Function(`return ${objectStr}`)();
  } catch (_e) {
    return null;
  }
}

const SELECTORS = extractObjectFromSource(contentSource, 'SELECTORS');
const SELECTOR_FALLBACKS = extractObjectFromSource(contentSource, 'SELECTOR_FALLBACKS');

function calculateTweetQuality(tweet) {
  if (!tweet) return 0;

  const dimensions = [];

  const hasName = !!tweet.author?.name;
  const hasHandle = !!tweet.author?.handle;
  if (hasName && hasHandle) dimensions.push({ score: 1.0, weight: 3 });
  else if (hasHandle) dimensions.push({ score: 0.7, weight: 3 });
  else if (hasName) dimensions.push({ score: 0.5, weight: 3 });
  else dimensions.push({ score: 0.1, weight: 3 });

  if (tweet.text && tweet.text.length > 0) {
    dimensions.push({ score: 1.0, weight: 3 });
  } else {
    dimensions.push({ score: 0.2, weight: 3 });
  }

  const hasTime = !!(tweet.timestamp?.iso || tweet.timestamp?.display);
  dimensions.push({ score: hasTime ? 1.0 : 0.5, weight: 1 });

  const engagementValues = Object.values(tweet.engagement || {});
  const hasEngagement = engagementValues.some(v => v !== null && v !== undefined);
  dimensions.push({ score: hasEngagement ? 1.0 : 0.6, weight: 1 });

  const textMentionsMedia = tweet.text && (
    tweet.text.includes('http') || tweet.text.includes('pic.twitter') || tweet.text.includes('t.co/')
  );
  const hasMedia = (tweet.links?.length > 0) || (tweet.images?.length > 0) || (tweet.linkCard);
  if (textMentionsMedia && !hasMedia) {
    dimensions.push({ score: 0.4, weight: 2 });
  } else {
    dimensions.push({ score: 1.0, weight: 2 });
  }

  const totalWeight = dimensions.reduce((s, d) => s + d.weight, 0);
  const weightedSum = dimensions.reduce((s, d) => s + d.score * d.weight, 0);
  return totalWeight > 0 ? weightedSum / totalWeight : 1.0;
}

function classifyHealthLevel(qualityScore, fallbacksTriggered, selfHealingUsed) {
  if (qualityScore < 0.5 || selfHealingUsed > 10) return 'needs_attention';
  if (qualityScore < 0.8 || fallbacksTriggered > 5 || selfHealingUsed > 3) return 'monitoring';
  return 'healthy';
}

describe('DOM Resilience System', () => {

  describe('SELECTOR_FALLBACKS coverage', () => {
    test('SELECTORS object is extractable from source', () => {
      expect(SELECTORS).not.toBeNull();
      expect(typeof SELECTORS).toBe('object');
    });

    test('SELECTOR_FALLBACKS object is extractable from source', () => {
      expect(SELECTOR_FALLBACKS).not.toBeNull();
      expect(typeof SELECTOR_FALLBACKS).toBe('object');
    });

    test('critical SELECTORS keys have SELECTOR_FALLBACKS entries', () => {
      const critical = ['tweet', 'tweetText', 'userName', 'tweetPhoto', 'reply', 'like', 'retweet',
                        'verifiedBadge', 'quoteTweet', 'cardWrapper', 'profileHeader', 'profileBio'];
      for (const key of critical) {
        expect(SELECTOR_FALLBACKS).toHaveProperty(key);
      }
    });

    test('every fallback entry has required fields', () => {
      for (const [_key, fallbacks] of Object.entries(SELECTOR_FALLBACKS)) {
        expect(Array.isArray(fallbacks)).toBe(true);
        expect(fallbacks.length).toBeGreaterThanOrEqual(2);

        for (const fb of fallbacks) {
          expect(fb).toHaveProperty('selector');
          expect(fb).toHaveProperty('confidence');
          expect(fb).toHaveProperty('strategy');
          expect(typeof fb.selector).toBe('string');
          expect(typeof fb.confidence).toBe('number');
          expect(fb.confidence).toBeGreaterThanOrEqual(0);
          expect(fb.confidence).toBeLessThanOrEqual(1);
        }
      }
    });

    test('fallbacks are ordered by descending confidence', () => {
      for (const [_key, fallbacks] of Object.entries(SELECTOR_FALLBACKS)) {
        for (let i = 1; i < fallbacks.length; i++) {
          expect(fallbacks[i].confidence).toBeLessThanOrEqual(fallbacks[i - 1].confidence);
        }
      }
    });

    test('primary selector (confidence 1.0) exists for each fallback group', () => {
      for (const [_key, fallbacks] of Object.entries(SELECTOR_FALLBACKS)) {
        const primary = fallbacks.find(f => f.confidence === 1.0);
        expect(primary).toBeDefined();
      }
    });
  });

  describe('CSS selector compatibility', () => {
    test('all SELECTORS values are non-empty strings', () => {
      for (const selector of Object.values(SELECTORS)) {
        expect(typeof selector).toBe('string');
        expect(selector.length).toBeGreaterThan(0);
      }
    });
  });

  describe('calculateTweetQuality', () => {
    test('perfect tweet gets score near 1.0', () => {
      const tweet = {
        author: { name: 'Test User', handle: '@test' },
        text: 'Hello world',
        timestamp: { iso: '2026-01-01T00:00:00Z', display: 'Jan 1' },
        engagement: { replies: '5', likes: '10', retweets: '3' },
        links: [], images: [], linkCard: null
      };
      expect(calculateTweetQuality(tweet)).toBeGreaterThanOrEqual(0.9);
    });

    test('tweet missing author scores lower', () => {
      const full = {
        author: { name: 'User', handle: '@user' },
        text: 'Hello', timestamp: { iso: '2026-01-01T00:00:00Z' },
        engagement: { replies: '5' }, links: [], images: []
      };
      const noAuthor = {
        author: { name: null, handle: null },
        text: 'Hello', timestamp: { iso: '2026-01-01T00:00:00Z' },
        engagement: { replies: '5' }, links: [], images: []
      };
      expect(calculateTweetQuality(noAuthor)).toBeLessThan(calculateTweetQuality(full));
    });

    test('tweet missing text scores lower', () => {
      const tweet = {
        author: { name: 'User', handle: '@user' },
        text: null, timestamp: { iso: '2026-01-01T00:00:00Z' },
        engagement: { replies: '5' }, links: [], images: []
      };
      expect(calculateTweetQuality(tweet)).toBeLessThan(0.8);
    });

    test('null tweet returns 0', () => {
      expect(calculateTweetQuality(null)).toBe(0);
    });
  });

  describe('classifyHealthLevel', () => {
    test('high quality with no fallbacks is healthy', () => {
      expect(classifyHealthLevel(1.0, 0, 0)).toBe('healthy');
      expect(classifyHealthLevel(0.95, 2, 0)).toBe('healthy');
    });

    test('degraded quality triggers monitoring', () => {
      expect(classifyHealthLevel(0.7, 0, 0)).toBe('monitoring');
    });

    test('many fallbacks trigger monitoring', () => {
      expect(classifyHealthLevel(0.95, 6, 0)).toBe('monitoring');
    });

    test('very low quality triggers needs_attention', () => {
      expect(classifyHealthLevel(0.3, 0, 0)).toBe('needs_attention');
    });

    test('excessive self-healing triggers needs_attention', () => {
      expect(classifyHealthLevel(0.95, 0, 11)).toBe('needs_attention');
    });
  });

  describe('source code invariants', () => {
    test('content script is wrapped in IIFE', () => {
      const trimmed = contentSource.trim();
      expect(trimmed.startsWith('/**')).toBe(true);
      expect(trimmed.endsWith('})();')).toBe(true);
    });

    test('SELECTORS object is defined before SELECTOR_FALLBACKS', () => {
      const selIdx = contentSource.indexOf('const SELECTORS = {');
      const fbIdx = contentSource.indexOf('const SELECTOR_FALLBACKS = {');
      expect(selIdx).toBeLessThan(fbIdx);
    });

    test('resilientQuerySelectorAll is defined', () => {
      expect(contentSource).toMatch(/function resilientQuerySelectorAll/);
    });

    test('resilientQuerySelectorSingle is defined', () => {
      expect(contentSource).toMatch(/function resilientQuerySelectorSingle/);
    });

    test('auto-starting monitors are disabled', () => {
      expect(contentSource).not.toMatch(/DOM_CHANGE_MONITOR\.scheduleValidation\(\)/);
      expect(contentSource).not.toMatch(/COMMUNITY_CONTRIBUTIONS\.validateSubmissions\(\)/);
    });
  });

  describe('fallback strategy diversity', () => {
    test('critical selectors have at least 4 fallback strategies', () => {
      const criticalKeys = ['tweet', 'tweetText', 'userName', 'reply', 'like', 'retweet'];
      for (const key of criticalKeys) {
        expect(SELECTOR_FALLBACKS[key]).toBeDefined();
        expect(SELECTOR_FALLBACKS[key].length).toBeGreaterThanOrEqual(4);
      }
    });

    test('each selector group uses multiple strategy types', () => {
      for (const [_key, fallbacks] of Object.entries(SELECTOR_FALLBACKS)) {
        const strategies = new Set(fallbacks.map(f => f.strategy));
        expect(strategies.size).toBeGreaterThanOrEqual(2);
      }
    });

    test('no two fallbacks in same group have identical selectors', () => {
      for (const [_key, fallbacks] of Object.entries(SELECTOR_FALLBACKS)) {
        const selectors = fallbacks.map(f => f.selector);
        const unique = new Set(selectors);
        expect(unique.size).toBe(selectors.length);
      }
    });
  });
});
