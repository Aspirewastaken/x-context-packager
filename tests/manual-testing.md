# Manual Testing Guide — X Context Packager

This guide covers comprehensive manual testing procedures for X Context Packager. Since this extension reads live DOM from X.com, automated testing is limited and manual testing is essential.

## Prerequisites

- **Chrome browser** (latest stable version)
- **Extension loaded** via `chrome://extensions` → Load unpacked
- **X.com account** (optional but recommended for full testing)
- **Multiple test URLs** covering different scenarios

## Test Environment Setup

### 1. Fresh Browser Profile (Recommended)

```bash
# Create a new Chrome profile for testing
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --user-data-dir=/tmp/chrome-test-profile \
  --no-first-run \
  --disable-default-apps
```

### 2. Extension Installation

1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `x-context-packager` folder
5. Verify extension appears in toolbar

### 3. Test Data Preparation

Collect these X.com URLs for testing:

#### Required Test Pages
- **Post with replies**: `https://x.com/username/status/1234567890` (with 5+ replies)
- **Long thread**: Post with 50+ replies (scroll down to load more)
- **Profile page**: `https://x.com/username` (with recent posts)
- **Post with media**: Tweet containing images, videos, or links
- **Quoted tweet**: Post that quotes another tweet

#### Edge Cases
- **No replies**: Post with zero replies
- **Protected account**: Post from account with protected tweets (if accessible)
- **Deleted tweet**: URL to deleted/non-existent tweet
- **Non-X.com page**: Any other website

## Core Functionality Tests

### Test Case 1: Basic Post Extraction ✅

**Objective:** Verify basic extraction works on a standard post with replies.

**Steps:**
1. Navigate to post URL with replies
2. Click extension icon
3. Click "📦 Package"
4. Verify:
   - Button shows "✅ Copied"
   - Token indicator appears (green/yellow/orange/red)
   - Clipboard contains structured XML

**Expected Results:**
- Extraction completes in <3 seconds
- Output contains `<x_context>`, `<main_post>`, `<replies>` tags
- Main post includes author, text, timestamp, engagement counts
- All visible replies are captured

**Pass Criteria:**
- ✅ Structured output in clipboard
- ✅ No JavaScript errors in console
- ✅ Token count reasonable (~200-500 tokens for typical post)

---

### Test Case 2: Format Switching ✅

**Objective:** Verify all output formats work and auto-copy on format change.

**Steps:**
1. Complete Test Case 1
2. Click ⚙️ gear icon to expand panel
3. Click format buttons: "MD" then "Text"
4. Verify clipboard updates for each format

**Expected Results:**
- **Structured**: XML with semantic tags
- **MD**: Markdown with headers and formatting
- **Text**: Plain text with simple separators

**Pass Criteria:**
- ✅ All three formats generate valid output
- ✅ Clipboard updates immediately on format switch
- ✅ No re-extraction occurs (uses cached data)

---

### Test Case 3: Profile Page Extraction ✅

**Objective:** Verify profile page extraction captures bio and timeline posts.

**Steps:**
1. Navigate to `https://x.com/username`
2. Click extension icon
3. Click "📦 Package"

**Expected Results:**
- Output contains `<profile>` section with bio, stats, location
- `<posts>` section with recent timeline posts
- Profile-specific metadata (following/followers counts if available)

**Pass Criteria:**
- ✅ Profile header data extracted
- ✅ Multiple timeline posts captured
- ✅ Output format matches profile schema

---

### Test Case 4: Long Thread Handling ✅

**Objective:** Verify handling of threads longer than DOM virtualization limit.

**Steps:**
1. Find post with 50+ replies
2. Scroll down to load more replies (X.com loads ~10-15 at a time)
3. Click extension icon → "📦 Package"
4. Check token indicator
5. Scroll further, click "📦 Package Again"

**Expected Results:**
- Initial extraction captures currently loaded replies
- Token indicator shows appropriate color/size warning
- "Package Again" captures additional replies
- Output includes page numbers in metadata

**Pass Criteria:**
- ✅ Extraction works with any number of replies
- ✅ Token warnings appear for large contexts
- ✅ "Package Again" appends to previous extraction

---

### Test Case 5: Error Handling ✅

**Objective:** Verify graceful handling of errors and edge cases.

**Test Scenarios:**

**Non-X.com Page:**
1. Navigate to `github.com`
2. Click extension icon
3. Should show "Navigate to X.com to package a thread"

**Deleted/Invalid Post:**
1. Navigate to invalid X.com URL
2. Click extension icon
3. Should handle gracefully (show error or empty state)

**Network Issues:**
1. Go offline (DevTools → Network → Offline)
2. Try extraction
3. Should work (no network requests made)

**Pass Criteria:**
- ✅ No crashes or JavaScript errors
- ✅ Clear error messages for invalid states
- ✅ Graceful degradation when data unavailable

---

### Test Case 6: Settings Persistence ✅

**Objective:** Verify user preferences are saved and restored.

**Steps:**
1. Open gear panel
2. Toggle options (engagement, images, timestamps)
3. Change format to Markdown
4. Close popup, reopen extension
5. Verify settings persist

**Expected Results:**
- All toggles maintain state
- Default format selection persists
- Settings survive browser restart

