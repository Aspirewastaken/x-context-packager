# Contributing to X Context Packager

Thank you for your interest in contributing! This is AdLab's first open source project and we welcome contributions of all kinds.

## Before You Start

Please read `DESIGN_PHILOSOPHY.md` first. It explains the core principles that guide every decision in this project:

- **The Four Beats** — See. Click. Done. Paste. Don't add a fifth beat.
- **Default to Invisible** — New features should be hidden behind the ⚙️ gear icon unless they're essential to the core flow.
- **The Love Test** — Would a neurodivergent person at 1am freeze when encountering this? If yes, simplify.

## How to Contribute

### Reporting Bugs

1. Open an issue using the [bug report template](.github/ISSUE_TEMPLATE.md)
2. Include the X.com URL where the issue occurs
3. Describe what you expected vs. what happened
4. Include your Chrome and extension version

### Selector Updates (Most Common Contribution)

X.com changes their DOM frequently. When selectors break:

1. Open DevTools on X.com (`F12`)
2. Inspect the element that's no longer being captured
3. Find the current `data-testid` or relevant selector
4. Update the `SELECTORS` object at the top of `content/content.js`
5. Test on a few different X.com pages
6. Submit a PR with the updated selector

**All selectors live in one place** — the `SELECTORS` object in `content/content.js`. This is intentional. Never hardcode selector strings elsewhere in the code.

### Adding Features

1. Check if the feature aligns with `DESIGN_PHILOSOPHY.md`
2. Open an issue to discuss before building
3. Keep the zero-dependency constraint — no npm packages, no build steps, no frameworks
4. If it's a UI feature, it should be behind the gear icon by default
5. Test on post pages AND profile pages

### Code Style

- Vanilla JavaScript only — no TypeScript, no JSX, no frameworks
- All extraction logic in `content/content.js` (single file — MV3 limitation)
- Every field extraction wrapped in try/catch (never crash on DOM changes)
- Missing fields = `null`, never fabricated data
- Comments for non-obvious logic, especially selector choices

## Development Setup

1. Clone the repo
2. Open `chrome://extensions`
3. Enable Developer Mode
4. Click "Load unpacked" → select repo folder
5. Navigate to X.com and test

No build step. No dependency installation. That's the whole setup.

## Pull Request Guidelines

- One logical change per PR
- Test on at least 2-3 different X.com pages (post with replies, profile page)
- Update `CHANGELOG.md` with your change
- Don't break the four beats

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
