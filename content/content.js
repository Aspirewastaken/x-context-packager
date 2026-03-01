/**
 * X Context Packager — Content Script
 * AdLab Open Source · v1.0.0
 *
 * This is the extraction engine. It runs inside X.com pages when injected
 * by the popup via chrome.scripting.executeScript. It reads the DOM, extracts
 * all visible tweet/reply/profile context, normalizes it into a payload,
 * formats it into three output formats, and returns the result.
 *
 * ZERO network requests. ZERO API calls. DOM reading only.
 *
 * All selectors are centralized in the SELECTORS object below.
 * When X.com changes their DOM, only SELECTORS needs updating.
 */

(() => {
  'use strict';

  // =========================================================================
  // SELECTORS — Single source of truth for all X.com DOM selectors
  // =========================================================================

  const SELECTORS = {
    // Tweet containers
    tweet: '[data-testid="tweet"]',
    tweetText: '[data-testid="tweetText"]',
    userName: '[data-testid="User-Name"]',

    // Media
    tweetPhoto: '[data-testid="tweetPhoto"]',
    videoPlayer: '[data-testid="videoPlayer"], [data-testid="videoComponent"], video',
    gifIndicator: '[data-testid="gifPlayer"]',

    // Embedded content
    quoteTweet: '[data-testid="quoteTweet"]',
    cardWrapper: '[data-testid="card.wrapper"]',
    communityNote: '[data-testid="birdwatch-pivot"]',
    poll: '[data-testid="cardPoll"]',

    // Engagement (aria-label based)
    reply: '[data-testid="reply"]',
    retweet: '[data-testid="retweet"]',
    like: '[data-testid="like"]',
    unlike: '[data-testid="unlike"]',
    bookmark: '[data-testid="bookmark"]',

    // Verification
    verifiedBadge: '[data-testid="icon-verified"]',

    // Threading
    showMore: '[data-testid="tweet-text-show-more-link"]',
    sensitiveWarning: '[data-testid="tweet-text-sensitive-warning"]',
    cellInnerDiv: '[data-testid="cellInnerDiv"]',

    // Profile
    profileHeader: '[data-testid="UserProfileHeader_Items"]',
    profileBio: '[data-testid="UserDescription"]',
    profileName: '[data-testid="UserName"]',
    hoverCard: '[data-testid="HoverCard"]',
    profileFollowLinks: 'a[href$="/following"], a[href$="/followers"], a[href$="/verified_followers"]',

    // Navigation
    primaryColumn: '[data-testid="primaryColumn"]',
    analyticsLink: 'a[href*="/analytics"]',

    // Time
    timestamp: 'time',

    // Reply sort
    replySortTab: '[role="tab"][aria-selected="true"]',
  };

  // =========================================================================
  // DOM RESILIENCE & ADAPTATION SYSTEM
  // =========================================================================

  /**
   * SELECTOR_FALLBACKS — Multiple strategies per content type for resilience
   * Each fallback includes: selector, confidence score, extraction strategy
   */
  const SELECTOR_FALLBACKS = {
    // Tweet containers - most critical selectors
    tweet: [
      { selector: '[data-testid="tweet"]', confidence: 1.0, strategy: 'primary' },
      { selector: '[role="group"][aria-labelledby]', confidence: 0.9, strategy: 'role-based' },
      { selector: 'article[data-testid]', confidence: 0.8, strategy: 'semantic' },
      { selector: '[data-testid*="tweet"]', confidence: 0.7, strategy: 'wildcard' },
      { selector: 'article:has([role="link"])', confidence: 0.6, strategy: 'has-link' }
    ],

    tweetText: [
      { selector: '[data-testid="tweetText"]', confidence: 1.0, strategy: 'primary' },
      { selector: '[data-testid="Tweet-User-Text"]', confidence: 0.9, strategy: 'user-text' },
      { selector: '[role="group"] [lang]', confidence: 0.8, strategy: 'lang-attr' },
      { selector: 'article [lang]', confidence: 0.7, strategy: 'article-lang' },
      { selector: '[data-testid*="text"]', confidence: 0.6, strategy: 'wildcard-text' }
    ],

    userName: [
      { selector: '[data-testid="User-Name"]', confidence: 1.0, strategy: 'primary' },
      { selector: '[role="link"][aria-label*="View profile"]', confidence: 0.9, strategy: 'aria-profile' },
      { selector: 'article [role="link"]:first-child', confidence: 0.8, strategy: 'first-link' },
      { selector: '[data-testid*="user"]', confidence: 0.7, strategy: 'wildcard-user' },
      { selector: 'article a[href*="/"]', confidence: 0.6, strategy: 'href-profile' }
    ],

    // Media selectors with fallbacks
    tweetPhoto: [
      { selector: '[data-testid="tweetPhoto"]', confidence: 1.0, strategy: 'primary' },
      { selector: '[data-testid="Tweet-User-Photo"]', confidence: 0.9, strategy: 'user-photo' },
      { selector: 'article img[src*="pbs.twimg.com/media"]', confidence: 0.8, strategy: 'pbs-media' },
      { selector: '[role="group"] img', confidence: 0.7, strategy: 'group-images' },
      { selector: 'article img:not([src*="profile_images"])', confidence: 0.6, strategy: 'non-profile' }
    ],

    // Engagement selectors - critical for metrics
    reply: [
      { selector: '[data-testid="reply"]', confidence: 1.0, strategy: 'primary' },
      { selector: '[aria-label*="repl"]', confidence: 0.9, strategy: 'aria-reply' },
      { selector: 'article [role="group"] [role="button"]:first-child', confidence: 0.8, strategy: 'first-button' },
      { selector: '[data-testid*="reply"]', confidence: 0.7, strategy: 'wildcard-reply' },
      { selector: 'button[aria-label*="Reply"]', confidence: 0.6, strategy: 'button-reply' }
    ],

    like: [
      { selector: '[data-testid="like"]', confidence: 1.0, strategy: 'primary' },
      { selector: '[data-testid="unlike"]', confidence: 0.9, strategy: 'unlike-fallback' },
      { selector: '[aria-label*="Like"]', confidence: 0.8, strategy: 'aria-like' },
      { selector: 'article [role="group"] [role="button"]:nth-child(3)', confidence: 0.7, strategy: 'nth-button' },
      { selector: 'button[aria-label*="Like"]', confidence: 0.6, strategy: 'button-like' }
    ],

    retweet: [
      { selector: '[data-testid="retweet"], [data-testid="repost"]', confidence: 1.0, strategy: 'primary' },
      { selector: '[aria-label*="retweet" i]', confidence: 0.9, strategy: 'aria-retweet' },
      { selector: 'article [role="group"] [role="button"]:nth-child(2)', confidence: 0.8, strategy: 'nth-button' },
      { selector: '[data-testid*="retweet"]', confidence: 0.7, strategy: 'wildcard-retweet' },
      { selector: 'button[aria-label*="Repost"]', confidence: 0.6, strategy: 'button-repost' }
    ],

    // Verification badges
    verifiedBadge: [
      { selector: '[data-testid="icon-verified"]', confidence: 1.0, strategy: 'primary' },
      { selector: '[aria-label*="verified"]', confidence: 0.9, strategy: 'aria-verified' },
      { selector: 'svg[viewBox*="16"]:has(path[d*="M22.25"])', confidence: 0.8, strategy: 'svg-path' },
      { selector: '[role="link"] svg[aria-hidden="true"] + *', confidence: 0.7, strategy: 'sibling-svg' },
      { selector: '[data-testid*="verified"]', confidence: 0.6, strategy: 'wildcard-verified' }
    ],

    // Embedded content
    quoteTweet: [
      { selector: '[data-testid="quoteTweet"]', confidence: 1.0, strategy: 'primary' },
      { selector: '[role="link"][aria-label*="quote"]', confidence: 0.9, strategy: 'aria-quote' },
      { selector: 'article article', confidence: 0.8, strategy: 'nested-article' },
      { selector: '[data-testid*="quote"]', confidence: 0.7, strategy: 'wildcard-quote' },
      { selector: '[role="group"] [role="group"]', confidence: 0.6, strategy: 'nested-group' }
    ],

    cardWrapper: [
      { selector: '[data-testid="card.wrapper"]', confidence: 1.0, strategy: 'primary' },
      { selector: '[data-testid="cardContainer"]', confidence: 0.9, strategy: 'container' },
      { selector: '[role="link"][aria-label*="card"]', confidence: 0.8, strategy: 'aria-card' },
      { selector: 'article a[href*="://"]:not([href*="@"])', confidence: 0.7, strategy: 'external-link' },
      { selector: '[data-testid*="card"]', confidence: 0.6, strategy: 'wildcard-card' }
    ],

    // Profile selectors
    profileHeader: [
      { selector: '[data-testid="UserProfileHeader_Items"]', confidence: 1.0, strategy: 'primary' },
      { selector: '[data-testid="userActions"]', confidence: 0.9, strategy: 'user-actions' },
      { selector: '[role="banner"] [role="group"]', confidence: 0.8, strategy: 'banner-group' },
      { selector: '[data-testid*="profile"]', confidence: 0.7, strategy: 'wildcard-profile' },
      { selector: 'main header', confidence: 0.6, strategy: 'main-header' }
    ],

    profileBio: [
      { selector: '[data-testid="UserDescription"]', confidence: 1.0, strategy: 'primary' },
      { selector: '[data-testid="userBio"]', confidence: 0.9, strategy: 'user-bio' },
      { selector: '[role="banner"] p, [role="banner"] span:not([role])', confidence: 0.8, strategy: 'banner-text' },
      { selector: '[data-testid*="bio"]', confidence: 0.7, strategy: 'wildcard-bio' },
      { selector: 'main header p', confidence: 0.6, strategy: 'header-para' }
    ]
  };

  // =========================================================================
  // SELECTOR HEALTH MONITORING & TELEMETRY
  // =========================================================================

  /**
   * Tracks selector success/failure rates for resilience optimization
   */
  const SELECTOR_HEALTH = {
    // In-memory tracking (persisted via chrome.storage.local)
    stats: {},
    lastValidation: null,

    /**
     * Record selector usage and success/failure
     */
    recordUsage: function(selectorKey, selector, success, confidence = 1.0, context = {}) {
      if (!this.stats[selectorKey]) {
        this.stats[selectorKey] = {};
      }
      if (!this.stats[selectorKey][selector]) {
        this.stats[selectorKey][selector] = {
          attempts: 0,
          successes: 0,
          failures: 0,
          avgConfidence: 0,
          lastUsed: null,
          context: context
        };
      }

      const stat = this.stats[selectorKey][selector];
      stat.attempts++;
      stat.lastUsed = Date.now();

      if (success) {
        stat.successes++;
      } else {
        stat.failures++;
      }

      // Update rolling average confidence
      stat.avgConfidence = (stat.avgConfidence * (stat.attempts - 1) + confidence) / stat.attempts;

      this.persistStats();
    },

    /**
     * Get success rate for a selector
     */
    getSuccessRate: function(selectorKey, selector) {
      const stat = this.stats[selectorKey]?.[selector];
      if (!stat || stat.attempts === 0) return 0;
      return stat.successes / stat.attempts;
    },

    /**
     * Get health score (0-1) combining success rate and confidence
     */
    getHealthScore: function(selectorKey, selector) {
      const successRate = this.getSuccessRate(selectorKey, selector);
      const stat = this.stats[selectorKey]?.[selector];
      const confidence = stat?.avgConfidence || 0;
      return (successRate * 0.7) + (confidence * 0.3);
    },

    /**
     * Find best performing selector for a key
     */
    getBestSelector: function(selectorKey) {
      const selectors = this.stats[selectorKey];
      if (!selectors) return null;

      let bestSelector = null;
      let bestScore = -1;

      for (const [selector, stat] of Object.entries(selectors)) {
        const score = this.getHealthScore(selectorKey, selector);
        if (score > bestScore && stat.attempts > 2) { // Require minimum attempts
          bestScore = score;
          bestSelector = selector;
        }
      }

      return bestSelector;
    },

    /**
     * Persist stats to chrome storage
     */
    persistStats: function() {
      try {
        chrome.storage.local.set({
          'selectorHealth': this.stats,
          'lastHealthUpdate': Date.now()
        });
      } catch (e) {
        // Silent fail - telemetry is nice-to-have
      }
    },

    /**
     * Load stats from chrome storage
     */
    loadStats: function() {
      try {
        chrome.storage.local.get(['selectorHealth', 'lastHealthUpdate'], (result) => {
          if (result.selectorHealth) {
            this.stats = result.selectorHealth;
          }
          this.lastValidation = result.lastHealthUpdate;
        });
      } catch (e) {
        // Silent fail
      }
    },

    /**
     * Get overall system health score (0-1)
     */
    getSystemHealth: function() {
      const keys = Object.keys(this.stats);
      if (keys.length === 0) return 1.0; // Default to healthy

      let totalScore = 0;
      let count = 0;

      for (const key of keys) {
        const bestSelector = this.getBestSelector(key);
        if (bestSelector) {
          totalScore += this.getHealthScore(key, bestSelector);
          count++;
        }
      }

      return count > 0 ? totalScore / count : 1.0;
    }
  };

  // Load health stats on initialization
  SELECTOR_HEALTH.loadStats();

  // =========================================================================
  // SELF-HEALING SELECTOR DETECTION
  // =========================================================================

  /**
   * Automatically analyzes DOM when selectors fail and generates fallback strategies
   */
  const SELF_HEALING_DETECTOR = {
    /**
     * Analyze DOM structure around failed selector to find alternatives
     */
    analyzeDOMForAlternatives: function(selectorKey, contextElement, expectedContent = null) {
      const alternatives = [];

      try {
        // Strategy 1: Look for similar data-testid attributes
        const testIds = contextElement.querySelectorAll('[data-testid]');
        for (const el of testIds) {
          const testid = el.getAttribute('data-testid');
          if (testid && testid.toLowerCase().includes(selectorKey.toLowerCase().replace(/[^a-z]/g, ''))) {
            alternatives.push({
              selector: `[data-testid="${testid}"]`,
              confidence: 0.8,
              strategy: 'similar-testid',
              context: `Found similar testid: ${testid}`
            });
          }
        }

        // Strategy 2: Look for aria-label patterns
        const ariaElements = contextElement.querySelectorAll('[aria-label]');
        for (const el of ariaElements) {
          const label = el.getAttribute('aria-label').toLowerCase();
          if (label.includes(selectorKey.toLowerCase().replace(/[^a-z]/g, ''))) {
            alternatives.push({
              selector: `[aria-label*="${selectorKey.toLowerCase().replace(/[^a-z]/g, '')}"]`,
              confidence: 0.7,
              strategy: 'aria-pattern',
              context: `Found aria-label: ${label}`
            });
          }
        }

        // Strategy 3: Role-based alternatives
        const roleElements = contextElement.querySelectorAll('[role]');
        const relevantRoles = {
          tweet: ['group', 'article'],
          userName: ['link'],
          tweetText: ['group'],
          reply: ['button'],
          like: ['button'],
          retweet: ['button']
        };

        const expectedRoles = relevantRoles[selectorKey] || [];
        for (const el of roleElements) {
          const role = el.getAttribute('role');
          if (expectedRoles.includes(role)) {
            alternatives.push({
              selector: `[role="${role}"]`,
              confidence: 0.6,
              strategy: 'role-based',
              context: `Found role: ${role}`
            });
          }
        }

        // Strategy 4: Semantic HTML alternatives
        const semanticSelectors = {
          tweet: ['article', 'div[role="group"]'],
          userName: ['a[href*="/"]', 'span'],
          tweetText: ['[lang]', 'div', 'span'],
          reply: ['button', '[role="button"]'],
          like: ['button', '[role="button"]'],
          retweet: ['button', '[role="button"]']
        };

        const semanticAlts = semanticSelectors[selectorKey] || [];
        for (const selector of semanticAlts) {
          const elements = contextElement.querySelectorAll(selector);
          if (elements.length > 0) {
            alternatives.push({
              selector: selector,
              confidence: 0.5,
              strategy: 'semantic-html',
              context: `Found ${elements.length} semantic elements`
            });
          }
        }

        // Strategy 5: Content-based detection (if expected content provided)
        if (expectedContent && typeof expectedContent === 'string') {
          const textElements = contextElement.querySelectorAll('*');
          for (const el of textElements) {
            const text = el.textContent?.trim();
            if (text && text.includes(expectedContent.substring(0, 10))) {
              // Generate a unique selector for this element
              const uniqueSelector = this.generateUniqueSelector(el);
              if (uniqueSelector) {
                alternatives.push({
                  selector: uniqueSelector,
                  confidence: 0.9,
                  strategy: 'content-match',
                  context: `Found element containing: ${expectedContent.substring(0, 20)}...`
                });
              }
            }
          }
        }

        // Remove duplicates and sort by confidence
        const unique = alternatives.filter((alt, index, self) =>
          index === self.findIndex(a => a.selector === alt.selector)
        );

        return unique.sort((a, b) => b.confidence - a.confidence);

      } catch (e) {
        return [];
      }
    },

    /**
     * Generate a unique CSS selector for an element
     */
    generateUniqueSelector: function(element) {
      try {
        // Try data-testid first
        const testid = element.getAttribute('data-testid');
        if (testid) return `[data-testid="${testid}"]`;

        // Try aria-label
        const ariaLabel = element.getAttribute('aria-label');
        if (ariaLabel) return `[aria-label="${ariaLabel.replace(/"/g, '\\"')}"]`;

        // Try class-based selector
        const classes = Array.from(element.classList);
        if (classes.length > 0) {
          const classSelector = '.' + classes.join('.');
          // Verify uniqueness
          if (document.querySelectorAll(classSelector).length === 1) {
            return classSelector;
          }
        }

        // Generate path-based selector
        let path = [];
        let current = element;

        while (current && current !== document.body && path.length < 5) {
          let segment = current.tagName.toLowerCase();

          if (current.id) {
            segment += `#${current.id}`;
            path.unshift(segment);
            break; // ID should be unique enough
          }

          const classes = Array.from(current.classList).filter(c => !c.startsWith('r-')); // Skip random classes
          if (classes.length > 0) {
            segment += '.' + classes[0];
          }

          // Add nth-child if needed
          const siblings = Array.from(current.parentElement?.children || []);
          const index = siblings.indexOf(current);
          if (siblings.length > 1 && index >= 0) {
            segment += `:nth-child(${index + 1})`;
          }

          path.unshift(segment);
          current = current.parentElement;
        }

        const selector = path.join(' > ');
        // Verify uniqueness
        if (document.querySelectorAll(selector).length === 1) {
          return selector;
        }

        return null;
      } catch (e) {
        return null;
      }
    },

    /**
     * Test a generated selector and return confidence score
     */
    testSelector: function(selector, contextElement = document) {
      try {
        const elements = contextElement.querySelectorAll(selector);
        if (elements.length === 0) return 0; // No matches
        if (elements.length === 1) return 1.0; // Perfect match
        if (elements.length <= 3) return 0.8; // Few matches, still useful
        if (elements.length <= 10) return 0.6; // Multiple matches, less confident
        return 0.3; // Too many matches, low confidence
      } catch (e) {
        return 0; // Invalid selector
      }
    }
  };

  // =========================================================================
  // RESILIENT EXTRACTION ENGINE
  // =========================================================================

  // Cache winning selectors per extraction run to avoid repeating fallback chains.
  const selectorResolutionCache = new Map();

  function selectorCacheKey(selectorKey, requireUnique) {
    return `${selectorKey}|${requireUnique ? 'single' : 'all'}`;
  }

  function clearSelectorCache() {
    selectorResolutionCache.clear();
  }

  /**
   * Enhanced querySelector that tries multiple strategies and fallbacks
   */
  function resilientQuerySelector(context, selectorKey, options = {}) {
    const {
      expectedContent = null,
      maxAttempts = 5,
      requireUnique = false,
      healthTracking = true
    } = options;

    const cacheKey = selectorCacheKey(selectorKey, requireUnique);
    const cachedSelector = selectorResolutionCache.get(cacheKey);
    if (cachedSelector) {
      try {
        const elements = context.querySelectorAll(cachedSelector);
        const success = elements.length > 0 && (!requireUnique || elements.length === 1);

        if (healthTracking) {
          SELECTOR_HEALTH.recordUsage(selectorKey, cachedSelector, success, 1.0, { strategy: 'cache' });
        }

        if (success) {
          return requireUnique ? elements[0] : Array.from(elements);
        }

        // Drop stale selector and continue with full resolution.
        selectorResolutionCache.delete(cacheKey);
      } catch (e) {
        selectorResolutionCache.delete(cacheKey);
      }
    }

    const primarySelector = SELECTORS[selectorKey];
    if (primarySelector) {
      try {
        const elements = context.querySelectorAll(primarySelector);
        const success = elements.length > 0 && (!requireUnique || elements.length === 1);

        if (healthTracking) {
          SELECTOR_HEALTH.recordUsage(selectorKey, primarySelector, success, 1.0);
        }

        if (success) {
          selectorResolutionCache.set(cacheKey, primarySelector);
          return requireUnique ? elements[0] : Array.from(elements);
        }
      } catch (e) {
        if (healthTracking) {
          SELECTOR_HEALTH.recordUsage(selectorKey, primarySelector, false, 1.0);
        }
      }
    }

    const fallbacks = SELECTOR_FALLBACKS[selectorKey] || [];
    for (const fallback of fallbacks.slice(0, maxAttempts)) {
      try {
        const elements = context.querySelectorAll(fallback.selector);
        const success = elements.length > 0 && (!requireUnique || elements.length === 1);

        if (healthTracking) {
          SELECTOR_HEALTH.recordUsage(selectorKey, fallback.selector, success, fallback.confidence);
        }

        if (success) {
          selectorResolutionCache.set(cacheKey, fallback.selector);
          return requireUnique ? elements[0] : Array.from(elements);
        }
      } catch (e) {
        if (healthTracking) {
          SELECTOR_HEALTH.recordUsage(selectorKey, fallback.selector, false, fallback.confidence);
        }
      }
    }

    if (expectedContent || !requireUnique) {
      const alternatives = SELF_HEALING_DETECTOR.analyzeDOMForAlternatives(
        selectorKey,
        context,
        expectedContent
      );

      for (const alt of alternatives.slice(0, 3)) {
        try {
          const confidence = SELF_HEALING_DETECTOR.testSelector(alt.selector, context);
          if (confidence >= 0.5) {
            const elements = context.querySelectorAll(alt.selector);
            const success = elements.length > 0 && (!requireUnique || elements.length === 1);

            if (healthTracking) {
              SELECTOR_HEALTH.recordUsage(selectorKey, alt.selector, success, confidence, alt);
            }

            if (success) {
              selectorResolutionCache.set(cacheKey, alt.selector);
              return requireUnique ? elements[0] : Array.from(elements);
            }
          }
        } catch (e) {
          // Continue to next alternative
        }
      }
    }

    return requireUnique ? null : [];
  }

  function resilientQuerySelectorAll(context, selectorKey, options = {}) {
    const result = resilientQuerySelector(context, selectorKey, { ...options, requireUnique: false });
    return Array.isArray(result) ? result : [];
  }

  function resilientQuerySelectorSingle(context, selectorKey, options = {}) {
    return resilientQuerySelector(context, selectorKey, { ...options, requireUnique: true });
  }

  // =========================================================================
  // UTILITIES
  // =========================================================================

  /**
   * Safe querySelector that never throws
   */
  function qs(el, selector) {
    try { return el.querySelector(selector); } catch { return null; }
  }

  /**
   * Safe querySelectorAll that never throws
   */
  function qsa(el, selector) {
    try { return Array.from(el.querySelectorAll(selector)); } catch { return []; }
  }

  /**
   * Extract text content safely
   */
  function textOf(el) {
    return el ? el.innerText?.trim() || el.textContent?.trim() || '' : '';
  }

  /**
   * Parse engagement number from aria-label (e.g., "712 replies" → 712, "2.5K likes" → "2.5K")
   */
  function parseEngagement(el) {
    if (!el) return null;
    const label = el.getAttribute('aria-label') || '';
    const match = label.match(/^([\d,.]+[KMB]?)\s/i);
    if (match) return match[1];
    // Try getting the text content of the span inside
    const span = el.querySelector('span span');
    if (span) {
      const text = span.textContent?.trim();
      if (text && text !== '') return text;
    }
    return null;
  }

  /**
   * Parse compact metric text into numeric value for comparisons/sorting.
   * Examples: "2.5K" => 2500, "1,234" => 1234, "4.3B" => 4300000000
   */
  function parseMetricValue(raw) {
    if (raw === null || raw === undefined) return -1;
    const text = String(raw).trim().toUpperCase().replace(/,/g, '');
    if (!text) return -1;
    const match = text.match(/^(\d+(?:\.\d+)?)([KMB])?$/);
    if (!match) {
      const numeric = Number.parseFloat(text);
      return Number.isFinite(numeric) ? numeric : -1;
    }
    const value = Number.parseFloat(match[1]);
    const suffix = match[2];
    if (suffix === 'K') return value * 1000;
    if (suffix === 'M') return value * 1000000;
    if (suffix === 'B') return value * 1000000000;
    return value;
  }

  /**
   * Estimate tokens from text (~4 chars per token)
   */
  function estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }

  /**
   * Classify token size for indicator
   */
  function classifyTokenSize(tokens) {
    if (tokens < 2000) return { level: 'green', label: 'Fits any LLM context' };
    if (tokens < 8000) return { level: 'yellow', label: 'Medium context' };
    if (tokens < 32000) return { level: 'orange', label: 'Large context — use 100K+ models' };
    return { level: 'red', label: 'Very large — consider truncating' };
  }

  /**
   * Extract domain from URL
   */
  function extractDomain(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return null;
    }
  }

  // =========================================================================
  // PAGE TYPE DETECTION
  // =========================================================================

  function detectPageType(url) {
    try {
      const u = new URL(url);
      const host = u.hostname;
      if (host !== 'x.com' && host !== 'twitter.com' && host !== 'www.x.com' && host !== 'www.twitter.com') {
        return 'unsupported';
      }
      const path = u.pathname;
      // Exclude non-content paths
      const nonContent = ['/settings', '/messages', '/i/', '/notifications', '/explore', '/search', '/home', '/compose', '/login', '/signup'];
      if (nonContent.some(p => path.startsWith(p))) return 'unsupported';
      // Post page: /user/status/id
      if (/^\/[^/]+\/status\/\d+/.test(path)) return 'post';
      // Profile page: /user (but not /user/status, /user/followers, etc.)
      if (/^\/[^/]+\/?$/.test(path)) return 'profile';
      return 'unsupported';
    } catch {
      return 'unsupported';
    }
  }

  // =========================================================================
  // TWEET EXTRACTION
  // =========================================================================

  /**
   * Extract all metadata from a single tweet DOM element
   */
  function extractTweet(tweetEl, context = {}) {
    const tweet = {
      author: { name: null, handle: null, verified: 'none', followers: null, following: null },
      timestamp: { iso: null, display: null },
      text: null,
      hashtags: [],
      mentions: [],
      links: [],
      images: [],
      video: false,
      gif: false,
      quotedTweet: null,
      linkCard: null,
      communityNote: null,
      poll: null,
      engagement: { replies: null, retweets: null, quotes: null, likes: null, bookmarks: null, views: null },
      replyRestriction: null,
      flags: { sensitive: false, translated: false, truncated: false, repost: false, hasCommunityNote: false },
      threading: { replyTo: null, depth: context.depth || 0, isOp: context.isOp || false, position: context.position || 0 },
    };

    try {
      // --- AUTHOR ---
      const userNameEl = resilientQuerySelectorSingle(tweetEl, 'userName');
      if (userNameEl) {
        // Display name is usually the first text span
        const nameSpans = qsa(userNameEl, 'span');
        if (nameSpans.length > 0) {
          // Find the display name (first non-@ text)
          for (const span of nameSpans) {
            const t = span.textContent?.trim();
            if (t && !t.startsWith('@') && !t.startsWith('·') && t !== '·') {
              tweet.author.name = t;
              break;
            }
          }
          // Find the handle (@...)
          for (const span of nameSpans) {
            const t = span.textContent?.trim();
            if (t && t.startsWith('@')) {
              tweet.author.handle = t;
              break;
            }
          }
        }
        // If handle not found in spans, try links
        if (!tweet.author.handle) {
          const links = qsa(userNameEl, 'a[href]');
          for (const link of links) {
            const href = link.getAttribute('href') || '';
            const match = href.match(/^\/([^/]+)\/?$/);
            if (match) {
              tweet.author.handle = '@' + match[1];
              break;
            }
          }
        }

        // Verified badge
        const badge = resilientQuerySelectorSingle(tweetEl, 'verifiedBadge');
        if (badge) {
          // Try to detect badge type from SVG fill
          const svg = qs(badge, 'svg');
          if (svg) {
            const fill = svg.getAttribute('fill') || '';
            const path = qs(svg, 'path');
            void (path);

            if (fill.includes('D18800') || fill.includes('E8A100') || fill.includes('gold')) {
              tweet.author.verified = 'gold';
            } else if (fill.includes('829AAB') || fill.includes('grey') || fill.includes('gray')) {
              tweet.author.verified = 'grey';
            } else {
              tweet.author.verified = 'blue';
            }
          } else {
            tweet.author.verified = 'blue';
          }
        }
      }

      // --- TIMESTAMP ---
      const timeEl = resilientQuerySelectorSingle(tweetEl, 'timestamp');
      if (timeEl) {
        tweet.timestamp.iso = timeEl.getAttribute('datetime') || null;
        tweet.timestamp.display = timeEl.textContent?.trim() || null;
      }

      // --- TEXT ---
      const textEl = resilientQuerySelectorSingle(tweetEl, 'tweetText');
      if (textEl) {
        tweet.text = textEl.innerText?.trim() || null;

        // Extract hashtags
        const hashtagMatches = (tweet.text || '').match(/#\w+/g);
        if (hashtagMatches) {
          tweet.hashtags = [...new Set(hashtagMatches.map(h => h.toLowerCase()))];
        }

        // Extract mentions
        const mentionMatches = (tweet.text || '').match(/@\w+/g);
        if (mentionMatches) {
          tweet.mentions = [...new Set(mentionMatches.map(m => m.toLowerCase()))];
        }

        // Extract links from tweetText
        const linkEls = qsa(textEl, 'a[href]');
        for (const a of linkEls) {
          const href = a.getAttribute('href') || '';
          const display = a.textContent?.trim() || '';
          // Filter out hashtag links and profile links
          if (href.includes('/search?q=%23') || href.includes('/hashtag/')) continue;
          if (/^\/[^/]+\/?$/.test(href) && display.startsWith('@')) continue;
          // Keep external links and t.co
          if (href.includes('://')) {
            tweet.links.push({ url: href, display: display });
          }
        }
      }

      // --- TRUNCATED ---
      if (resilientQuerySelectorSingle(tweetEl, 'showMore')) {
        tweet.flags.truncated = true;
      }

      // --- REPLY-TO ---
      const replyingToResult = resilientQuerySelectorAll(tweetEl, 'replyingTo');
      const replyingTo = replyingToResult.length > 0 ? replyingToResult : qsa(tweetEl, 'a[href]');
      for (const a of replyingTo) {
        const parent = a.parentElement;
        if (parent && /replying to/i.test(parent.textContent || '')) {
          const href = a.getAttribute('href') || '';
          const match = href.match(/^\/([^/]+)\/?$/);
          if (match) {
            tweet.threading.replyTo = '@' + match[1];
            break;
          }
        }
      }

      // --- REPOST DETECTION ---
      // Check for retweet indicator above the tweet
      const parentCells = tweetEl.parentElement;
      if (parentCells) {
        const prevSibling = parentCells.previousElementSibling;
        if (prevSibling && /reposted|retweeted/i.test(prevSibling.textContent || '')) {
          tweet.flags.repost = true;
        }
      }

      // --- IMAGES ---
      let photoEls = resilientQuerySelectorAll(tweetEl, 'tweetPhoto');
      if (photoEls.length === 0) {
        photoEls = qsa(tweetEl, 'img[src*="pbs.twimg.com/media"]');
      } else {
        photoEls = qsa(tweetEl, SELECTORS.tweetPhoto + ' img');
      }
      for (const img of photoEls) {
        const src = img.getAttribute('src') || '';
        const alt = img.getAttribute('alt') || '';
        // Filter out profile pics and emoji
        if (src.includes('profile_images') || src.includes('emoji')) continue;
        if (src.includes('pbs.twimg.com/media') || src.includes('pbs.twimg.com/card_img')) {
          // Try to get full size
          const fullSrc = src.replace(/&name=\w+/, '&name=large').replace(/\?name=\w+/, '?name=large');
          tweet.images.push({ url: fullSrc, alt: alt || null });
        }
      }

      // --- VIDEO ---
      if (resilientQuerySelectorSingle(tweetEl, 'videoPlayer')) {
        tweet.video = true;
      }

      // --- GIF ---
      if (resilientQuerySelectorSingle(tweetEl, 'gifIndicator')) {
        tweet.gif = true;
      }

      // --- QUOTED TWEET ---
      const quoteEl = resilientQuerySelectorSingle(tweetEl, 'quoteTweet');
      if (quoteEl) {
        tweet.quotedTweet = extractQuotedTweet(quoteEl);
      }

      // --- LINK CARD ---
      const cardEl = resilientQuerySelectorSingle(tweetEl, 'cardWrapper');
      if (cardEl && !quoteEl) { // Don't extract card if it's a quoted tweet
        tweet.linkCard = extractLinkCard(cardEl);
      }

      // --- COMMUNITY NOTE ---
      const noteEl = resilientQuerySelectorSingle(tweetEl, 'communityNote');
      if (noteEl) {
        tweet.communityNote = textOf(noteEl);
        tweet.flags.hasCommunityNote = true;
      }

      // --- POLL ---
      const pollEl = resilientQuerySelectorSingle(tweetEl, 'poll');
      if (pollEl) {
        tweet.poll = extractPoll(pollEl);
      }

      // --- ENGAGEMENT ---
      // Try aria-label approach on engagement buttons
      const replyBtn = resilientQuerySelectorSingle(tweetEl, 'reply');
      const retweetBtn = resilientQuerySelectorSingle(tweetEl, 'retweet');
      const likeBtn = resilientQuerySelectorSingle(tweetEl, 'like') || resilientQuerySelectorSingle(tweetEl, 'unlike');
      const bookmarkBtn = resilientQuerySelectorSingle(tweetEl, 'bookmark');

      tweet.engagement.replies = parseEngagement(replyBtn);
      tweet.engagement.retweets = parseEngagement(retweetBtn);
      tweet.engagement.likes = parseEngagement(likeBtn);
      tweet.engagement.bookmarks = parseEngagement(bookmarkBtn);

      // Views - look for view count container (usually on main post)
      const viewEls = qsa(tweetEl, SELECTORS.analyticsLink);
      if (viewEls.length > 0) {
        const viewText = viewEls[0].textContent?.trim();
        if (viewText) {
          const viewMatch = viewText.match(/([\d,.]+[KMB]?)/i);
          if (viewMatch) tweet.engagement.views = viewMatch[1];
        }
      }

      // --- SENSITIVE ---
      if (resilientQuerySelectorSingle(tweetEl, 'sensitiveWarning')) {
        tweet.flags.sensitive = true;
      }

    } catch (e) {
      // Never crash on extraction errors — return partial data
      tweet._error = e.message;
    }

    return tweet;
  }

  /**
   * Extract quoted tweet content
   */
  function extractQuotedTweet(quoteEl) {
    try {
      const qt = { author: { name: null, handle: null, verified: 'none' }, text: null, links: [], images: [] };

      // Author from quoted tweet
      const nameEl = qs(quoteEl, 'span');
      if (nameEl) {
        const spans = qsa(quoteEl, 'span');
        for (const span of spans) {
          const t = span.textContent?.trim();
          if (t && t.startsWith('@')) {
            qt.author.handle = t;
          } else if (t && !qt.author.name && t.length > 1 && !t.startsWith('·')) {
            qt.author.name = t;
          }
        }
      }

      // Text
      const textEl = resilientQuerySelectorSingle(quoteEl, 'tweetText');
      if (textEl) {
        qt.text = textEl.innerText?.trim() || null;
        // Links
        const linkEls = qsa(textEl, 'a[href]');
        for (const a of linkEls) {
          const href = a.getAttribute('href') || '';
          if (href.includes('://')) {
            qt.links.push({ url: href, display: a.textContent?.trim() || '' });
          }
        }
      }

      // Images
      const imgs = qsa(quoteEl, 'img[src*="pbs.twimg.com/media"]');
      for (const img of imgs) {
        qt.images.push({ url: img.getAttribute('src') || '', alt: img.getAttribute('alt') || null });
      }

      // Verified
      if (resilientQuerySelectorSingle(quoteEl, 'verifiedBadge')) {
        qt.author.verified = 'blue';
      }

      return qt;
    } catch {
      return null;
    }
  }

  /**
   * Extract link card content
   */
  function extractLinkCard(cardEl) {
    try {
      const card = { title: null, description: null, domain: null, url: null };

      // Try to get the link
      const link = qs(cardEl, 'a[href]');
      if (link) {
        card.url = link.getAttribute('href') || null;
        card.domain = card.url ? extractDomain(card.url) : null;
      }

      // Title and description from spans
      const spans = qsa(cardEl, 'span');
      for (const span of spans) {
        const text = span.textContent?.trim();
        if (!text) continue;
        if (!card.domain && text.includes('.') && text.length < 50) {
          card.domain = text;
        } else if (!card.title && text.length > 5) {
          card.title = text;
        } else if (!card.description && text.length > card.title?.length) {
          card.description = text;
        }
      }

      return (card.title || card.url) ? card : null;
    } catch {
      return null;
    }
  }

  /**
   * Extract poll data
   */
  function extractPoll(pollEl) {
    try {
      const poll = { question: null, options: [], totalVotes: null };

      // Options are usually in list items or divs with percentage
      const optionEls = qsa(pollEl, '[role="listitem"], [data-testid]');
      for (const opt of optionEls) {
        const text = textOf(opt);
        if (text) {
          const percentMatch = text.match(/([\d.]+%)/);
          const label = text.replace(/([\d.]+%)/, '').trim();
          if (label) {
            poll.options.push({ label, votes: percentMatch ? percentMatch[1] : null });
          }
        }
      }

      // Total votes
      const allText = textOf(pollEl);
      const totalMatch = allText.match(/([\d,]+)\s*votes?/i);
      if (totalMatch) poll.totalVotes = totalMatch[1];

      return poll.options.length > 0 ? poll : null;
    } catch {
      return null;
    }
  }

  // =========================================================================
  // PAGE EXTRACTORS
  // =========================================================================

  /**
   * Extract post page: main tweet + all visible replies
   */
  function extractPostPage() {
    try {
      const tweetEls = resilientQuerySelectorAll(document, 'tweet');
      if (tweetEls.length === 0) {
        return { error: 'No tweets found on this page' };
      }

      // Find the focal tweet — the one matching the URL's status ID.
      // On X.com post pages, tweets above the focal tweet are parent
      // context (the thread the post is replying to). The focal tweet
      // is identified by a <time> element whose parent <a> links to
      // the current status URL, or by having the analytics/views link.
      const statusMatch = window.location.pathname.match(/\/status\/(\d+)/);
      const statusId = statusMatch ? statusMatch[1] : null;
      let focalIndex = 0;
      let focalFound = false;

      if (statusId) {
        const statusPathPattern = new RegExp(`/status/${statusId}(?:[/?#]|$)`);
        for (let i = 0; i < tweetEls.length; i++) {
          const el = tweetEls[i];

          // Check for a <time> element inside a link to this status ID
          const timeLinks = qsa(el, 'a[href*="/status/"] time');
          for (const tl of timeLinks) {
            const timeLink = tl.parentElement;
            // Exclude nested quote-tweet links to avoid false focal matches.
            if (!timeLink || timeLink.closest(SELECTORS.quoteTweet)) continue;
            const href = timeLink.getAttribute('href') || '';
            if (statusPathPattern.test(href)) {
              focalIndex = i;
              focalFound = true;
              break;
            }
          }
          if (focalFound) break;

          // Fallback: check for analytics link (only focal tweet has views)
          const analyticsLink = qs(el, SELECTORS.analyticsLink);
          if (analyticsLink) {
            const href = analyticsLink.getAttribute('href') || '';
            if (statusPathPattern.test(href)) {
              focalIndex = i;
              focalFound = true;
              break;
            }
          }
        }
      }

      const mainPost = extractTweet(tweetEls[focalIndex], { depth: 0, position: 0, isOp: false });
      const opHandle = mainPost.author.handle;

      // Tweets before the focal tweet are parent context (thread ancestors)
      const parentContext = [];
      for (let i = 0; i < focalIndex; i++) {
        parentContext.push(extractTweet(tweetEls[i], { depth: 0, position: i, isOp: false }));
      }

      // Tweets after the focal tweet are replies
      const replies = [];
      for (let i = focalIndex + 1; i < tweetEls.length; i++) {
        const el = tweetEls[i];

        let depth = 1;
        const parentArticle = el.closest('article');
        if (parentArticle) {
          let parent = el.parentElement;
          let nestLevel = 0;
          while (parent && parent !== document.body) {
            if (parent.matches?.(SELECTORS.cellInnerDiv)) nestLevel++;
            parent = parent.parentElement;
          }
          if (nestLevel > 3) depth = 2;
          if (nestLevel > 5) depth = 3;
        }

        const reply = extractTweet(el, {
          depth: depth,
          position: i - focalIndex,
          isOp: opHandle && qs(el, SELECTORS.userName)?.textContent?.includes(opHandle?.replace('@', ''))
        });

        if (opHandle && reply.author.handle) {
          reply.threading.isOp = reply.author.handle.toLowerCase() === opHandle.toLowerCase();
        }

        replies.push(reply);
      }

      // Detect reply sort mode
      let replySortMode = 'relevance';
      const activeTab = resilientQuerySelectorSingle(document, 'replySortTab');
      if (activeTab) {
        const tabText = (activeTab.textContent || '').toLowerCase();
        if (tabText.includes('recent') || tabText.includes('latest')) {
          replySortMode = 'recency';
        }
      }

      return { mainPost, replies, replySortMode, parentContext };
    } catch {
      return { error: 'Failed to extract post context from the current page' };
    }
  }

  /**
   * Extract profile page: profile header + visible timeline posts
   */
  function extractProfilePage() {
    try {
      const profile = {
        name: null,
        handle: null,
        bio: null,
        location: null,
        website: null,
        joined: null,
        following: null,
        followers: null,
      };

      // Profile name
      const nameEl = resilientQuerySelectorSingle(document, 'profileName');
      if (nameEl) {
        const spans = qsa(nameEl, 'span');
        for (const span of spans) {
          const t = span.textContent?.trim();
          if (t && t.startsWith('@')) {
            profile.handle = t;
          } else if (t && !profile.name && t.length > 0) {
            profile.name = t;
          }
        }
      }

      // Bio
      const bioEl = resilientQuerySelectorSingle(document, 'profileBio');
      if (bioEl) {
        profile.bio = textOf(bioEl) || null;
      }

      // Header items (location, website, joined date)
      const headerEl = resilientQuerySelectorSingle(document, 'profileHeader');
      if (headerEl) {
        const items = qsa(headerEl, 'span');
        for (const item of items) {
          const text = item.textContent?.trim() || '';
          if (text.startsWith('Joined')) {
            profile.joined = text;
          } else if (text.includes('.') && text.length < 40 && !text.includes('Joined')) {
            profile.website = text;
          } else if (text.length > 0 && text.length < 50 && !text.includes('Joined') && !text.includes('Born')) {
            if (!profile.location) profile.location = text;
          }
        }
      }

      // Follower/following counts
      const followLinks = resilientQuerySelectorAll(document, 'profileFollowLinks');
      for (const link of followLinks) {
        const href = link.getAttribute('href') || '';
        const countSpan = qs(link, 'span span');
        const count = countSpan ? countSpan.textContent?.trim() : null;
        if (href.includes('/following') && !href.includes('/followers')) {
          profile.following = count;
        } else if (href.includes('/followers') || href.includes('/verified_followers')) {
          profile.followers = count;
        }
      }

      // Timeline posts
      const tweetEls = resilientQuerySelectorAll(document, 'tweet');
      const posts = [];
      for (let i = 0; i < tweetEls.length; i++) {
        posts.push(extractTweet(tweetEls[i], { depth: 0, position: i + 1, isOp: false }));
      }

      return { profile, posts };
    } catch {
      return { error: 'Failed to extract profile context from the current page' };
    }
  }

  // =========================================================================
  // NORMALIZATION — Build indexes and payload
  // =========================================================================

  function buildPayload(pageType, url, extractedData, options = {}) {
    const payload = {
      meta: {
        url: url,
        extractedAt: new Date().toISOString(),
        pageType: pageType,
        totalTweets: 0,
        totalLinks: 0,
        totalImages: 0,
        estimatedTokens: 0,
        tokenSize: null,
        page: options.page || 1,
        tool: 'X Context Packager v1.0.0 by AdLab',
      },
      mainPost: null,
      parentContext: [],
      replies: [],
      profile: null,
      posts: [],
      allLinks: [],
      allImages: [],
      hashtagIndex: [],
      mentionIndex: [],
      domainIndex: [],
      conversationSummary: null,
    };

    // Collect all tweets for index building
    let allTweets = [];

    if (pageType === 'post') {
      payload.mainPost = extractedData.mainPost;
      payload.parentContext = extractedData.parentContext || [];
      payload.replies = extractedData.replies || [];
      allTweets = [...payload.parentContext, extractedData.mainPost, ...payload.replies];
      payload.meta.totalTweets = allTweets.length;

      // Apply max replies cap
      if (options.maxReplies && options.maxReplies !== 'all') {
        const cap = parseInt(options.maxReplies, 10);
        if (!isNaN(cap) && payload.replies.length > cap) {
          payload.replies = payload.replies.slice(0, cap);
          allTweets = [...payload.parentContext, extractedData.mainPost, ...payload.replies];
        }
      }
      payload.meta.totalTweets = allTweets.length;

      // Conversation summary
      const uniqueAuthors = new Set();
      let maxDepth = 0;
      let opReplyCount = 0;
      let mostLikedReply = null;
      let mostLikedValue = -1;

      for (let i = 0; i < payload.replies.length; i++) {
        const r = payload.replies[i];
        if (r.author.handle) uniqueAuthors.add(r.author.handle.toLowerCase());
        if (r.threading.depth > maxDepth) maxDepth = r.threading.depth;
        if (r.threading.isOp) opReplyCount++;
        const likeCount = parseMetricValue(r.engagement.likes);
        if (likeCount > mostLikedValue) {
          mostLikedValue = likeCount;
          mostLikedReply = r.engagement.likes ? { index: i + 1, likes: r.engagement.likes } : null;
        }
      }

      payload.conversationSummary = {
        replySortMode: extractedData.replySortMode || 'relevance',
        opReplyCount: opReplyCount,
        uniqueAuthors: uniqueAuthors.size,
        deepestThreadDepth: maxDepth,
        mostLikedReply: mostLikedReply,
      };

    } else if (pageType === 'profile') {
      payload.profile = extractedData.profile;
      payload.posts = extractedData.posts || [];
      allTweets = payload.posts;
      payload.meta.totalTweets = allTweets.length;
    }

    // Build aggregated indexes
    const hashtagMap = {};
    const mentionMap = {};
    const domainMap = {};
    let linkIndex = 0;
    let imageIndex = 0;

    for (let i = 0; i < allTweets.length; i++) {
      const t = allTweets[i];
      if (!t) continue;
      let tweetLabel;
      if (pageType === 'post') {
        const parentCount = payload.parentContext.length;
        if (i < parentCount) {
          tweetLabel = `parent context ${i + 1}`;
        } else if (i === parentCount) {
          tweetLabel = 'main post';
        } else {
          tweetLabel = `reply ${i - parentCount}`;
        }
      } else {
        tweetLabel = `post ${i + 1}`;
      }

      // Links
      for (const link of (t.links || [])) {
        linkIndex++;
        payload.allLinks.push({ index: linkIndex, url: link.url, display: link.display, context: tweetLabel });
        const domain = extractDomain(link.url);
        if (domain) {
          if (!domainMap[domain]) domainMap[domain] = { count: 0, tweets: [] };
          domainMap[domain].count++;
          domainMap[domain].tweets.push(i + 1);
        }
      }

      // Images
      for (const img of (t.images || [])) {
        imageIndex++;
        payload.allImages.push({ index: imageIndex, url: img.url, alt: img.alt, context: tweetLabel });
      }

      // Hashtags
      for (const tag of (t.hashtags || [])) {
        if (!hashtagMap[tag]) hashtagMap[tag] = { count: 0, tweets: [] };
        hashtagMap[tag].count++;
        hashtagMap[tag].tweets.push(i + 1);
      }

      // Mentions
      for (const mention of (t.mentions || [])) {
        if (!mentionMap[mention]) mentionMap[mention] = { count: 0, tweets: [] };
        mentionMap[mention].count++;
        mentionMap[mention].tweets.push(i + 1);
      }

      // Quoted tweet links
      if (t.quotedTweet) {
        for (const link of (t.quotedTweet.links || [])) {
          linkIndex++;
          payload.allLinks.push({ index: linkIndex, url: link.url, display: link.display, context: tweetLabel + ' (quoted)' });
        }
      }

      // Link card
      if (t.linkCard && t.linkCard.url) {
        linkIndex++;
        payload.allLinks.push({ index: linkIndex, url: t.linkCard.url, display: t.linkCard.title || '', context: tweetLabel + ' (card)' });
        const domain = extractDomain(t.linkCard.url);
        if (domain) {
          if (!domainMap[domain]) domainMap[domain] = { count: 0, tweets: [] };
          domainMap[domain].count++;
          if (!domainMap[domain].tweets.includes(i + 1)) domainMap[domain].tweets.push(i + 1);
        }
      }
    }

    // Convert maps to sorted arrays
    payload.hashtagIndex = Object.entries(hashtagMap)
      .map(([tag, data]) => ({ tag, count: data.count, tweets: data.tweets }))
      .sort((a, b) => b.count - a.count);

    payload.mentionIndex = Object.entries(mentionMap)
      .map(([handle, data]) => ({ handle, count: data.count, tweets: data.tweets }))
      .sort((a, b) => b.count - a.count);

    payload.domainIndex = Object.entries(domainMap)
      .map(([domain, data]) => ({ domain, count: data.count, tweets: data.tweets }))
      .sort((a, b) => b.count - a.count);

    payload.meta.totalLinks = payload.allLinks.length;
    payload.meta.totalImages = payload.allImages.length;

    return payload;
  }

  // =========================================================================
  // FORMATTERS
  // =========================================================================

  /**
   * Escape XML special characters
   */
  function escXml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function xmlAttr(name, value) {
    if (value === null || value === undefined || value === '') return '';
    return ` ${name}="${escXml(value)}"`;
  }

  /**
   * Format a single tweet for structured XML output
   */
  function formatTweetStructured(tweet, tag, attrs = '', options = {}) {
    const lines = [];
    const indent = tag === 'main_post' ? '  ' : '    ';

    lines.push(`<${tag}${attrs}>`);

    // Author
    const a = tweet.author;
    const authorAttrs = `${xmlAttr('name', a.name)}${xmlAttr('handle', a.handle)}${xmlAttr('verified', a.verified || 'none')}${xmlAttr('followers', a.followers)}${xmlAttr('following', a.following)}`;
    lines.push(`${indent}<author${authorAttrs}/>`);

    // Timestamp
    if (options.includeTimestamps !== false && (tweet.timestamp.iso || tweet.timestamp.display)) {
      lines.push(`${indent}<timestamp${xmlAttr('iso', tweet.timestamp.iso)}${xmlAttr('display', tweet.timestamp.display)}/>`);
    }

    // Text
    if (tweet.text) {
      lines.push(`${indent}<text>`);
      lines.push(`${indent}${escXml(tweet.text)}`);
      lines.push(`${indent}</text>`);
    }

    // Hashtags
    if (tweet.hashtags.length > 0) {
      lines.push(`${indent}<hashtags>${escXml(tweet.hashtags.join(' '))}</hashtags>`);
    }

    // Links
    if (tweet.links.length > 0) {
      lines.push(`${indent}<links>`);
      for (const l of tweet.links) {
        lines.push(`${indent}  <link${xmlAttr('url', l.url)}${xmlAttr('display', l.display)}/>`);
      }
      lines.push(`${indent}</links>`);
    }

    // Images
    if (options.includeImages !== false && tweet.images.length > 0) {
      lines.push(`${indent}<images>`);
      for (const img of tweet.images) {
        lines.push(`${indent}  <image${xmlAttr('url', img.url)}${xmlAttr('alt', img.alt)}/>`);
      }
      lines.push(`${indent}</images>`);
    }

    // Video/GIF
    if (tweet.video) lines.push(`${indent}<video present="true"/>`);
    if (tweet.gif) lines.push(`${indent}<gif present="true"/>`);

    // Poll
    if (tweet.poll) {
      lines.push(`${indent}<poll>`);
      for (const opt of tweet.poll.options) {
        lines.push(`${indent}  <option${xmlAttr('votes', opt.votes)}>${escXml(opt.label)}</option>`);
      }
      if (tweet.poll.totalVotes) lines.push(`${indent}  <total_votes>${escXml(tweet.poll.totalVotes)}</total_votes>`);
      lines.push(`${indent}</poll>`);
    }

    // Quoted tweet
    if (tweet.quotedTweet) {
      const qt = tweet.quotedTweet;
      lines.push(`${indent}<quoted_tweet>`);
      lines.push(`${indent}  <author${xmlAttr('name', qt.author.name)}${xmlAttr('handle', qt.author.handle)}${xmlAttr('verified', qt.author.verified || 'none')}/>`);
      if (qt.text) lines.push(`${indent}  <text>${escXml(qt.text)}</text>`);
      if (qt.links.length > 0) {
        lines.push(`${indent}  <links>`);
        for (const l of qt.links) lines.push(`${indent}    <link${xmlAttr('url', l.url)}${xmlAttr('display', l.display)}/>`);
        lines.push(`${indent}  </links>`);
      }
      lines.push(`${indent}</quoted_tweet>`);
    }

    // Link card
    if (tweet.linkCard) {
      const c = tweet.linkCard;
      lines.push(`${indent}<link_card${xmlAttr('domain', c.domain)}${xmlAttr('title', c.title)}${xmlAttr('description', c.description)}${xmlAttr('url', c.url)}/>`);
    }

    // Community note
    if (tweet.communityNote) {
      lines.push(`${indent}<community_note>${escXml(tweet.communityNote)}</community_note>`);
    }

    // Engagement
    if (options.includeEngagement !== false) {
      const e = tweet.engagement;
      const engAttrs = `${xmlAttr('replies', e.replies)}${xmlAttr('retweets', e.retweets)}${xmlAttr('quotes', e.quotes)}${xmlAttr('likes', e.likes)}${xmlAttr('bookmarks', e.bookmarks)}${xmlAttr('views', e.views)}`;
      if (engAttrs) lines.push(`${indent}<engagement${engAttrs}/>`);
    }

    // Flags
    const f = tweet.flags;
    if (f.sensitive || f.translated || f.truncated || f.repost) {
      lines.push(`${indent}<flags sensitive="${f.sensitive}" translated="${f.translated}" truncated="${f.truncated}" repost="${f.repost}"/>`);
    }

    lines.push(`</${tag}>`);
    return lines.join('\n');
  }

  /**
   * Format 1: Structured XML
   */
  function formatStructured(payload, options = {}) {
    const lines = [];

    lines.push('<x_context>');

    // Meta
    lines.push('<meta>');
    lines.push(`  <url>${escXml(payload.meta.url)}</url>`);
    lines.push(`  <extracted_at>${escXml(payload.meta.extractedAt)}</extracted_at>`);
    lines.push(`  <page_type>${escXml(payload.meta.pageType)}</page_type>`);
    lines.push(`  <total_tweets>${payload.meta.totalTweets}</total_tweets>`);
    lines.push(`  <total_links>${payload.meta.totalLinks}</total_links>`);
    lines.push(`  <total_images>${payload.meta.totalImages}</total_images>`);
    lines.push(`  <estimated_tokens>~${payload.meta.estimatedTokens}</estimated_tokens>`);
    lines.push(`  <page>${payload.meta.page} of ?</page>`);
    lines.push(`  <tool>${escXml(payload.meta.tool)}</tool>`);
    lines.push('</meta>');
    lines.push('');

    if (payload.meta.pageType === 'post') {
      // Parent context (thread ancestors above the focal tweet)
      if (payload.parentContext && payload.parentContext.length > 0) {
        lines.push(`<parent_context count="${payload.parentContext.length}">`);
        for (let i = 0; i < payload.parentContext.length; i++) {
          lines.push(formatTweetStructured(payload.parentContext[i], 'parent', `${xmlAttr('index', i + 1)}`, options));
        }
        lines.push('</parent_context>');
        lines.push('');
      }

      // Focal tweet (the post matching the URL)
      if (payload.mainPost) {
        lines.push(formatTweetStructured(payload.mainPost, 'main_post', '', options));
        lines.push('');
      }

      // Replies
      if (payload.replies.length > 0) {
        lines.push(`<replies count="${payload.replies.length}">`);
        for (let i = 0; i < payload.replies.length; i++) {
          const r = payload.replies[i];
          const attrs = `${xmlAttr('index', i + 1)}${xmlAttr('depth', r.threading.depth)}${xmlAttr('reply_to', r.threading.replyTo)}${xmlAttr('is_op', r.threading.isOp)}`;
          lines.push(formatTweetStructured(r, 'reply', attrs, options));
        }
        lines.push('</replies>');
        lines.push('');
      }

    } else if (payload.meta.pageType === 'profile') {
      // Profile header
      if (payload.profile) {
        const p = payload.profile;
        lines.push('<profile>');
        if (p.name !== null && p.name !== undefined) lines.push(`  <name>${escXml(p.name)}</name>`);
        if (p.handle !== null && p.handle !== undefined) lines.push(`  <handle>${escXml(p.handle)}</handle>`);
        if (p.bio) lines.push(`  <bio>${escXml(p.bio)}</bio>`);
        if (p.location) lines.push(`  <location>${escXml(p.location)}</location>`);
        if (p.website) lines.push(`  <website>${escXml(p.website)}</website>`);
        if (p.joined) lines.push(`  <joined>${escXml(p.joined)}</joined>`);
        if (p.following) lines.push(`  <following>${escXml(p.following)}</following>`);
        if (p.followers) lines.push(`  <followers>${escXml(p.followers)}</followers>`);
        lines.push('</profile>');
        lines.push('');
      }

      // Posts
      if (payload.posts.length > 0) {
        lines.push(`<posts count="${payload.posts.length}">`);
        for (let i = 0; i < payload.posts.length; i++) {
          lines.push(formatTweetStructured(payload.posts[i], 'post', `${xmlAttr('index', i + 1)}`, options));
        }
        lines.push('</posts>');
        lines.push('');
      }
    }

    // All links
    if (payload.allLinks.length > 0) {
      lines.push('<all_links>');
      for (const l of payload.allLinks) {
        lines.push(`  <link index="${l.index}" url="${escXml(l.url)}" context="${escXml(l.context)}"/>`);
      }
      lines.push('</all_links>');
      lines.push('');
    }

    // All images
    if (payload.allImages.length > 0 && options.includeImages !== false) {
      lines.push('<all_images>');
      for (const img of payload.allImages) {
        let attrs = `index="${img.index}" url="${escXml(img.url)}" context="${escXml(img.context)}"`;
        if (img.alt) attrs += ` alt="${escXml(img.alt)}"`;
        lines.push(`  <image ${attrs}/>`);
      }
      lines.push('</all_images>');
      lines.push('');
    }

    // Hashtag index
    if (payload.hashtagIndex.length > 0) {
      lines.push('<hashtag_index>');
      for (const h of payload.hashtagIndex) {
        lines.push(`  <hashtag tag="${escXml(h.tag)}" count="${h.count}" tweets="${h.tweets.join(',')}"/>`);
      }
      lines.push('</hashtag_index>');
      lines.push('');
    }

    // Mention index
    if (payload.mentionIndex.length > 0) {
      lines.push('<mention_index>');
      for (const m of payload.mentionIndex) {
        lines.push(`  <mention handle="${escXml(m.handle)}" count="${m.count}" tweets="${m.tweets.join(',')}"/>`);
      }
      lines.push('</mention_index>');
      lines.push('');
    }

    // Domain index
    if (payload.domainIndex.length > 0) {
      lines.push('<domain_index>');
      for (const d of payload.domainIndex) {
        lines.push(`  <domain name="${escXml(d.domain)}" count="${d.count}" tweets="${d.tweets.join(',')}"/>`);
      }
      lines.push('</domain_index>');
      lines.push('');
    }

    // Conversation summary
    if (payload.conversationSummary) {
      const cs = payload.conversationSummary;
      lines.push('<conversation_summary>');
      lines.push(`  <reply_sort_mode>${escXml(cs.replySortMode)}</reply_sort_mode>`);
      lines.push(`  <op_reply_count>${cs.opReplyCount}</op_reply_count>`);
      lines.push(`  <unique_authors>${cs.uniqueAuthors}</unique_authors>`);
      lines.push(`  <deepest_thread_depth>${cs.deepestThreadDepth}</deepest_thread_depth>`);
      if (cs.mostLikedReply) {
        lines.push(`  <most_liked_reply index="${cs.mostLikedReply.index}" likes="${escXml(cs.mostLikedReply.likes)}"/>`);
      }
      lines.push('</conversation_summary>');
    }

    lines.push('</x_context>');

    return lines.join('\n');
  }

  /**
   * Format a single tweet for markdown output
   */
  function formatTweetMarkdown(tweet, prefix = '', options = {}) {
    const lines = [];
    const v = tweet.author.verified !== 'none' ? ` · ✓ ${tweet.author.verified}` : '';
    const displayName = tweet.author.name ?? 'null';
    const handle = tweet.author.handle ?? 'null';
    const timestamp = options.includeTimestamps !== false ? ` · ${tweet.timestamp.display ?? 'null'}` : '';

    lines.push(`${prefix}**${displayName}** (${handle})${v}${timestamp}`);

    if (tweet.threading.replyTo) {
      lines.push(`${prefix}> Replying to ${tweet.threading.replyTo}`);
    }

    if (tweet.text) {
      lines.push('');
      lines.push(tweet.text);
    }

    if (tweet.quotedTweet) {
      lines.push('');
      lines.push(`> **Quoted:** ${tweet.quotedTweet.author.handle ?? 'null'} — ${tweet.quotedTweet.text ?? 'null'}`);
    }

    if (tweet.linkCard) {
      lines.push(`🔗 [${tweet.linkCard.title || tweet.linkCard.domain}](${tweet.linkCard.url})`);
    }

    if (tweet.links.length > 0 && !tweet.linkCard) {
      for (const l of tweet.links) {
        lines.push(`🔗 [${l.display}](${l.url})`);
      }
    }

    if (tweet.images.length > 0 && options.includeImages !== false) {
      for (const img of tweet.images) {
        lines.push(`🖼️ ${img.url}${img.alt ? ' (' + img.alt + ')' : ''}`);
      }
    }

    if (tweet.communityNote) {
      lines.push(`📝 Community Note: ${tweet.communityNote}`);
    }

    if (tweet.poll) {
      lines.push('📊 Poll:');
      for (const opt of tweet.poll.options) {
        lines.push(`  - ${opt.label}: ${opt.votes ?? 'null'}`);
      }
    }

    if (options.includeEngagement !== false) {
      const e = tweet.engagement;
      const parts = [];
      if (e.replies) parts.push(`💬 ${e.replies}`);
      if (e.retweets) parts.push(`🔁 ${e.retweets}`);
      if (e.likes) parts.push(`❤️ ${e.likes}`);
      if (e.bookmarks) parts.push(`🔖 ${e.bookmarks}`);
      if (e.views) parts.push(`👁 ${e.views}`);
      if (parts.length > 0) lines.push(parts.join(' · '));
    }

    return lines.join('\n');
  }

  /**
   * Format 2: Markdown
   */
  // =========================================================================
  // INTELLIGENT MARKDOWN FORMATTING — Self-Deciding Structure
  // =========================================================================

  /**
   * Academic Structure: Formal analysis with citations and sections
   */
  function formatAcademicStructure(payload, lines, _options, analysis) {
    // Abstract/Overview
    lines.push('## Abstract');
    lines.push(`This analysis examines a social media discussion thread from X.com, containing ${payload.meta.totalTweets} posts with ${(payload.replies || []).length} reply interactions. The conversation ${analysis.analysis.hasQuestions ? 'explores research questions' : 'discusses topics'} in a ${analysis.analysis.isDebate ? 'debate-oriented' : 'conversational'} manner.`);
    lines.push('');

    // Main Post as Primary Source
    if (payload.mainPost) {
      lines.push('## Primary Source');
      lines.push('**Original Post**');
      lines.push(`> ${payload.mainPost.text || 'No text content'}`);
      lines.push('');
      lines.push(`**Author:** ${payload.mainPost.author?.handle || 'Unknown'} (${payload.mainPost.author?.name || 'Unknown'})`);
      lines.push(`**Timestamp:** ${payload.mainPost.timestamp?.display || 'Unknown'}`);
      lines.push(`**Engagement:** ${payload.mainPost.engagement?.likes || 0} likes, ${payload.mainPost.engagement?.retweets || 0} reposts, ${payload.mainPost.engagement?.replies || 0} replies`);
      lines.push('');
    }

    // Discussion Analysis
    if (payload.replies && payload.replies.length > 0) {
      lines.push('## Discussion Analysis');

      // Group replies by depth/thread
      const threads = {};
      payload.replies.forEach((reply, index) => {
        const depth = reply.threading?.depth || 0;
        if (!threads[depth]) threads[depth] = [];
        threads[depth].push({ reply, index });
      });

      Object.keys(threads).sort((a, b) => parseInt(a) - parseInt(b)).forEach(depth => {
        const level = parseInt(depth);
        const title = level === 0 ? 'Direct Responses' : `Thread Level ${level}`;
        lines.push(`### ${title}`);
        lines.push('');

        threads[depth].forEach(({ reply, index }) => {
          lines.push(`#### Response ${index + 1}`);
          lines.push(`**${reply.author?.handle || 'Unknown'}:** ${reply.text || 'No text content'}`);
          if (reply.timestamp?.display) {
            lines.push(`*Posted: ${reply.timestamp.display}*`);
          }
          lines.push('');
        });
      });
    }

    // Methodology
    lines.push('## Methodology');
    lines.push('This analysis was generated using X Context Packager v1.0.0 by AdLab, an open-source tool designed for transparent extraction of social media context for research purposes.');
    lines.push('');
  }

  /**
   * Q&A Structure: Question-answer format with threaded discussions
   */
  function formatQAStructure(payload, lines, _options, _analysis) {
    if (payload.mainPost) {
      // Check if main post contains questions
      const mainText = payload.mainPost.text || '';
      const hasQuestion = /\?/.test(mainText);

      if (hasQuestion) {
        lines.push('## Original Question');
        lines.push(`**Q:** ${mainText}`);
        lines.push(`*Asked by ${payload.mainPost.author?.handle || 'Unknown'} on ${payload.mainPost.timestamp?.display || 'Unknown'}*`);
        lines.push('');
      } else {
        lines.push('## Discussion Thread');
        lines.push(`**Topic:** ${mainText.substring(0, 100)}${mainText.length > 100 ? '...' : ''}`);
        lines.push(`*Started by ${payload.mainPost.author?.handle || 'Unknown'} on ${payload.mainPost.timestamp?.display || 'Unknown'}*`);
        lines.push('');
      }
    }

    // Answers and follow-ups
    if (payload.replies && payload.replies.length > 0) {
      lines.push('## Answers & Discussion');

      payload.replies.forEach((reply, index) => {
        const isTopLevel = reply.threading?.depth === 1;
        const prefix = isTopLevel ? 'A' : '↳';

        lines.push(`### ${prefix}${index + 1}: ${reply.author?.handle || 'Unknown'}`);
        lines.push(`${reply.text || 'No text content'}`);
        lines.push(`*${reply.timestamp?.display || 'Unknown'} · ${reply.engagement?.likes || 0} likes*`);
        lines.push('');
      });
    }
  }

  /**
   * Chat Structure: Conversational log format
   */
  function formatChatStructure(payload, lines, _options, _analysis) {
    lines.push('## Conversation Log');
    lines.push('');

    // Main post as conversation start
    if (payload.mainPost) {
      const time = payload.mainPost.timestamp?.display || 'Unknown time';
      lines.push(`[${time}] **${payload.mainPost.author?.handle || 'Unknown'}**`);
      lines.push(`${payload.mainPost.text || 'No message'}`);
      lines.push('');
    }

    // Replies as conversation continuation
    if (payload.replies && payload.replies.length > 0) {
      payload.replies.forEach(reply => {
        const time = reply.timestamp?.display || 'Unknown time';
        const indent = '  '.repeat(reply.threading?.depth || 0);
        lines.push(`${indent}[${time}] **${reply.author?.handle || 'Unknown'}**`);
        lines.push(`${indent}${reply.text || 'No message'}`);
        lines.push('');
      });
    }

    lines.push('---');
    lines.push(`*Conversation ended. ${payload.replies?.length || 0} replies total.*`);
  }

  /**
   * Technical Structure: Documentation format with code emphasis
   */
  function formatTechnicalStructure(payload, lines, _options, _analysis) {
    lines.push('## Technical Discussion');

    if (payload.mainPost) {
      lines.push('### Problem Statement');
      lines.push(`${payload.mainPost.text || 'No description provided'}`);
      lines.push('');
      lines.push(`**Posted by:** ${payload.mainPost.author?.handle || 'Unknown'}`);
      lines.push(`**Date:** ${payload.mainPost.timestamp?.display || 'Unknown'}`);
      lines.push('');
    }

    if (payload.replies && payload.replies.length > 0) {
      lines.push('### Solutions & Discussion');

      // Group by technical themes if possible
      const technicalReplies = payload.replies.filter(reply =>
        reply.text && (reply.text.includes('```') || /function|class|api|code|solution/i.test(reply.text))
      );

      if (technicalReplies.length > 0) {
        lines.push('#### Code Solutions');
        technicalReplies.forEach((reply, index) => {
          lines.push(`**Solution ${index + 1}** by ${reply.author?.handle || 'Unknown'}:`);
          lines.push(`${reply.text}`);
          lines.push('');
        });
      }

      // Other technical discussion
      const discussionReplies = payload.replies.filter(reply =>
        !technicalReplies.includes(reply)
      );

      if (discussionReplies.length > 0) {
        lines.push('#### Technical Discussion');
        discussionReplies.forEach(reply => {
          lines.push(`- **${reply.author?.handle || 'Unknown'}:** ${reply.text || 'No content'}`);
        });
        lines.push('');
      }
    }

    // API/Technical references
    const links = [];
    if (payload.mainPost?.links) links.push(...payload.mainPost.links);
    if (payload.replies) {
      payload.replies.forEach(reply => {
        if (reply.links) links.push(...reply.links);
      });
    }

    if (links.length > 0) {
      lines.push('### References');
      links.forEach(link => {
        lines.push(`- [${link.display}](${link.url})`);
      });
      lines.push('');
    }
  }

  /**
   * Narrative Structure: Story-like chronological format
   */
  function formatNarrativeStructure(payload, lines, _options, _analysis) {
    lines.push('## The Story');

    if (payload.mainPost) {
      lines.push('### The Beginning');
      lines.push(`It started when ${payload.mainPost.author?.name || 'someone'} posted:`);
      lines.push('');
      lines.push(`> "${payload.mainPost.text || 'No story to tell'}"`);
      lines.push('');
      lines.push(`This was on ${payload.mainPost.timestamp?.display || 'a quiet day'}.`);
      lines.push('');
    }

    if (payload.replies && payload.replies.length > 0) {
      lines.push('### What Happened Next');

      // Sort by time if available
      const sortedReplies = [...payload.replies].sort((a, b) => {
        const timeA = new Date(a.timestamp?.iso || 0);
        const timeB = new Date(b.timestamp?.iso || 0);
        return timeA - timeB;
      });

      sortedReplies.forEach((reply) => {
        const character = reply.author?.name || reply.author?.handle || 'Someone';
        const action = reply.threading?.replyTo ? ` replied to ${reply.threading.replyTo}` : ' joined the conversation';

        lines.push(`**${character}**${action}:`);
        lines.push(`"${reply.text || '...'}"`);
        lines.push('');
      });

      lines.push('### The End');
      lines.push(`And so the story concluded, with ${payload.replies.length} voices contributing to the narrative.`);
      lines.push('');
    }
  }

  /**
   * Analyzes content and determines optimal markdown structure
   * Uses meta-prompting logic: debates multiple format options and selects truth
   */
  function analyzeContentForOptimalStructure(payload) {
    const content = {
      hasQuestions: false,
      hasCodeBlocks: false,
      hasLongThreads: false,
      hasTechnicalContent: false,
      hasAcademicTone: false,
      hasConversationalTone: false,
      isDebate: false,
      hasPolls: false,
      hasMedia: false,
      isProfilePage: payload.meta.pageType === 'profile'
    };

    // Analyze all text content
    const allText = [];
    if (payload.mainPost) allText.push(payload.mainPost.text || '');
    if (payload.replies) payload.replies.forEach(r => allText.push(r.text || ''));
    if (payload.posts) payload.posts.forEach(p => allText.push(p.text || ''));
    const fullText = allText.join(' ').toLowerCase();

    // Content analysis
    content.hasQuestions = /\?/.test(fullText) && fullText.split('?').length > 3;
    content.hasCodeBlocks = /```|`[^`]+`|function|class|import|const|let|var/.test(fullText);
    content.hasLongThreads = payload.replies && payload.replies.length > 20;
    content.hasTechnicalContent = /(api|algorithm|framework|library|protocol|database|server|client|http|json|xml)/.test(fullText);
    content.hasAcademicTone = /(research|study|analysis|methodology|hypothesis|conclusion|literature)/.test(fullText);
    content.isDebate = /(however|but|actually|wrong|agree|disagree|counterpoint|alternative)/.test(fullText);
    content.hasPolls = payload.replies && payload.replies.some(r => r.poll);
    content.hasMedia = payload.meta.totalImages > 0 || (payload.replies && payload.replies.some(r => r.video || r.gif));

    // Meta-prompting logic: debate format options
    const formatOptions = [
      {
        name: 'academic',
        score: (content.hasAcademicTone ? 3 : 0) + (content.hasLongThreads ? 2 : 0) + (content.hasQuestions ? 1 : 0),
        structure: 'Academic paper style with citations, sections, and formal analysis'
      },
      {
        name: 'qa',
        score: (content.hasQuestions ? 3 : 0) + (content.isDebate ? 2 : 0) + (content.hasLongThreads ? 1 : 0),
        structure: 'Q&A format with threaded discussions and answer hierarchies'
      },
      {
        name: 'chat',
        score: (content.isDebate ? 2 : 0) + (content.hasConversationalTone ? 3 : 0) + (!content.hasLongThreads ? 2 : 0),
        structure: 'Chat log style with timestamps and conversational flow'
      },
      {
        name: 'technical',
        score: (content.hasTechnicalContent ? 3 : 0) + (content.hasCodeBlocks ? 3 : 0) + (content.hasMedia ? 1 : 0),
        structure: 'Technical documentation with code blocks, API references, and structured examples'
      },
      {
        name: 'narrative',
        score: (!content.hasQuestions && !content.hasTechnicalContent && !content.hasAcademicTone ? 3 : 0) + (content.hasLongThreads ? 1 : 0),
        structure: 'Narrative story format with chronological flow and character development'
      }
    ];

    // Select highest scoring format, with stability tiebreaker
    formatOptions.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    const optimalFormat = formatOptions[0];

    return {
      format: optimalFormat.name,
      score: optimalFormat.score,
      structure: optimalFormat.structure,
      analysis: content
    };
  }

  function formatMarkdown(payload, options = {}) {
    // First, analyze content to determine optimal structure
    const structureAnalysis = analyzeContentForOptimalStructure(payload);

    const lines = [];

    // Header adapts based on format
    const formatTitles = {
      academic: 'X.com Discussion Analysis',
      qa: 'X.com Q&A Thread',
      chat: 'X.com Conversation Log',
      technical: 'X.com Technical Discussion',
      narrative: 'X.com Story Thread'
    };

    lines.push(`# ${formatTitles[structureAnalysis.format] || 'X.com Post Context'}`);
    lines.push(`**URL:** ${payload.meta.url}`);
    lines.push(`**Extracted:** ${payload.meta.extractedAt} | ${payload.meta.totalTweets} tweets | ${payload.meta.totalLinks} links | ${payload.meta.totalImages} images | ~${payload.meta.estimatedTokens} tokens`);
    lines.push(`**Tool:** ${payload.meta.tool}`);
    lines.push(`**Format:** ${structureAnalysis.structure}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    if (payload.meta.pageType === 'post') {
      if (payload.parentContext && payload.parentContext.length > 0) {
        lines.push(`## THREAD CONTEXT (${payload.parentContext.length})`);
        lines.push('');
        for (let i = 0; i < payload.parentContext.length; i++) {
          lines.push(`### Parent ${i + 1}`);
          lines.push(formatTweetMarkdown(payload.parentContext[i], '', options));
          lines.push('');
        }
        lines.push('---');
        lines.push('');
      }

      // Use intelligent structure-specific formatting
      if (structureAnalysis.format === 'academic') {
        formatAcademicStructure(payload, lines, options, structureAnalysis);
      } else if (structureAnalysis.format === 'qa') {
        formatQAStructure(payload, lines, options, structureAnalysis);
      } else if (structureAnalysis.format === 'chat') {
        formatChatStructure(payload, lines, options, structureAnalysis);
      } else if (structureAnalysis.format === 'technical') {
        formatTechnicalStructure(payload, lines, options, structureAnalysis);
      } else {
        formatNarrativeStructure(payload, lines, options, structureAnalysis);
      }

    } else if (payload.meta.pageType === 'profile') {
      if (payload.profile) {
        const p = payload.profile;
        lines.push('## PROFILE');
        lines.push(`**${p.name}** (${p.handle})`);
        if (p.bio) lines.push(`> ${p.bio}`);
        const meta = [];
        if (p.followers) meta.push(`${p.followers} followers`);
        if (p.following) meta.push(`${p.following} following`);
        if (p.location) meta.push(p.location);
        if (p.joined) meta.push(p.joined);
        if (meta.length > 0) lines.push(meta.join(' · '));
        lines.push('');
        lines.push('---');
        lines.push('');
      }

      if (payload.posts.length > 0) {
        lines.push(`## POSTS (${payload.posts.length})`);
        lines.push('');
        for (let i = 0; i < payload.posts.length; i++) {
          lines.push(`### ${i + 1}.`);
          lines.push(formatTweetMarkdown(payload.posts[i], '', options));
          lines.push('');
        }
        lines.push('---');
        lines.push('');
      }
    }

    // Indexes
    if (payload.hashtagIndex.length > 0) {
      lines.push('## INDEXES');
      lines.push('');
      lines.push('### Hashtags');
      for (const h of payload.hashtagIndex) {
        lines.push(`- ${h.tag} (${h.count} times: tweets ${h.tweets.join(',')})`);
      }
      lines.push('');
    }

    if (payload.mentionIndex.length > 0) {
      lines.push('### Mentions');
      for (const m of payload.mentionIndex) {
        lines.push(`- ${m.handle} (${m.count} times: tweets ${m.tweets.join(',')})`);
      }
      lines.push('');
    }

    if (payload.domainIndex.length > 0) {
      lines.push('### Domains');
      for (const d of payload.domainIndex) {
        lines.push(`- ${d.domain} (${d.count} links)`);
      }
      lines.push('');
    }

    // Summary
    if (payload.conversationSummary) {
      const cs = payload.conversationSummary;
      lines.push('## SUMMARY');
      lines.push(`Sort: ${cs.replySortMode} | OP replies: ${cs.opReplyCount} | Unique authors: ${cs.uniqueAuthors} | Max depth: ${cs.deepestThreadDepth}`);
    }

    return lines.join('\n');
  }

  /**
   * Format a single tweet for plain text output
   */
  function formatTweetPlain(tweet, options = {}) {
    const lines = [];
    const v = tweet.author.verified !== 'none' ? ` verified:${tweet.author.verified}` : '';
    const timestamp = options.includeTimestamps !== false ? ` - ${tweet.timestamp.display ?? 'null'}` : '';

    lines.push(`${tweet.author.name ?? 'null'} (${tweet.author.handle ?? 'null'})${v}${timestamp}`);

    if (tweet.threading.replyTo) {
      lines.push(`Replying to ${tweet.threading.replyTo}`);
    }

    if (tweet.text) lines.push(tweet.text);

    if (tweet.quotedTweet) {
      lines.push(`Quoted: ${tweet.quotedTweet.author.handle ?? 'null'} - ${tweet.quotedTweet.text ?? 'null'}`);
    }

    if (tweet.linkCard) {
      lines.push(`Link: ${tweet.linkCard.title || ''} - ${tweet.linkCard.url}`);
    }

    if (tweet.links.length > 0 && !tweet.linkCard) {
      lines.push(`Links: ${tweet.links.map(l => l.url).join(', ')}`);
    }

    if (tweet.images.length > 0 && options.includeImages !== false) {
      lines.push(`Images: ${tweet.images.map(i => i.url).join(', ')}`);
    }

    if (tweet.communityNote) {
      lines.push(`Community Note: ${tweet.communityNote}`);
    }

    if (options.includeEngagement !== false) {
      const e = tweet.engagement;
      const parts = [];
      if (e.replies) parts.push(`Replies:${e.replies}`);
      if (e.retweets) parts.push(`Retweets:${e.retweets}`);
      if (e.likes) parts.push(`Likes:${e.likes}`);
      if (e.bookmarks) parts.push(`Bookmarks:${e.bookmarks}`);
      if (e.views) parts.push(`Views:${e.views}`);
      if (parts.length > 0) lines.push(parts.join(' '));
    }

    return lines.join('\n');
  }

  /**
   * Format 3: Plain text
   */
  function formatPlain(payload, options = {}) {
    const lines = [];

    lines.push('X.com Post Context');
    lines.push(`URL: ${payload.meta.url}`);
    lines.push(`Extracted: ${payload.meta.extractedAt} | ${payload.meta.totalTweets} tweets | ~${payload.meta.estimatedTokens} tokens`);
    lines.push(`Tool: ${payload.meta.tool}`);
    lines.push('');
    lines.push('---');

    if (payload.meta.pageType === 'post') {
      if (payload.parentContext && payload.parentContext.length > 0) {
        lines.push(`THREAD CONTEXT (${payload.parentContext.length})`);
        lines.push('');
        for (let i = 0; i < payload.parentContext.length; i++) {
          lines.push(`Parent ${i + 1}:`);
          lines.push(formatTweetPlain(payload.parentContext[i], options));
          lines.push('');
        }
        lines.push('---');
      }

      if (payload.mainPost) {
        lines.push('MAIN POST');
        lines.push(formatTweetPlain(payload.mainPost, options));
        lines.push('');
        lines.push('---');
      }

      if (payload.replies.length > 0) {
        lines.push(`REPLIES (${payload.replies.length})`);
        lines.push('');
        for (let i = 0; i < payload.replies.length; i++) {
          const r = payload.replies[i];
          const depth = r.threading.depth > 1 ? ` [depth:${r.threading.depth}]` : '';
          const op = r.threading.isOp ? ' (OP)' : '';
          const replyTo = r.threading.replyTo ? ` replying to ${r.threading.replyTo}` : '';
          const timeLabel = options.includeTimestamps !== false ? ` - ${r.timestamp.display ?? 'null'}` : '';
          lines.push(`${i + 1}. ${r.author.handle ?? 'null'}${op}${timeLabel}${depth}${replyTo}`);
          lines.push(formatTweetPlain(r, options));
          lines.push('');
        }
        lines.push('---');
      }

    } else if (payload.meta.pageType === 'profile') {
      if (payload.profile) {
        const p = payload.profile;
        lines.push('PROFILE');
        lines.push(`${p.name} (${p.handle})`);
        if (p.bio) lines.push(`Bio: ${p.bio}`);
        if (p.followers) lines.push(`Followers: ${p.followers}`);
        if (p.following) lines.push(`Following: ${p.following}`);
        if (p.location) lines.push(`Location: ${p.location}`);
        if (p.joined) lines.push(p.joined);
        lines.push('');
        lines.push('---');
      }

      if (payload.posts.length > 0) {
        lines.push(`POSTS (${payload.posts.length})`);
        lines.push('');
        for (let i = 0; i < payload.posts.length; i++) {
          lines.push(`${i + 1}.`);
          lines.push(formatTweetPlain(payload.posts[i], options));
          lines.push('');
        }
        lines.push('---');
      }
    }

    // Indexes
    if (payload.hashtagIndex.length > 0) {
      lines.push(`HASHTAGS: ${payload.hashtagIndex.map(h => `${h.tag}(${h.count})`).join(' ')}`);
    }
    if (payload.mentionIndex.length > 0) {
      lines.push(`MENTIONS: ${payload.mentionIndex.map(m => `${m.handle}(${m.count})`).join(' ')}`);
    }
    if (payload.domainIndex.length > 0) {
      lines.push(`DOMAINS: ${payload.domainIndex.map(d => `${d.domain}(${d.count})`).join(' ')}`);
    }

    if (payload.conversationSummary) {
      const cs = payload.conversationSummary;
      lines.push(`SUMMARY: sort:${cs.replySortMode} op_replies:${cs.opReplyCount} authors:${cs.uniqueAuthors} max_depth:${cs.deepestThreadDepth}`);
    }

    return lines.join('\n');
  }

  // =========================================================================
  // TELEMETRY & QUALITY SCORING
  // =========================================================================

  /**
   * Tracks extraction quality and generates health reports
   */
  const EXTRACTION_TELEMETRY = {
    currentSession: {
      startTime: Date.now(),
      pageType: null,
      selectorsUsed: [],
      fallbacksTriggered: 0,
      selfHealingUsed: 0,
      extractionQuality: 1.0,
      errors: []
    },

    /**
     * Calculate quality score for a tweet extraction (0-1)
     */
    calculateTweetQuality: function(tweet) {
      let score = 1.0;
      let factors = 0;

      // Author completeness (name + handle)
      if (tweet.author.name && tweet.author.handle) {
        score *= 1.0;
      } else if (tweet.author.name || tweet.author.handle) {
        score *= 0.7;
      } else {
        score *= 0.3;
      }
      factors++;

      // Text presence
      if (!tweet.text) {
        score *= 0.5;
        factors++;
      }

      // Timestamp presence
      if (!tweet.timestamp.iso && !tweet.timestamp.display) {
        score *= 0.8;
        factors++;
      }

      // Engagement data presence
      const hasEngagement = Object.values(tweet.engagement).some(v => v !== null);
      if (!hasEngagement) {
        score *= 0.9;
        factors++;
      }

      // Links/images presence (if expected)
      if (tweet.links.length === 0 && tweet.images.length === 0 && tweet.text &&
          (tweet.text.includes('http') || tweet.text.includes('pbs.twimg.com'))) {
        score *= 0.7; // Expected media but not found
        factors++;
      }

      return factors > 0 ? score : 1.0;
    },

    /**
     * Generate extraction health report
     */
    generateHealthReport: function() {
      const report = {
        systemHealth: SELECTOR_HEALTH.getSystemHealth(),
        sessionStats: { ...this.currentSession },
        recommendations: [],
        criticalIssues: []
      };

      // Analyze selector performance
      const selectorKeys = Object.keys(SELECTOR_HEALTH.stats);
      for (const key of selectorKeys) {
        const bestSelector = SELECTOR_HEALTH.getBestSelector(key);
        const health = SELECTOR_HEALTH.getHealthScore(key, bestSelector);

        if (health < 0.5) {
          report.criticalIssues.push({
            type: 'selector_health',
            selector: key,
            health: health,
            message: `Selector '${key}' has poor health (${Math.round(health * 100)}%). Consider updating.`
          });
        }
      }

      // Quality analysis
      if (report.systemHealth < 0.8) {
        report.recommendations.push({
          type: 'system_health',
          message: 'Overall system health is degraded. Consider updating selectors.',
          severity: 'high'
        });
      }

      // Session analysis
      if (this.currentSession.fallbacksTriggered > 10) {
        report.recommendations.push({
          type: 'fallback_usage',
          message: `${this.currentSession.fallbacksTriggered} selector fallbacks triggered. Primary selectors may be outdated.`,
          severity: 'medium'
        });
      }

      if (this.currentSession.selfHealingUsed > 5) {
        report.recommendations.push({
          type: 'self_healing',
          message: `${this.currentSession.selfHealingUsed} self-healing operations performed. DOM structure may have changed significantly.`,
          severity: 'high'
        });
      }

      return report;
    },

    /**
     * Record extraction completion
     */
    recordExtractionComplete: function(pageType, extractedData, qualityScore) {
      this.currentSession.pageType = pageType;
      this.currentSession.extractionQuality = qualityScore;

      // Generate and store health report
      const healthReport = this.generateHealthReport();

      try {
        chrome.storage.local.set({
          'lastHealthReport': healthReport,
          'lastExtractionTime': Date.now(),
          'extractionQuality': qualityScore
        });
      } catch (e) {
        // Silent fail
      }
    },

    /**
     * Reset session stats for new extraction
     */
    resetSession: function() {
      this.currentSession = {
        startTime: Date.now(),
        pageType: null,
        selectorsUsed: [],
        fallbacksTriggered: 0,
        selfHealingUsed: 0,
        extractionQuality: 1.0,
        errors: []
      };
    }
  };

  // =========================================================================
  // PERIODIC DOM VALIDATION & CHANGE MONITORING
  // =========================================================================

  /**
   * Monitors DOM changes and validates selector health
   */
  const _DOM_CHANGE_MONITOR = {
    validationInterval: 24 * 60 * 60 * 1000, // 24 hours
    lastValidation: null,

    /**
     * Run periodic validation of all selectors
     */
    validateSelectors: function() {
      const now = Date.now();
      if (this.lastValidation && (now - this.lastValidation) < this.validationInterval) {
        return; // Too soon
      }

      this.lastValidation = now;
      const validationResults = {};

      // Test each selector against current DOM
      for (const [key, selector] of Object.entries(SELECTORS)) {
        try {
          const elements = document.querySelectorAll(selector);
          const success = elements.length > 0;

          validationResults[key] = {
            selector: selector,
            found: elements.length,
            success: success,
            timestamp: now
          };

          // Update health stats
          SELECTOR_HEALTH.recordUsage(key, selector, success, 1.0, { validation: true });
        } catch (e) {
          validationResults[key] = {
            selector: selector,
            error: e.message,
            timestamp: now
          };
        }
      }

      // Store validation results
      try {
        chrome.storage.local.set({
          'lastValidation': validationResults,
          'validationTimestamp': now
        });
      } catch (e) {
        // Silent fail
      }

      return validationResults;
    },

    /**
     * Check for DOM structure changes since last validation
     */
    detectChanges: function() {
      // This would compare current DOM structure to baseline
      // For now, just run validation
      return this.validateSelectors();
    },

    /**
     * Schedule periodic validation (runs on extension startup)
     */
    scheduleValidation: function() {
      // Run initial validation
      setTimeout(() => this.validateSelectors(), 5000); // 5 second delay

      // Schedule future validations
      setInterval(() => this.validateSelectors(), this.validationInterval);
    }
  };

  // =========================================================================
  // COMMUNITY CONTRIBUTION PIPELINE
  // =========================================================================

  /**
   * Allows community-sourced selector updates and validation
   */
  const _COMMUNITY_CONTRIBUTIONS = {
    /**
     * Submit a selector update for community validation
     */
    submitSelectorUpdate: function(selectorKey, newSelector, contributorInfo = {}) {
      const submission = {
        selectorKey: selectorKey,
        newSelector: newSelector,
        contributor: contributorInfo,
        submittedAt: Date.now(),
        validationResults: null,
        status: 'pending'
      };

      try {
        // In a real implementation, this would send to a server
        // For now, store locally for manual review
        chrome.storage.local.get(['communitySubmissions'], (result) => {
          const submissions = result.communitySubmissions || [];
          submissions.push(submission);

          chrome.storage.local.set({
            'communitySubmissions': submissions
          });
        });
      } catch (e) {
        // Silent fail
      }
    },

    /**
     * Validate community submissions
     */
    validateSubmissions: function() {
      // In a real system, this would run automated tests
      // For now, just mark as validated
      try {
        chrome.storage.local.get(['communitySubmissions'], (result) => {
          const submissions = result.communitySubmissions || [];
          submissions.forEach(sub => {
            if (sub.status === 'pending') {
              // Basic validation: check if selector is syntactically valid
              try {
                document.querySelectorAll(sub.newSelector);
                sub.status = 'validated';
                sub.validatedAt = Date.now();
              } catch (e) {
                sub.status = 'invalid';
                sub.error = e.message;
              }
            }
          });

          chrome.storage.local.set({
            'communitySubmissions': submissions
          });
        });
      } catch (e) {
        // Silent fail
      }
    }
  };

  // Monitoring systems are available but not auto-started.
  // They activate only when extraction runs to avoid unnecessary work.

  // =========================================================================
  // MAIN — Execute extraction and return result
  // =========================================================================

  // Initialize telemetry for this extraction session
  EXTRACTION_TELEMETRY.resetSession();
  clearSelectorCache();

  const url = window.location.href;
  const pageType = detectPageType(url);

  if (pageType === 'unsupported') {
    return {
      success: false,
      error: 'unsupported',
      message: 'Navigate to X.com to package a thread',
    };
  }

  try {
    let extractedData;
    if (pageType === 'post') {
      extractedData = extractPostPage();
    } else {
      extractedData = extractProfilePage();
    }

    if (extractedData.error) {
      return {
        success: false,
        error: 'no_content',
        message: extractedData.error,
      };
    }

    const payload = buildPayload(pageType, url, extractedData);

    // Generate all three formats from canonical payload
    const structured = formatStructured(payload);

    // Calculate token estimates for the default (structured) format
    const tokens = estimateTokens(structured);
    payload.meta.estimatedTokens = tokens;
    payload.meta.tokenSize = classifyTokenSize(tokens);

    // Re-generate formatted strings with updated metadata
    const structuredFinal = formatStructured(payload);
    const markdownFinal = formatMarkdown(payload);
    const plainFinal = formatPlain(payload);

    // Calculate extraction quality score
    let qualityScore = 1.0;
    if (pageType === 'post' && extractedData.mainPost) {
      qualityScore = EXTRACTION_TELEMETRY.calculateTweetQuality(extractedData.mainPost);
    }

    // Record extraction completion with telemetry
    EXTRACTION_TELEMETRY.recordExtractionComplete(pageType, extractedData, qualityScore);

    // Get current system health
    const systemHealth = SELECTOR_HEALTH.getSystemHealth();

    return {
      success: true,
      pageType: pageType,
      stats: {
        tweets: payload.meta.totalTweets,
        links: payload.meta.totalLinks,
        images: payload.meta.totalImages,
        tokens: tokens,
        tokenSize: payload.meta.tokenSize,
      },
      structured: structuredFinal,
      markdown: markdownFinal,
      plain: plainFinal,
      payload: payload,
      telemetry: {
        systemHealth: systemHealth,
        extractionQuality: qualityScore,
        selectorsUsed: EXTRACTION_TELEMETRY.currentSession.selectorsUsed,
        fallbacksTriggered: EXTRACTION_TELEMETRY.currentSession.fallbacksTriggered,
        selfHealingUsed: EXTRACTION_TELEMETRY.currentSession.selfHealingUsed
      }
    };
  } catch (error) {
    // Record error in telemetry
    EXTRACTION_TELEMETRY.currentSession.errors.push({
      message: error.message,
      stack: error.stack,
      timestamp: Date.now()
    });

    return {
      success: false,
      error: 'extraction_failed',
      message: 'Extraction failed — try refreshing the page and packaging again',
      telemetry: {
        systemHealth: SELECTOR_HEALTH.getSystemHealth(),
        error: error.message
      }
    };
  }

})();
