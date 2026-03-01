## X Context Packager — Development Instructions

### Read Order (MANDATORY)

1. **`DESIGN_PHILOSOPHY.md`** — Read FIRST. Ground yourself before building. This is the soul of the project.
2. **`IMPLEMENTATION_PLAN.md`** — Full technical spec. Every extraction field, every selector, every output format.
3. **This file** — Dev environment and build instructions below.

---

### Tech Stack

- Chrome Extension, Manifest V3
- Vanilla JavaScript — no frameworks, no dependencies, no build step
- All code is auditable, transparent, and runs entirely locally in the user's browser

### Development

- **No package manager needed** — zero dependencies to install
- Load the extension via `chrome://extensions` → Enable Developer Mode → Load unpacked → select repo root
- All DOM selectors centralized in `content/content.js` (the `SELECTORS` object at the top)
- Content script injected on-demand via `chrome.scripting.executeScript` from popup (not always-on)
- User preferences persisted via `chrome.storage.local`

### Testing

- No automated test framework — Chrome extension testing against live X.com DOM is manual
- Test by navigating to X.com post pages and profile pages, then clicking the extension icon
- Verify extraction output in clipboard matches expected structured format
- Verify manifest loads without errors in `chrome://extensions`
- Check: no network-request API usage exists in `content/content.js`

### Key Architecture Decisions

- **MV3 content scripts cannot use ES module imports** without a bundler — all extraction logic lives in a single `content/content.js` file with clearly commented sections
- **`chrome.scripting.executeScript`** from popup.js for on-demand injection (not always-on content script)
- **`chrome.storage.local`** for persisting user preferences (format choice, toggle states, gear panel state)
- **Permissions:** `activeTab`, `scripting`, `clipboardWrite`, `storage`
- **Single canonical JSON payload** → three formatter outputs (Structured XML, Markdown, Plain Text)
- **Format switching** re-renders from cached payload data — no re-extraction from DOM

### Non-Obvious Caveats

- X.com virtualizes scrolling — only ~10-15 tweets exist in the DOM at any given time
- Follower counts are only available if the hover card happens to be in the DOM (the extension never triggers hovers and never fakes data)
- Some selectors are fragile because X changes its DOM frequently — all selectors are centralized in the `SELECTORS` object for easy updates
- The `clipboardWrite` permission is needed for the auto-copy behavior on extraction complete
- The popup UI follows the "default to invisible" principle from `DESIGN_PHILOSOPHY.md` — one button by default, power features behind the gear icon
