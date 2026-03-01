# Changelog

All notable changes to X Context Packager will be documented in this file.

## [1.0.0] — 2026-03-01

### Added
- Initial release of X Context Packager
- **Post page extraction:** main tweet + all visible replies with full metadata
- **Profile page extraction:** profile header + visible timeline posts
- **40+ fields per tweet:** author, text, timestamps, links, images, engagement, threading, content flags
- **Aggregated indexes:** hashtag frequency, @mention frequency, domain link frequency
- **Conversation summary:** reply sort mode, OP reply count, unique authors, max depth, most liked reply
- **Three output formats:** Structured XML (default), Markdown, Plain Text
- **Token estimation** with color-coded size indicators (green/yellow/orange/red)
- **One-button UI** — click Package, auto-copied to clipboard
- **Power user gear panel** — format switching, option toggles, stats detail, preview
- **Settings persistence** via `chrome.storage.local`
- **AdLab cinematic dark theme** — premium design matching X.com aesthetic
- **Centralized selector registry** — all DOM selectors in one `SELECTORS` object
- Full documentation: README, DESIGN_PHILOSOPHY, IMPLEMENTATION_PLAN, OUTPUT_SCHEMA, LEGAL_POSITION
- MIT License

### Technical
- Chrome Manifest V3
- Zero external dependencies
- Zero network requests
- On-demand content script injection via `chrome.scripting.executeScript`
- Single-file extraction engine (MV3 content script limitation)
