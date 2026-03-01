## Cursor Cloud specific instructions

This is the **X Context Packager** — a Chrome extension (Manifest V3) built with vanilla JS/CSS/HTML. Zero external dependencies, no build step, no framework.

### Project overview

One-click Chrome extension that packages full X.com page context (post pages + profile pages) into structured, LLM-optimized text. Captures tweets, replies, links, images, hashtags, thread depth, engagement metrics, and more. DOM-only — zero network requests.

### Development setup

- **No package manager needed.** No `npm install`, no build step. All code is vanilla JS.
- **Chrome** is pre-installed at `/usr/local/bin/google-chrome` for testing the extension.
- **Node.js** (v22) is available for any scripting needs (e.g., generating icon PNGs).
- **Python 3.12** is available if needed.

### How to test the extension

1. Load the extension in Chrome via `chrome://extensions` → Enable "Developer mode" → "Load unpacked" → select the repo root.
2. Navigate to any `x.com` or `twitter.com` post/profile page.
3. Click the extension icon in the toolbar to open the popup.
4. Click "Package Full Context" to extract and copy.

For headless validation, verify:
- `manifest.json` is valid JSON with `manifest_version: 3`
- No `fetch`, `XMLHttpRequest`, or network calls exist in content script code
- All DOM selectors are centralized in a single `SELECTORS` object

### Key architecture notes

- **Content script injection:** Uses `chrome.scripting.executeScript` from the popup (on-demand), not always-on content scripts. This means no `content_scripts` key in the manifest.
- **MV3 limitation:** Content scripts can't use ES module imports without a bundler. All extraction logic lives in a single `content/content.js` file.
- **Selector centralization:** All X.com `data-testid` selectors must be defined in one place so DOM changes only require one file update.
- **Format switching:** Extract once to a normalized JSON payload, then render into XML/Markdown/Plain Text via formatters. Switching formats should not re-scan the DOM.

### Lint / test / build

- **Lint:** No linter configured yet. If adding one, use ESLint with browser globals.
- **Test:** Manual testing in Chrome against live X.com pages. Optionally add Node-based smoke tests against static HTML fixtures.
- **Build:** None needed — load unpacked directly.