**Pass Criteria:**
- ✅ `chrome.storage.local` contains expected values
- ✅ Settings restore on popup reopen
- ✅ Settings persist across browser sessions

---

### Test Case 7: Content Types ✅

**Objective:** Verify extraction of various content types.

**Test each content type:**

- **Images**: Post with images → verify `pbs.twimg.com` URLs extracted
- **Videos**: Post with video → verify video indicator present
- **Links**: Post with links → verify URLs and display text captured
- **Polls**: Post with poll → verify question and options extracted
- **Quoted tweets**: Post quoting another → verify recursive extraction
- **Community notes**: Post with community note → verify note content captured

**Pass Criteria:**
- ✅ All content types appear in structured output
- ✅ URLs are direct (not t.co shortened where possible)
- ✅ Missing content doesn't break extraction

---

### Test Case 8: Accessibility ✅

**Objective:** Verify extension is usable by assistive technologies.

**Steps:**
1. Enable ChromeVox (screen reader)
2. Navigate to X.com post
3. Use keyboard navigation (Tab) through extension popup
4. Verify screen reader announces button states and content

**Expected Results:**
- All interactive elements keyboard accessible
- Screen reader announces button text and state changes
- Color contrast meets WCAG guidelines
- Focus indicators visible

**Pass Criteria:**
- ✅ Keyboard-only navigation works
- ✅ Screen reader compatibility
- ✅ High contrast support

## Performance Tests

### Test Case 9: Performance Benchmarks ✅

**Objective:** Verify extraction performance meets requirements.

**Metrics to measure:**
- **Cold start**: First extraction after page load
- **Warm extraction**: Subsequent extractions on same page
- **Large thread**: Thread with 100+ tweets
- **Memory usage**: Monitor Chrome Task Manager

**Performance Targets:**
- Cold start: <3 seconds
- Warm extraction: <1 second
- Large thread: <5 seconds
- Memory: <50MB increase during extraction

**Pass Criteria:**
- ✅ Performance within targets
- ✅ No memory leaks
- ✅ UI remains responsive during extraction

## Browser Compatibility Tests

### Test Case 10: Cross-Browser Testing ✅

**Objective:** Verify extension works across different browsers.

**Browsers to test:**
- ✅ Chrome (primary target)
- ✅ Firefox (if MV3 support available)
- ✅ Edge (Chromium-based)

**Note:** Firefox Manifest V3 support is limited. Document compatibility status.

## Regression Tests

### Test Case 11: Selector Updates ✅

**Objective:** Verify selectors still work after X.com DOM changes.

**Steps:**
1. Open DevTools on X.com post page
2. Inspect key elements:
   - Tweet text (`[data-testid="tweetText"]`)
   - User name (`[data-testid="User-Name"]`)
   - Engagement counts
   - Reply threads
3. Verify selectors in `SELECTORS` object match current DOM
4. Update selectors if needed

**Pass Criteria:**
- ✅ All selectors target correct elements
- ✅ Extraction works on current X.com DOM
- ✅ No console errors about missing elements

## Automated Test Integration

While most testing is manual, some validation can be automated:

### Validation Tests (Run via `npm run validate`)

- ✅ Manifest.json syntax validation
- ✅ Required files present
- ✅ Selector object structure
- ✅ No hardcoded selectors outside SELECTORS
- ✅ Code style consistency

## Test Result Reporting

### Test Run Template

```markdown
## Test Run: [Date] - [Tester Name]

### Environment
- **Browser:** Chrome 120.0.6099.109
- **Extension:** v1.0.0
- **OS:** macOS 14.0

### Results Summary
- ✅ Passed: 8/11 tests
- ⚠️  Warnings: 2/11 tests
- ❌ Failed: 1/11 tests

### Detailed Results

#### ✅ Test Case 1: Basic Post Extraction
- Status: PASS
- Notes: Extraction completed in 1.2s, 342 tokens

#### ⚠️  Test Case 4: Long Thread Handling
- Status: WARNING
- Notes: Token indicator showed red for 45K tokens, but extraction worked

#### ❌ Test Case 8: Accessibility
- Status: FAIL
- Notes: Missing focus indicators on format buttons
- Bug: #123

### Known Issues
- Issue #123: Focus indicators missing
- Issue #124: Firefox compatibility limited

### Recommendations
- Fix accessibility issues before release
- Add Firefox-specific documentation
```

## Continuous Testing

### Daily Regression Tests
- Run Test Cases 1, 2, 3 daily during development
- Monitor for X.com DOM changes weekly

### Release Testing
- Full test suite before any release
- Test on clean browser profile
- Verify against multiple X.com accounts/types

## Troubleshooting Test Failures

### Common Issues

**"Extension not loading":**
- Verify manifest.json syntax
- Check Chrome developer mode enabled
- Try reloading extension

**"No output in clipboard":**
- Check browser clipboard permissions
- Verify on valid X.com page
- Check console for JavaScript errors

**"Selectors broken":**
- X.com DOM changed — update SELECTORS object
- Use DevTools to find new selectors
- Test on multiple page types

---

**Last Updated:** 2026-03-01
**Test Coverage:** 11 core test cases covering all major functionality