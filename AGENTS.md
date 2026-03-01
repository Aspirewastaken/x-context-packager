## X Context Packager — Development Instructions

### Read Order (MANDATORY)

1. **`DESIGN_PHILOSOPHY.md`** — Read FIRST. Ground yourself before building. This is the soul of the project.
2. **`docs/ARCHITECTURE.md`** — System invariants, component architecture, data flow, and the resilience system. Read this before modifying any extraction or formatting code.
3. **`IMPLEMENTATION_PLAN.md`** — Full technical spec. Every extraction field, every selector, every output format.
4. **This file** — Dev environment, build instructions, and the operating principles below.

---

### What This System Is

A Chrome extension that packages X.com page context into structured, LLM-optimized text. One click. Zero network requests. Zero dependencies. Runs entirely in the user's browser.

The system has three core properties:
- **Truthful:** If data isn't in the DOM, it's `null`. Never fabricated.
- **Resilient:** 47 fallback strategies across 12 selector types. Self-healing DOM detection.
- **Invisible:** 2600+ lines of extraction logic behind one button. The user sees: click → done → paste.

### Tech Stack

- Chrome Extension, Manifest V3
- Vanilla JavaScript — no frameworks, no dependencies, no build step
- All code is auditable, transparent, and runs entirely locally in the user's browser

### Development

- **No package manager needed for the extension** — zero runtime dependencies
- **Dev dependencies** (Jest, ESLint) are in `package.json` for CI and local validation
- Load the extension via `chrome://extensions` → Enable Developer Mode → Load unpacked → select repo root
- All DOM selectors centralized in `content/content.js` (the `SELECTORS` object at the top)
- Content script injected on-demand via `chrome.scripting.executeScript` from popup (not always-on)
- User preferences persisted via `chrome.storage.local`

### Testing

- **Automated tests:** `npm test` runs Jest unit tests for utility logic (parsing, classification, page detection)
- **Linting:** `npm run lint` runs ESLint against all JS files
- **Validation:** `npm run validate` checks manifest, file structure, selectors, code quality, and documentation
- **Manual testing:** Chrome extension testing against live X.com DOM — test by navigating to X.com post pages and profile pages, then clicking the extension icon
- Verify extraction output in clipboard matches expected structured format
- Verify manifest loads without errors in `chrome://extensions`
- Check: no network-request API usage exists in `content/content.js`

### Key Architecture Decisions

Read `docs/ARCHITECTURE.md` for the full picture. Quick reference:

- **MV3 content scripts cannot use ES module imports** without a bundler — all extraction logic lives in a single `content/content.js` file with clearly commented sections
- **`chrome.scripting.executeScript`** from popup.js for on-demand injection (not always-on content script)
- **`chrome.storage.local`** for persisting user preferences (format choice, toggle states, gear panel state)
- **Permissions:** `activeTab`, `scripting`, `clipboardWrite`, `storage`
- **Single canonical JSON payload** → three formatter outputs (Structured XML, Markdown, Plain Text)
- **Format switching** re-renders from cached payload data — no re-extraction from DOM
- **Dual formatter architecture:** content.js generates initial formatted strings; popup.js has its own formatters for post-extraction format switching. Both must stay in sync.
- **Resilience system:** Three-tier selector resolution (primary → fallbacks → self-healing) with health monitoring and telemetry

### Non-Obvious Caveats

- X.com virtualizes scrolling — only ~10-15 tweets exist in the DOM at any given time
- Follower counts are only available if the hover card happens to be in the DOM (the extension never triggers hovers and never fakes data)
- Some selectors are fragile because X changes its DOM frequently — all selectors are centralized in the `SELECTORS` object for easy updates
- The `clipboardWrite` permission is needed for the auto-copy behavior on extraction complete
- The popup UI follows the "default to invisible" principle from `DESIGN_PHILOSOPHY.md` — one button by default, power features behind the gear icon
- `content.js` and `popup.js` both contain formatters — they must produce identical output for the same payload. The content.js formatters run on first extraction; the popup.js formatters run on subsequent format switches from cached data.
- The `resilientQuerySelectorAll` function always returns an array (never null, never a NodeList). The `resilientQuerySelectorSingle` function returns a single element or null.
- The `DOM_CHANGE_MONITOR` and `COMMUNITY_CONTRIBUTIONS` modules exist in content.js but are not auto-started. They are reserved for future activation.

