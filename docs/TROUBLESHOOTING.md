# Troubleshooting Guide — X Context Packager

This guide helps you diagnose and fix common issues with X Context Packager.

## Quick Diagnosis

### Extension Won't Load

**Symptoms:**
- Extension icon not visible in toolbar
- Extension not listed in `chrome://extensions`

**Quick Checks:**
1. Open `chrome://extensions`
2. Verify "Developer mode" is enabled (top right)
3. Check if extension shows "Errors" badge
4. Click extension → View error details

**Common Solutions:**
- Reload extension (click refresh icon)
- Remove and re-add extension
- Check manifest.json for syntax errors

---

### No Output When Clicking Package

**Symptoms:**
- Button stays as "📦 Package" (doesn't change to "✅ Copied")
- No content in clipboard
- Console shows JavaScript errors

**Diagnosis Steps:**

1. **Check Console Errors**
   - Open DevTools on X.com tab (`F12`)
   - Look for red error messages
   - Check popup console (inspect popup window)

2. **Verify Page Type**
   - Must be on `x.com/username/status/id` (post page)
   - Or `x.com/username` (profile page)
   - Not on `x.com/explore`, `x.com/search`, etc.

3. **Test on Simple Page**
   - Try a basic post with 1-2 replies
   - Avoid very long threads initially

---

### Incomplete or Wrong Data

**Symptoms:**
- Missing tweet text, usernames, or engagement counts
- Wrong thread structure or reply nesting
- Extracted data doesn't match what's visible

**Likely Cause:** X.com DOM changes (happens frequently)

**Fix Process:**

1. **Open DevTools** (`F12` on X.com page)

2. **Inspect Broken Element**
   - Right-click element → "Inspect"
   - Find the `data-testid` attribute
   - Note the current selector

3. **Update SELECTORS Object**
   - Open `content/content.js`
   - Find the `SELECTORS` object (around line 23)
   - Update the relevant selector

4. **Test the Fix**
   - Reload extension in `chrome://extensions`
   - Test on the same page
   - Verify extraction works

**Example Fix:**
```javascript
// Old (broken)
tweetText: '[data-testid="tweetText"]',

// New (working)
tweetText: '[data-testid="Tweet-User-Text"]',
```

---

## Specific Issues

### "Navigate to X.com to package a thread"

**Cause:** Extension not on supported X.com page

**Supported URLs:**
- ✅ `https://x.com/username/status/123456` (post pages)
- ✅ `https://x.com/username` (profile pages)
- ❌ `https://x.com/explore` (explore page)
- ❌ `https://x.com/search` (search results)
- ❌ `https://x.com/messages` (DMs)
- ❌ `https://google.com` (non-X.com sites)

**Solution:** Navigate to a post with replies or user profile page.

---

### Extraction Takes Too Long

**Symptoms:** Button shows "📦 Packaging..." for >10 seconds

**Causes:**
- Very long thread (100+ replies)
- Slow network/page loading
- Browser performance issues

**Solutions:**
1. **Use Max Replies setting:**
   - Click ⚙️ gear icon
   - Set "Max replies" to 50 or 100
   - Click "📦 Package Again"

2. **Scroll to load more content:**
   - X.com virtualizes scrolling
   - Scroll down to load all replies before extracting
   - Then click Package

3. **Check token indicator:**
   - Orange/red indicators suggest very large context
   - Consider breaking into smaller extractions

---

### Settings Don't Save

**Symptoms:** Format preferences reset after browser restart

**Cause:** Chrome storage permission issue

**Fix:**
1. Open `chrome://extensions`
2. Find X Context Packager
3. Click "Details"
4. Verify "Storage" permission is granted
5. Reload extension

---

### Console Shows Errors

**Common Errors:**

**"Cannot read property 'querySelector' of null"**
- DOM element not found
- Selector needs updating (see above)

**"Extension context invalidated"**
- Extension was reloaded during execution
- Wait for page to fully load, then try again

**"Unchecked runtime.lastError"**
- Permission issue
- Verify all required permissions granted

**"Failed to execute 'writeText' on 'Clipboard'"**
- Clipboard permission denied
- Grant clipboard permissions in browser settings

---

### Wrong Thread Structure

**Symptoms:** Replies show wrong nesting or reply-to relationships

**Cause:** Thread detection logic broken by DOM changes

**Debug:**
1. Open DevTools → Console
2. Run: `$$('[data-testid="tweet"]')` to see tweet elements
3. Check DOM structure around reply threads
4. Look for changes in thread indicators

**Fix:** Update thread detection selectors in `SELECTORS` object

---

### Missing Engagement Counts

**Symptoms:** Likes, retweets, replies show as null or wrong numbers

**Cause:** Engagement button selectors changed

**Debug:**
1. Inspect engagement buttons in DevTools
2. Check `aria-label` attributes
3. Update `engagement` parsing logic if needed

---

### Images/Links Not Extracted

**Symptoms:** No image URLs or links in output

**Cause:** Media/link selectors outdated

**Debug:**
1. Check if images are visible on page
2. Inspect image elements for `src` attributes
3. Verify link elements exist

---

## Advanced Debugging

### Content Script Debugging

1. **Open X.com page**
2. **Open DevTools** (`F12`)
3. **Switch to Console tab**
4. **Trigger extraction** by clicking extension
5. **Look for console output** from content script

### Adding Debug Logging

Temporarily add console logs to debug:

```javascript
// In content/content.js
console.log('Debug: Starting extraction');
console.log('Debug: Found tweets:', tweetElements.length);

// In popup/popup.js
console.log('Debug: Injection result:', result);
```

### Testing Selector Changes

In DevTools console, test selectors before updating code:

```javascript
// Test tweet selector
$$('[data-testid="tweet"]')

// Test specific element
document.querySelector('[data-testid="tweetText"]')

// Test engagement parsing
document.querySelector('[data-testid="reply"]').getAttribute('aria-label')
```

---

## Browser-Specific Issues

### Chrome Issues

**Extension disabled automatically:**
- Chrome may disable extensions with errors
- Check `chrome://extensions` for error details
- Fix errors and re-enable

**Incognito mode:**
- Extension needs to be enabled for incognito
- `chrome://extensions` → Allow in incognito

### Firefox Compatibility

**Note:** Firefox Manifest V3 support is limited
- Extension may not work in Firefox
- Use Chrome for development and testing

---

## Performance Issues

### High Memory Usage

**Symptoms:** Browser becomes slow or unresponsive

**Causes:**
- Large thread extraction
- Memory leaks in content script

**Solutions:**
1. Limit max replies in settings
2. Extract in smaller batches
3. Close/reopen browser tab

### Slow Extraction

**Optimization Tips:**
1. Use specific selectors (avoid `*` wildcards)
2. Cache DOM element references
3. Process tweets in batches
4. Add extraction timeouts

---

## Getting Help

### Before Reporting Issues

1. **Try the latest version** — check for updates
2. **Test on clean browser** — disable other extensions
3. **Follow troubleshooting steps** above
4. **Collect debug information:**
   - Browser version
   - Extension version
   - X.com URL where issue occurs
   - Console error messages
   - Expected vs actual behavior

### Reporting Bugs

Use the [bug report template](https://github.com/Aspirewastaken/x-context-packager/issues/new?template=bug_report.md) with:
- Detailed reproduction steps
- Environment information
- Screenshots if relevant
- Console output

### Community Support

- **GitHub Issues:** For bugs and feature requests
- **GitHub Discussions:** For questions and help
- **Documentation:** Check this guide and inline code comments

---

## Prevention

### Regular Maintenance

- **Monitor for X.com changes** weekly
- **Update selectors** promptly when broken
- **Test on multiple page types** regularly
- **Keep dependencies updated** (though none currently)

### Best Practices

- **Test before committing** changes
- **Use defensive programming** patterns
- **Document selector changes** in commit messages
- **Update tests** when changing extraction logic

---

**Last Updated:** 2026-03-01
**Extension Version:** 1.0.0

Built by **AdLab** · Love for users drives our debugging ❤️