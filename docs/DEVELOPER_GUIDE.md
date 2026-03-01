# Developer Guide — X Context Packager

This guide provides technical details for developers working on X Context Packager.

## Architecture Overview

### High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Popup UI      │    │  Content Script │    │   Output        │
│  (popup.js)     │───▶│ (content.js)    │───▶│  Formatters     │
│                 │    │                 │    │                 │
│ • State mgmt    │    │ • DOM extraction│    │ • Structured    │
│ • User prefs    │    │ • Data processing│    │ • Markdown     │
│ • Injection     │    │ • Payload build  │    │ • Plain Text   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
       ▲                       ▲                       │
       │                       │                       ▼
       └───────────────────────┼────────────────▶ Clipboard
                               ▼
                       ┌─────────────────┐
                       │ Chrome Storage  │
                       │ (User Prefs)    │
                       └─────────────────┘
```

### Component Responsibilities

#### Popup (`popup/`)
- **popup.html**: UI structure and layout
- **popup.css**: AdLab dark theme styling and animations
- **popup.js**: State machine, user interactions, content script injection

#### Content Script (`content/`)
- **Single file architecture**: All extraction logic in `content.js`
- **DOM reading only**: Zero network requests
- **Defensive extraction**: Try/catch around all DOM queries

#### Output Formatters
- **Structured XML**: Default format for LLM parsing
- **Markdown**: Human-readable format
- **Plain Text**: Token-efficient format

### Data Flow

1. **User clicks "📦 Package"**
2. **Popup injects content script** via `chrome.scripting.executeScript`
3. **Content script detects page type** (post/profile/unsupported)
4. **DOM extraction** using centralized `SELECTORS` object
5. **Data aggregation** (hashtags, mentions, domains, conversation stats)
6. **Format selection** based on user preference
7. **Clipboard write** and UI state update

## Key Design Decisions

### Single-File Content Script

**Why?** Chrome Manifest V3 doesn't support ES modules in content scripts without bundlers.

**Implications:**
- All extraction logic in one file (~1600 lines)
- Clear section comments for navigation
- No code splitting or modular imports

### Centralized SELECTORS Object

**Why?** X.com changes DOM frequently. All selectors in one place for easy updates.

**Pattern:**
```javascript
const SELECTORS = {
  tweet: '[data-testid="tweet"]',
  tweetText: '[data-testid="tweetText"]',
  // ... all selectors here
};
```

### Defensive Programming

**Why?** DOM structures change. Code must handle missing elements gracefully.

**Pattern:**
```javascript
function extractField(element) {
  try {
    const field = element.querySelector(SELECTOR);
    return field ? field.textContent?.trim() || null : null;
  } catch (error) {
    console.warn('Failed to extract field:', error);
    return null;
  }
}
```

### Null vs Fabrication

**Why?** Transparency. Never make up data.

**Pattern:**
```javascript
// ✅ Good: Return null for missing data
followerCount: extractFollowerCount() || null

// ❌ Bad: Fabricate data
followerCount: extractFollowerCount() || '0'
```

## Development Workflow

### Local Development

1. **Clone repository**
2. **Load in Chrome:**
   - `chrome://extensions` → Developer Mode → Load unpacked
   - Select repository root folder
3. **Test changes:**
   - Navigate to X.com post with replies
   - Click extension icon
   - Verify extraction works
4. **Debug console:**
   - Popup: Inspect popup window
   - Content: Inspect X.com tab console

### Code Organization

#### content.js Structure

```
1. SELECTORS object (lines 23-71)
2. Utility functions (lines 75-220)
3. Page type detection (lines 224-167)
4. Tweet extraction (lines 171-800)
5. Aggregation functions (lines 804-1000)
6. Output formatters (lines 1004-1400)
7. Main extraction function (lines 1404-1520)
```

#### popup.js Structure

```
1. State management (lines 1-50)
2. DOM element references (lines 54-80)
3. Event handlers (lines 84-200)
4. Content script injection (lines 204-250)
5. Settings persistence (lines 254-300)
```

## Common Development Tasks

### Updating Selectors

**When X.com changes DOM:**
1. Open DevTools on affected page
2. Inspect broken element
3. Find new `data-testid` or selector
4. Update `SELECTORS` object
5. Test on multiple page types

**Example:**
```javascript
// Old selector
tweetText: '[data-testid="tweetText"]',

// New selector (after X.com change)
tweetText: '[data-testid="Tweet-User-Text"]',
```

### Adding New Fields

**Checklist:**
1. Add field to tweet extraction object structure
2. Implement extraction function with try/catch
3. Handle missing data (return null)
4. Update all output formatters
5. Add to tests
6. Update documentation

