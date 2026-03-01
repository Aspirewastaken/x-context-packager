# Changelog

All notable changes to X Context Packager will be documented in this file.

## [1.0.0] — 2026-03-01

### Added
- **Post page extraction:** main tweet + all visible replies with full metadata
- **Profile page extraction:** profile header + visible timeline posts
- **40+ fields per tweet:** author, text, timestamps, links, images, engagement, threading, content flags
- **Aggregated indexes:** hashtag frequency, @mention frequency, domain link frequency
- **Conversation summary:** reply sort mode, OP reply count, unique authors, max depth, most liked reply
- **Three output formats:** Structured XML (default), Markdown, Plain Text
- **Intelligent Markdown formatting:** auto-selects structure (academic, Q&A, chat, technical, narrative) based on content analysis
- **Token estimation** with color-coded size indicators (green/yellow/orange/red)
- **One-button UI** — click Package, auto-copied to clipboard
- **Power user gear panel** — format switching, option toggles, stats detail, preview
- **Settings persistence** via `chrome.storage.local`
- **AdLab cinematic dark theme** — premium design matching X.com aesthetic
- **Centralized selector registry** — all DOM selectors in one `SELECTORS` object

### Resilience System
- **47 fallback strategies** across 12 selector types for DOM resilience
- **Three-tier resolution:** primary selectors → pre-defined fallbacks → self-healing detection
- **Self-healing DOM detector:** dynamically analyzes DOM structure when all pre-defined selectors fail, generating candidate selectors using 5 strategies (testid matching, ARIA patterns, role-based, semantic HTML, content matching)
- **Selector health monitoring:** tracks success/failure rates per selector with rolling confidence scores
- **Extraction quality telemetry:** per-tweet quality scoring measuring author completeness, text presence, timestamps, engagement, and media detection
- **Health status UI:** visual indicator in gear panel showing system health (green/yellow/red)

### Documentation
- Complete README with installation and usage guide
- `DESIGN_PHILOSOPHY.md` — UX principles and human-centered design
- `IMPLEMENTATION_PLAN.md` — full technical specification
- `docs/ARCHITECTURE.md` — deep system architecture for agent consumption
- `docs/OUTPUT_SCHEMA.md` — output format specification
- `docs/DEVELOPER_GUIDE.md` — development workflow and patterns
- `docs/TROUBLESHOOTING.md` — debug procedures and common fixes
- `docs/LEGAL_POSITION.md` — TOS analysis and Grok recommendation
- `CONTRIBUTING.md` — contribution guidelines
- `PRIVACY.md` — privacy policy (zero data collection)
- `SECURITY.md` — security policy and vulnerability reporting
- `ROADMAP.md` — feature roadmap and vision
- `CODE_OF_CONDUCT.md` — Contributor Covenant 2.0

### Infrastructure
- GitHub Actions CI pipeline (lint, test, validate, manifest check, file structure)
- GitHub Actions release pipeline (build zip, create release on version tags)
- Issue templates (bug report, feature request, selector update)
- Pull request template
- Funding configuration (GitHub Sponsors, Ko-fi)
- ESLint configuration with Chrome extension globals
- Jest test suite for utility function validation
- Validation script for manifest, selectors, file structure, code quality

### Technical
- Chrome Manifest V3
- Zero external dependencies (runtime)
- Zero network requests
- On-demand content script injection via `chrome.scripting.executeScript`
- Single-file extraction engine (MV3 content script limitation)
- Programmatically generated extension icons (16, 32, 48, 128px)