### System Invariants (NEVER VIOLATE)

1. **Zero network requests** from content script. This is the legal and ethical foundation.
2. **Null over fabrication.** Missing data = `null`, never synthesized.
3. **Single-file content script.** All extraction in `content/content.js`. MV3 constraint.
4. **Selector centralization.** All selectors in the `SELECTORS` object.
5. **The Four Beats.** See → Click → Done → Paste. No added steps.
6. **Format independence.** Formatters are pure renderers of the payload. No shared state between formats.

### Common Modification Patterns

**Updating a broken selector:**
1. Find the broken element in X.com DevTools
2. Get the new `data-testid` or CSS selector
3. Update `SELECTORS` object in `content/content.js`
4. Optionally add fallbacks to `SELECTOR_FALLBACKS`
5. Test on post pages and profile pages

**Adding a new extraction field:**
See the detailed checklist in `docs/ARCHITECTURE.md` under "Adding a New Extraction Field."

**Adding a new output format:**
1. Create formatter function in both `content/content.js` and `popup/popup.js`
2. Add format button to `popup/popup.html`
3. Wire up in popup.js format switching logic
4. Update `IMPLEMENTATION_PLAN.md` and `docs/OUTPUT_SCHEMA.md`

### Project Structure

```
x-context-packager/
├── manifest.json              # Chrome MV3 manifest — permissions, icons, metadata
├── popup/
│   ├── popup.html             # One-button UI with gear panel
│   ├── popup.css              # AdLab cinematic dark theme (CSS custom properties)
│   └── popup.js               # State machine, format rendering, clipboard, preferences
├── content/
│   └── content.js             # DOM extraction engine — SELECTORS, resilience, formatters
├── icons/                     # Extension icons (16/32/48/128 PNG)
├── scripts/
│   ├── validate.js            # Pre-commit validation (manifest, structure, quality)
│   └── generate-icons.js      # Icon generation from canvas
├── tests/
│   ├── unit/
│   │   └── utils.test.js      # Jest tests for utility functions
│   ├── manual-testing.md      # Manual test scenarios
│   └── README.md              # Test documentation
├── docs/
│   ├── ARCHITECTURE.md        # Deep technical architecture (for agents)
│   ├── OUTPUT_SCHEMA.md       # Output format specification
│   ├── DEVELOPER_GUIDE.md     # Development workflow and patterns
│   ├── TROUBLESHOOTING.md     # Debug procedures and common fixes
│   └── LEGAL_POSITION.md      # TOS analysis and legal position
├── .github/
│   ├── workflows/
│   │   ├── ci.yml             # CI: lint, test, validate on push/PR
│   │   └── release.yml        # Release: build zip on version tag
│   ├── ISSUE_TEMPLATE/        # Bug report, feature request, selector update templates
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── FUNDING.yml
├── DESIGN_PHILOSOPHY.md       # UX soul — the most important document
├── IMPLEMENTATION_PLAN.md     # Complete technical specification
├── CONTRIBUTING.md            # Contribution guidelines
├── CHANGELOG.md               # Version history
├── CODE_OF_CONDUCT.md         # Contributor Covenant 2.0
├── SECURITY.md                # Security policy and vulnerability reporting
├── PRIVACY.md                 # Privacy policy (zero data collection)
├── ROADMAP.md                 # Feature roadmap and vision
├── LICENSE                    # MIT
└── AGENTS.md                  # This file — start here for development
```

## Cursor Cloud specific instructions

When testing as a cloud agent:
- The extension cannot be tested in a live Chrome browser within the cloud VM without significant setup. Focus on: running `npm run validate`, `npm run lint`, and `npm test` to verify code correctness.
- For UI verification, load the extension in a local Chrome browser.
- Do not attempt to mock the full Chrome extension API for manual testing.