**Example:**
```javascript
// 1. Add to tweet object structure
const tweet = {
  // ... existing fields
  newField: null,
};

// 2. Implement extraction
tweet.newField = extractNewField(tweetEl);

// 3. Implement extractor
function extractNewField(tweetEl) {
  try {
    const element = qs(tweetEl, SELECTORS.newField);
    return element ? element.textContent?.trim() || null : null;
  } catch {
    return null;
  }
}
```

### Testing Changes

**Unit Tests:**
```bash
npm test                    # Run all tests
npm test -- utils.test.js   # Run specific test file
npm run test:coverage       # Run with coverage report
```

**Manual Testing:**
- Follow `tests/manual-testing.md`
- Test on post pages, profile pages, edge cases
- Verify all output formats

## Troubleshooting

### Extension Won't Load

**Symptoms:** Extension not appearing in toolbar

**Solutions:**
- Verify manifest.json is valid JSON
- Check Chrome Developer Mode is enabled
- Reload extension after changes
- Check console for manifest errors

### Extraction Fails

**Symptoms:** No output in clipboard, button stays "📦 Package"

**Debug Steps:**
1. Open DevTools on X.com tab
2. Check console for JavaScript errors
3. Verify on valid X.com URL (not x.com/explore, etc.)
4. Check SELECTORS object for outdated selectors

**Common Issues:**
- X.com DOM changed — update selectors
- On non-X.com page — check page type detection
- Content script injection failed — check permissions

### Selectors Not Working

**Debug Process:**
1. Open DevTools → Elements tab
2. Find target element in DOM
3. Copy `data-testid` or CSS selector
4. Update SELECTORS object
5. Test extraction

**Tools:**
- Chrome DevTools Inspector
- `document.querySelector()` in console
- `$$()` for multiple elements

### Performance Issues

**Symptoms:** Extraction takes >3 seconds, high memory usage

**Causes:**
- Large threads (100+ tweets)
- Inefficient DOM queries
- Memory leaks in extraction

**Solutions:**
- Add pagination for large threads
- Optimize selector queries
- Implement extraction timeouts
- Profile with Chrome DevTools Performance tab

### Settings Not Persisting

**Symptoms:** Format preferences reset on reload

**Debug:**
- Check `chrome.storage.local` in DevTools
- Verify storage permissions in manifest
- Check for storage API errors in console

### Build/Validation Failures

**Common Issues:**
- ESLint errors — run `npm run lint:fix`
- Missing required files — check file structure
- Manifest validation — verify JSON syntax
- Unit tests failing — check test logic

## Performance Optimization

### DOM Query Optimization

```javascript
// ✅ Good: Cache element references
function extractTweet(tweetEl) {
  const textEl = qs(tweetEl, SELECTORS.tweetText);
  const userEl = qs(tweetEl, SELECTORS.userName);
  // Use cached references
}

// ❌ Bad: Repeated queries
function extractTweet(tweetEl) {
  const text = qs(tweetEl, SELECTORS.tweetText).textContent;
  const user = qs(tweetEl, SELECTORS.userName).textContent;
}
```

### Memory Management

- Avoid storing large DOM element references
- Clean up event listeners
- Use efficient data structures

### Extraction Timeouts

```javascript
function extractWithTimeout(tweetEls, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({ error: 'Extraction timeout' });
    }, timeoutMs);

    // Perform extraction
    const result = extractTweets(tweetEls);
    clearTimeout(timeout);
    resolve(result);
  });
}
```

## Security Considerations

### Content Script Isolation

- Content scripts run in isolated world
- No direct access to page JavaScript
- Safe DOM reading only

### Data Handling

- Never send data to external servers
- All processing local to browser
- User clipboard data stays under user control

### Permission Minimalism

Current permissions are minimal and necessary:
- `activeTab`: DOM access to current tab
- `scripting`: Content script injection
- `clipboardWrite`: Copy results to clipboard
- `storage`: User preference persistence

## Deployment

### Chrome Web Store

**Preparation:**
1. Update version in manifest.json
2. Run full test suite
3. Create release build (zip)
4. Submit via Chrome Developer Dashboard

**Requirements:**
- Valid manifest.json
- All assets included
- Privacy policy
- Screenshots

### GitHub Releases

**Automated via CI:**
- Tag with `v1.2.3` format
- GitHub Actions creates release
- Uploads extension zip
- Updates CHANGELOG

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for detailed contribution guidelines.

## Support

- **Issues**: GitHub Issues with bug report template
- **Discussions**: GitHub Discussions for questions
- **Documentation**: Inline code comments and this guide

---

Built by **AdLab** · Designed with love for developers