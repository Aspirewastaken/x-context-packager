---
name: Selector Update
title: "[SELECTOR] "
labels: selector-update, maintenance
assignees: ''
---

## Selector Update Request

X.com frequently changes their DOM structure. This template is for reporting broken selectors that need updating.

**What element is no longer being captured?**
<!-- e.g., "tweet text", "engagement counts", "user handles", "reply threads" -->

**Current selector in SELECTORS object:**
```javascript
// From content/content.js line X
currentSelector: '[data-testid="old-selector"]'
```

**Proposed new selector:**
```javascript
// What you found in DevTools
newSelector: '[data-testid="new-selector"]'
```

**Test URLs:**
List 2-3 X.com URLs where you've verified the new selector works:
1. `https://x.com/...`
2. `https://x.com/...`
3. `https://x.com/...`

**DevTools Investigation:**
What did you find when inspecting the element?
- Current DOM structure:
- New attributes/classes:
- Parent element changes:

**Testing Done:**
- [ ] Verified new selector works on post pages
- [ ] Verified new selector works on profile pages
- [ ] Verified extraction still works after selector update
- [ ] No console errors with new selector

**Impact Assessment:**
Does this selector change affect:
- [ ] Post page extraction
- [ ] Profile page extraction
- [ ] Both post and profile pages

---

**Before submitting:**
- [ ] I have read the [Contributing Guide](CONTRIBUTING.md)
- [ ] I have tested the new selector on multiple page types
- [ ] I have verified extraction works with the proposed change