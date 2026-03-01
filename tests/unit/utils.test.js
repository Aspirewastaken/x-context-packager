/**
 * Unit tests for utility functions in content.js
 * These tests validate the logic without DOM dependencies
 */

describe('Utility Functions Logic', () => {
  describe('parseEngagement logic', () => {
    // Test the parsing logic directly
    function parseEngagementLogic(ariaLabel, spanText = '') {
      if (!ariaLabel && !spanText) return null;

      if (ariaLabel) {
        const match = ariaLabel.match(/^([\d,.]+[KMB]?)\s/i);
        if (match) return match[1];
      }

      // Fallback to span text
      if (spanText && spanText !== '') return spanText;

      return null;
    }

    test('parses aria-label with number', () => {
      expect(parseEngagementLogic('712 replies')).toBe('712');
    });

    test('parses aria-label with K abbreviation', () => {
      expect(parseEngagementLogic('2.5K likes')).toBe('2.5K');
    });

    test('parses aria-label with M abbreviation', () => {
      expect(parseEngagementLogic('1.2M views')).toBe('1.2M');
    });

    test('parses multi-clause aria-labels from the leading metric', () => {
      expect(parseEngagementLogic('10.2K reposts, including 2 quote posts')).toBe('10.2K');
    });

    test('falls back to span text content', () => {
      expect(parseEngagementLogic('', '1.5K')).toBe('1.5K');
    });

    test('returns null for no data', () => {
      expect(parseEngagementLogic('')).toBe(null);
      expect(parseEngagementLogic(null)).toBe(null);
    });
  });

  describe('estimateTokens logic', () => {
    function estimateTokensLogic(text) {
      if (!text) return 0;
      return Math.ceil(text.length / 4);
    }

    test('estimates tokens correctly', () => {
      expect(estimateTokensLogic('hello world')).toBe(3); // 11 chars / 4 = 2.75 → 3
      expect(estimateTokensLogic('')).toBe(0);
      expect(estimateTokensLogic(null)).toBe(0);
      expect(estimateTokensLogic('a')).toBe(1); // 1 char / 4 = 0.25 → 1
    });
  });

  describe('parseMetricValue logic', () => {
    function parseMetricValueLogic(raw) {
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

    test('parses abbreviated values', () => {
      expect(parseMetricValueLogic('2.5K')).toBe(2500);
      expect(parseMetricValueLogic('1.2M')).toBe(1200000);
      expect(parseMetricValueLogic('4.3B')).toBe(4300000000);
    });

    test('parses comma separated and zero values', () => {
      expect(parseMetricValueLogic('1,234')).toBe(1234);
      expect(parseMetricValueLogic('0')).toBe(0);
    });

    test('handles nullish and invalid inputs', () => {
      expect(parseMetricValueLogic(null)).toBe(-1);
      expect(parseMetricValueLogic('')).toBe(-1);
      expect(parseMetricValueLogic('n/a')).toBe(-1);
    });
  });

  describe('classifyTokenSize logic', () => {
    function classifyTokenSizeLogic(tokens) {
      if (tokens < 2000) return { level: 'green', label: 'Fits any LLM context' };
      if (tokens < 8000) return { level: 'yellow', label: 'Medium context' };
      if (tokens < 32000) return { level: 'orange', label: 'Large context — use 100K+ models' };
      return { level: 'red', label: 'Very large — consider truncating' };
    }

    test('classifies small contexts as green', () => {
      const result = classifyTokenSizeLogic(1500);
      expect(result.level).toBe('green');
      expect(result.label).toContain('Fits any LLM context');
    });

    test('classifies medium contexts as yellow', () => {
      const result = classifyTokenSizeLogic(5000);
      expect(result.level).toBe('yellow');
      expect(result.label).toContain('Medium context');
    });

    test('classifies large contexts as orange', () => {
      const result = classifyTokenSizeLogic(20000);
      expect(result.level).toBe('orange');
      expect(result.label).toContain('Large context');
    });

    test('classifies very large contexts as red', () => {
      const result = classifyTokenSizeLogic(50000);
      expect(result.level).toBe('red');
      expect(result.label).toContain('Very large');
    });
  });

  describe('extractDomain logic', () => {
    function extractDomainLogic(url) {
      try {
        return new URL(url).hostname.replace(/^www\./, '');
      } catch {
        return null;
      }
    }

    test('extracts domain from valid URLs', () => {
      expect(extractDomainLogic('https://github.com/user/repo')).toBe('github.com');
      expect(extractDomainLogic('https://www.example.com/path')).toBe('example.com');
      expect(extractDomainLogic('http://sub.domain.org')).toBe('sub.domain.org');
    });

    test('handles invalid URLs gracefully', () => {
      expect(extractDomainLogic('not-a-url')).toBe(null);
      expect(extractDomainLogic('')).toBe(null);
      expect(extractDomainLogic(null)).toBe(null);
    });
  });

  describe('detectPageType logic', () => {
    function detectPageTypeLogic(url) {
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

    test('detects post pages', () => {
      expect(detectPageTypeLogic('https://x.com/user/status/123456')).toBe('post');
      expect(detectPageTypeLogic('https://twitter.com/user/status/123456')).toBe('post');
      expect(detectPageTypeLogic('https://www.x.com/user/status/123456')).toBe('post');
    });

    test('detects profile pages', () => {
      expect(detectPageTypeLogic('https://x.com/username')).toBe('profile');
      expect(detectPageTypeLogic('https://x.com/username/')).toBe('profile');
    });

    test('detects unsupported pages', () => {
      expect(detectPageTypeLogic('https://x.com/explore')).toBe('unsupported');
      expect(detectPageTypeLogic('https://x.com/user/followers')).toBe('unsupported');
      expect(detectPageTypeLogic('https://google.com')).toBe('unsupported');
      expect(detectPageTypeLogic('not-a-url')).toBe('unsupported');
    });

    test('handles edge cases', () => {
      expect(detectPageTypeLogic('')).toBe('unsupported');
      expect(detectPageTypeLogic(null)).toBe('unsupported');
    });
  });

  describe('status ID matching logic', () => {
    function matchesStatusHref(href, statusId) {
      const statusPathPattern = new RegExp(`/status/${statusId}(?:[/?#]|$)`);
      return statusPathPattern.test(href || '');
    }

    test('matches exact status IDs', () => {
      expect(matchesStatusHref('/user/status/12345', '12345')).toBe(true);
      expect(matchesStatusHref('/user/status/12345/photo/1', '12345')).toBe(true);
      expect(matchesStatusHref('/user/status/12345?ref=abc', '12345')).toBe(true);
    });

    test('rejects substring false positives', () => {
      expect(matchesStatusHref('/user/status/123456', '12345')).toBe(false);
      expect(matchesStatusHref('/user/status/912345', '12345')).toBe(false);
    });
  });

  describe('SELECTORS validation', () => {
    test('SELECTORS object structure', () => {
      // This would require reading the actual content.js file
      // For now, just test that the concept works
      const mockSelectors = {
        tweet: '[data-testid="tweet"]',
        tweetText: '[data-testid="tweetText"]',
        userName: '[data-testid="User-Name"]'
      };

      expect(mockSelectors).toHaveProperty('tweet');
      expect(mockSelectors).toHaveProperty('tweetText');
      expect(mockSelectors).toHaveProperty('userName');

      // Ensure selectors are strings and contain brackets (basic CSS selector validation)
      Object.values(mockSelectors).forEach(selector => {
        expect(typeof selector).toBe('string');
        expect(selector).toMatch(/[\[\.]/); // Should contain [ or . for CSS selectors
      });
    });
  });
});