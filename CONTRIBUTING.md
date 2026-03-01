# Contributing to X Context Packager

Thank you for your interest in contributing! This is AdLab's first open source project and we welcome contributions of all kinds.

## Code of Conduct

This project follows a [code of conduct](CODE_OF_CONDUCT.md) to ensure a welcoming environment for all contributors.

## Before You Start

Please read these foundational documents in order:

1. **[`DESIGN_PHILOSOPHY.md`](DESIGN_PHILOSOPHY.md)** — **Required reading.** The soul of the project. Understand the human-centered principles.
2. **[`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md)** — Full technical specification and architecture.
3. **[`docs/OUTPUT_SCHEMA.md`](docs/OUTPUT_SCHEMA.md)** — Exact output format specifications.

Key principles that guide every decision:
- **The Four Beats** — See thread → Click icon → It says done → Paste. Don't add a fifth beat.
- **Default to Invisible** — New features hidden behind ⚙️ gear icon unless essential to core flow.
- **The Love Test** — Would a neurodivergent person at 1am freeze? If yes, simplify.
- **Zero Dependencies** — Vanilla JS only, no build step, no npm packages.

## Development Setup

### Prerequisites

- **Chrome browser** (latest stable version)
- **Git** for version control
- **Basic JavaScript knowledge**

### Quick Start

```bash
# Clone the repository
git clone https://github.com/Aspirewastaken/x-context-packager.git
cd x-context-packager

# Load in Chrome
# 1. Open chrome://extensions
# 2. Enable "Developer mode" (top right)
# 3. Click "Load unpacked"
# 4. Select the x-context-packager folder

# Test the extension
# 1. Navigate to any X.com post with replies
# 2. Click the extension icon in toolbar
# 3. Click "📦 Package" and verify clipboard contains structured output
```

**No build step. No dependency installation. No npm. No webpack. Just load and go.**

### Development Workflow

1. **Fork** the repository on GitHub
2. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-description
   ```
3. **Make your changes** following the guidelines below
4. **Test thoroughly** on multiple X.com pages
5. **Update documentation** if needed (README, CHANGELOG, etc.)
6. **Commit** with clear, descriptive messages:
   ```bash
   git commit -m "feat: add support for new tweet field

   - Extract field X from DOM element Y
   - Include in all output formats
   - Handle missing field gracefully"
   ```
7. **Push** your branch and **create a pull request**

### Testing Requirements

Before submitting a PR, test on:
- ✅ **Post page with replies** (primary use case)
- ✅ **Profile page** (secondary use case)
- ✅ **Post page with no replies** (edge case)
- ✅ **Long thread** (scrolling/virtualization test)
- ✅ **Different account types** (verified, unverified, organizations)

## How to Contribute

### 🐛 Reporting Bugs

1. **Use the bug report template** when [opening an issue](https://github.com/Aspirewastaken/x-context-packager/issues/new?template=bug_report.md)
2. **Include the X.com URL** where the issue occurs
3. **Describe expected vs. actual behavior**
4. **Include browser and extension version**

### 🔧 Selector Updates (Most Common Contribution)

X.com changes their DOM frequently. When selectors break:

1. **Open DevTools** on X.com (`F12` → Elements tab)
2. **Inspect the broken element** (tweet text, engagement count, etc.)
3. **Find the new selector** using `data-testid` attributes or CSS selectors
4. **Update the `SELECTORS` object** at the top of `content/content.js`
5. **Test on multiple pages** to ensure robustness
6. **Submit a PR** with the updated selector

**Critical:** All selectors are centralized in the `SELECTORS` object. Never hardcode selector strings elsewhere.

### ✨ Adding Features

1. **Check alignment** with `DESIGN_PHILOSOPHY.md` — does this serve the four beats?
2. **Open an issue first** to discuss the feature (prevents wasted effort)
3. **Follow constraints:**
   - Zero external dependencies
   - No build step required
   - UI features behind gear icon by default
   - Works on both post and profile pages
4. **Implement defensively** — wrap extractions in try/catch, handle missing data gracefully

### 🎨 UI/UX Changes

- **Read `DESIGN_PHILOSOPHY.md`** thoroughly before touching UI
- **Test accessibility** — keyboard navigation, screen readers, high contrast
- **Match X.com aesthetic** — dark theme, system fonts, subtle animations
- **Default to invisible** — power features behind ⚙️ gear icon

## Code Guidelines

### JavaScript Style

```javascript
// ✅ Good: Clear, defensive, well-commented
function extractTweetText(tweetElement) {
  try {
    const textElement = tweetElement.querySelector(SELECTORS.tweetText);
    if (!textElement) return null;

    // Preserve line breaks and emoji in tweet text
    return textElement.innerText?.trim() || textElement.textContent?.trim() || null;
  } catch (error) {
    console.warn('Failed to extract tweet text:', error);
    return null;
  }
}

// ❌ Bad: No error handling, unclear logic
function getText(el) {
  return el.querySelector('.tweet-text').innerText;
}
```

### Key Principles

- **Vanilla JavaScript only** — no TypeScript, no JSX, no frameworks
- **Defensive programming** — every DOM query wrapped in try/catch
- **Null over fabrication** — missing fields = `null`, never made-up data
- **Single extraction file** — all logic in `content/content.js` (MV3 limitation)
- **Clear comments** — especially for selector choices and edge cases
- **Consistent naming** — camelCase for variables, UPPER_CASE for constants

### File Structure

```
x-context-packager/
├── manifest.json              # Extension manifest
├── popup/                     # Extension popup UI
│   ├── popup.html            # HTML structure
│   ├── popup.css             # Styling (AdLab dark theme)
│   └── popup.js              # State management
├── content/                   # Extraction engine
│   └── content.js            # DOM reading logic
├── icons/                     # Extension icons
├── docs/                      # Documentation
└── tests/                     # Testing framework
```

## Pull Request Process

### PR Guidelines

- **One logical change per PR** — keep PRs focused and reviewable
- **Descriptive title** — "feat: add poll extraction" not "update content.js"
- **Clear description** — what, why, and how
- **Link related issues** — reference #123 for fixes
- **Update CHANGELOG.md** — add your change under "Unreleased"

### Code Review Process

1. **Automated checks** run first (linting, validation)
2. **Maintainer review** — focus on adherence to design philosophy
3. **Testing verification** — reviewer tests on X.com
4. **Merge** when approved

### Commit Message Format

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation
- `style:` — formatting, no logic change
- `refactor:` — code restructure
- `test:` — testing
- `chore:` — maintenance

**Examples:**
```
feat: add community note extraction
fix(selectors): update tweet text selector for X.com changes
docs: add troubleshooting section to README
```

## Release Process

### Versioning

Follows [Semantic Versioning](https://semver.org/):
- **MAJOR** — breaking changes
- **MINOR** — new features
- **PATCH** — bug fixes

### Release Steps

1. **Update version** in `manifest.json` and `content/content.js`
2. **Update CHANGELOG.md** with release notes
3. **Create git tag** and push to GitHub
4. **GitHub Actions** creates release automatically
5. **Chrome Web Store** submission (manual)

## Getting Help

- **Documentation** — check `docs/` folder and inline code comments
- **Issues** — search existing issues before opening new ones
- **Discussions** — use GitHub Discussions for questions
- **Design Philosophy** — re-read when stuck on decisions

## Recognition

Contributors are recognized in:
- CHANGELOG.md release notes
- GitHub contributor insights
- Special mentions in README

Thank you for contributing to X Context Packager! 🎉

---

Built by **AdLab** · Designed with love for the human being
