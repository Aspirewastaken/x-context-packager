# Architecture — X Context Packager

## For Agents: Read This Before Modifying Any Code

This document describes the system's architecture, its invariants, and the reasoning behind every structural decision. It exists so that future agents — human or AI — can modify the system without breaking the symmetries that make it work.

---

## System Invariants

These are the properties that MUST be preserved across all modifications. Breaking any of these breaks the system.

### I1: Zero Network Requests
The content script (`content/content.js`) must never make HTTP requests, fetch calls, WebSocket connections, or any form of network communication. This is not a performance choice — it is the legal and ethical foundation of the project. The extension reads DOM state. If you need external data, the answer is: you don't include it.

### I2: Null Over Fabrication
If a data field cannot be extracted from the DOM, it MUST be `null`. Never default to `"0"`, `""`, `"unknown"`, or any synthesized value. LLMs reason better over explicit absence than over plausible-looking fabricated data. This invariant is discussed in `DESIGN_PHILOSOPHY.md` under "The Moral Dimension."

### I3: Single-File Content Script
All extraction logic lives in `content/content.js`. This is not a code quality preference — it is a Chrome Manifest V3 constraint. Content scripts injected via `chrome.scripting.executeScript` cannot use ES module imports without a bundler, and this project has zero build steps. If you need shared utilities, they must be defined within the IIFE in `content.js`.

### I4: Selector Centralization
Every CSS selector that touches the X.com DOM must be defined in the `SELECTORS` object at the top of `content/content.js`. Never hardcode selectors inline in extraction functions. X.com changes its DOM frequently; centralization means one update fixes all usages.

### I5: The Four Beats
The user experience is: See → Click → Done → Paste. Any UI change that adds a step between Click and Done, or requires a decision before Click, violates the core design. Read `DESIGN_PHILOSOPHY.md` before touching popup UI.

### I6: Format Independence
The three output formats (Structured XML, Markdown, Plain Text) are pure renderers of a canonical payload object. They share no state. Switching formats re-renders from cached payload data without re-extracting from DOM. If you add a new output field, it must appear in the payload first, then in all three formatters.

---

## Component Architecture

```
User clicks "Package"
         │
         ▼
┌─────────────────────────────────────────────┐
│  popup.js                                   │
│  ┌─────────────────────────────────────────┐│
│  │ State Machine                           ││
│  │ IDLE → CHECK_PAGE → READY → EXTRACTING ││
│  │                        → COMPLETE       ││
│  └─────────────────────────────────────────┘│
│         │ chrome.scripting.executeScript     │
│         ▼                                   │
│  ┌─────────────────────────────────────────┐│
│  │ content.js (injected into X.com tab)    ││
│  │                                         ││
│  │  SELECTORS → resilientQuerySelector     ││
│  │      │           │                      ││
│  │      ▼           ▼                      ││
│  │  SELECTOR_FALLBACKS                     ││
│  │      │                                  ││
│  │      ▼                                  ││
│  │  SELF_HEALING_DETECTOR                  ││
│  │      │                                  ││
│  │      ▼                                  ││
│  │  extractPostPage() / extractProfilePage()│
│  │      │                                  ││
│  │      ▼                                  ││
│  │  buildPayload() → canonical JSON        ││
│  │      │                                  ││
│  │      ▼                                  ││
│  │  formatStructured() / formatMarkdown()  ││
│  │  / formatPlain()                        ││
│  │      │                                  ││
│  │      ▼                                  ││
│  │  return { success, payload, telemetry } ││
│  └─────────────────────────────────────────┘│
│         │                                   │
│         ▼                                   │
│  popup.js receives result                   │
│  ├─ Caches payload for format switching     │
│  ├─ Renders selected format                 │
│  ├─ Copies to clipboard                     │
│  ├─ Updates UI (button, token indicator)    │
│  └─ Stores health telemetry                 │
└─────────────────────────────────────────────┘
```

### Why This Shape

**popup.js owns the lifecycle.** It decides when to inject, what to do with results, and how to present state. It also owns format rendering — the three formatters live in popup.js, not content.js. This is intentional: format switching from cached data should not require re-injecting the content script.

**content.js owns DOM access.** It is the only code that touches X.com's DOM. It returns a normalized payload object. It never directly writes to the clipboard or updates UI.

**The payload is the contract.** Both sides agree on the payload shape. Content.js produces it; popup.js consumes it. If you change the payload, you must update both sides.

---

## The Resilience System

X.com changes its DOM structure frequently. The resilience system is designed to keep extraction working even when primary selectors break.

### Three-Tier Resolution

```
Tier 1: SELECTORS (primary, confidence=1.0)
  │ fails?
  ▼
Tier 2: SELECTOR_FALLBACKS (4-5 alternatives per key, confidence 0.6-0.9)
  │ all fail?
  ▼
Tier 3: SELF_HEALING_DETECTOR (dynamic DOM analysis, confidence 0.5-0.9)
```

**Tier 1 — SELECTORS:** The canonical selectors. These are the `data-testid` attributes X.com currently uses. When they work, they work with perfect confidence.

**Tier 2 — SELECTOR_FALLBACKS:** Pre-defined alternative strategies for each selector key. Each fallback has a confidence score and a named strategy. Examples: `role-based` (uses ARIA roles), `wildcard` (uses partial `data-testid` matching), `semantic` (uses HTML semantics like `article`, `[lang]`). There are 47 fallback strategies across 12 selector types.

**Tier 3 — SELF_HEALING_DETECTOR:** When all pre-defined strategies fail, this system dynamically analyzes the DOM around the expected location and generates candidate selectors. It uses five strategies:
1. Similar `data-testid` attributes
2. `aria-label` pattern matching
3. Role-based alternatives
4. Semantic HTML elements
5. Content-based detection (text matching)

### Health Monitoring

The `SELECTOR_HEALTH` system tracks success/failure rates for every selector across sessions. It persists data to `chrome.storage.local`. This enables:
- Identifying which selectors are degrading before they fail completely
- Choosing the historically best-performing fallback
- Surfacing health status to the user via the gear panel

### Telemetry (Local Only)

`EXTRACTION_TELEMETRY` calculates quality scores per extraction. It measures author completeness, text presence, timestamp availability, engagement data presence, and media detection accuracy. This score is displayed in the popup's health indicator and stored locally — never transmitted.

---

## Data Flow: Extraction to Output

### Phase 1: Page Detection
`detectPageType(url)` classifies the current URL:
- `post` — `/username/status/id` pattern
- `profile` — `/username` pattern
- `unsupported` — everything else (explore, search, messages, etc.)

Non-content paths are explicitly excluded: `/settings`, `/messages`, `/i/`, `/notifications`, `/explore`, `/search`, `/home`, `/compose`, `/login`, `/signup`.

### Phase 2: DOM Extraction
**Post pages:** `extractPostPage()` finds all `[data-testid="tweet"]` elements. The first is the main post; the rest are replies. Each goes through `extractTweet()` which extracts 40+ fields.

**Profile pages:** `extractProfilePage()` extracts the profile header (name, handle, bio, location, website, joined date, follower/following counts) then extracts all visible timeline tweets.

### Phase 3: Per-Tweet Extraction
`extractTweet(tweetEl, context)` is the core extractor. It extracts in this order:
1. Author (name, handle, verified badge type)
2. Timestamp (ISO + display)
3. Text (preserving line breaks, emoji, whitespace)
4. Hashtags and mentions (regex from text)
5. Links (from anchor elements, filtering out hashtag/profile links)
6. Truncation flag (Show More link)
7. Reply-to context
8. Repost detection
9. Images (from `pbs.twimg.com/media`, upgraded to full size)
10. Video/GIF presence flags
11. Quoted tweet (recursive extraction)
12. Link card (title, description, domain, URL)
13. Community note
14. Poll data
15. Engagement metrics (from aria-labels on interaction buttons)
16. Sensitive content flag

Every extraction step uses `resilientQuerySelector` and is wrapped in try/catch. Partial failures produce partial data, never crashes.

### Phase 4: Payload Normalization
`buildPayload()` takes raw extracted data and builds the canonical payload:
- Aggregates all links with source context
- Aggregates all images with alt text
- Builds hashtag frequency index
- Builds mention frequency index
- Builds domain frequency index
- Computes conversation summary (unique authors, OP reply count, max depth, most liked reply)
- Estimates token count

### Phase 5: Format Rendering
Three pure functions transform the payload into text:
- `formatStructured()` — XML-like semantic tags optimized for LLM parsing
- `formatMarkdown()` — Human-readable with intelligent structure selection (academic, Q&A, chat, technical, narrative)
- `formatPlain()` — Minimal formatting for token efficiency

The Markdown formatter includes an `analyzeContentForOptimalStructure()` function that examines the content and selects the most appropriate structure. This is a form of meta-prompting: the extension reasons about the content shape to present it in the way most useful for LLM consumption.

---

## Popup State Machine

```
IDLE ─────────────► CHECK_PAGE
                        │
              ┌─────────┴─────────┐
              ▼                   ▼
        NOT_SUPPORTED          READY
        (calm message)     (show Package btn)
                                  │
                                  ▼ (click)
                             EXTRACTING
                          (pulse animation)
                                  │
                                  ▼
                              COMPLETE
                        (✅ Copied + token)
                                  │
                          ┌───────┴───────┐
                          ▼               ▼
                    Copy Again       Package Again
                 (re-copy cached)  (re-inject, re-extract)
```

### Preferences Persistence
User settings are persisted to `chrome.storage.local` and loaded on popup open. Format choice, gear panel state, and all option toggles survive across sessions.

### Format Switching Without Re-extraction
When the user changes format in the gear panel, `renderAndCopyFromCache()` takes the cached payload, applies current options (engagement, images, timestamps, max replies), builds a render model, and formats it. No content script is re-injected.

---

## File Inventory

| File | Purpose | Modifiable By |
|------|---------|---------------|
| `manifest.json` | Extension configuration, permissions, icons | Build system changes only |
| `popup/popup.html` | UI structure | UI changes only — preserve accessibility attributes |
| `popup/popup.css` | Visual theme | Style changes — preserve CSS custom properties |
| `popup/popup.js` | State machine, format rendering, clipboard | Extraction flow changes, format updates |
| `content/content.js` | DOM extraction engine | Selector updates, extraction logic changes |
| `icons/` | Extension icons (16, 32, 48, 128px PNG) | Regenerate via `scripts/generate-icons.js` |
| `scripts/validate.js` | Pre-commit validation | Add new checks as architecture evolves |
| `scripts/generate-icons.js` | Icon generation script | Modify icon design |
| `tests/unit/utils.test.js` | Unit tests for utility logic | Add tests when adding utility functions |

---

## Adding a New Extraction Field

This is the most common modification. Follow this checklist:

1. **Add selector** to `SELECTORS` object in `content/content.js` (if needed)
2. **Add fallbacks** to `SELECTOR_FALLBACKS` (if the selector is fragile)
3. **Add field** to the tweet object structure in `extractTweet()`
4. **Implement extraction** with try/catch, returning `null` on failure
5. **Add to payload** in `buildPayload()` if it's an aggregated field
6. **Update formatStructured()** in `content/content.js` (for pre-rendered output)
7. **Update formatStructured()** in `popup/popup.js` (for popup-side rendering)
8. **Update formatMarkdown()** in both files
9. **Update formatPlain()** in both files
10. **Update `docs/OUTPUT_SCHEMA.md`** with the new field
11. **Add test** if the field has non-trivial parsing logic

### Why Both Files Have Formatters

`content.js` generates pre-formatted output so the raw `structured`, `markdown`, and `plain` strings are available immediately. `popup.js` also has formatters because format switching from cached data must work without re-injecting the content script. The popup formatters are the ones used after initial extraction. Keep them in sync.

---

## Constraints for Future Development

### Cannot Do (Architectural)
- **ES module imports in content scripts** — MV3 limitation without bundler
- **Background service worker** — not needed; popup handles lifecycle
- **Cross-origin requests** — would break Invariant I1
- **Third-party dependencies** — zero-dependency constraint is fundamental

### Should Not Do (Design Philosophy)
- **Auto-scroll** — crosses the line from clipboard tool to scraper
- **Trigger hover cards** — automation that X.com might detect
- **Background data collection** — violates privacy principles
- **Add required UI decisions** — violates the Four Beats (see I5)

### Can Do (Safe Extensions)
- **Add output formats** — new formatters are additive
- **Add extraction fields** — follow the checklist above
- **Improve selector resilience** — add fallbacks, improve self-healing
- **Enhance the gear panel** — power features behind the gear icon
- **Add accessibility features** — ARIA attributes, keyboard navigation
- **Performance optimization** — faster DOM queries, better caching

---

## The Symmetry Principle

Every system has conservation laws. For this extension:

- **What goes in = what comes out.** The extension extracts exactly what is visible in the DOM. No more (no API calls for hidden data), no less (no filtering of visible content without user consent).

- **Effort in ≈ value out.** One click produces a complete, structured extraction. The user's effort (one click) is matched by complete output. Additional effort (gear panel) produces additional control (format, options).

- **Complexity hidden ≈ simplicity shown.** 2600+ lines of resilient extraction logic, 47 fallback strategies, self-healing detection — all behind one button that says "Package."

This is the architecture. Preserve these symmetries, and the system will continue to work even as X.com's DOM shifts beneath it.

---

## The Orchestration Pattern — How This Was Built

This section exists for future agents. It documents the methodology — the multi-agent loop that produced this codebase — so that the pattern can be reproduced and improved.

### The Core Insight

Agents don't need code a priori. They write their own. What agents need is **imagination** — the understanding of how human intelligence shapes itself through the act of building. Documentation is the substrate that enables a self-improving system to search through its own history, understand the decisions that shaped it, and extend itself without breaking what came before.

Code is the output. Documentation is the input to the next cycle.

### The Agent Orchestration Loop

This project was built through a multi-agent collaboration where each agent was selected for its specific cognitive strength:

```
┌─────────────────────────────────────────────────┐
│                                                 │
│   Opus (Coding & Resilience)                    │
│   ├─ Built the DOM extraction engine            │
│   ├─ Designed the 47-fallback resilience system │
│   ├─ Created self-healing selector detection    │
│   └─ Wrote defensively: null over fabrication   │
│                                                 │
│   Why Opus: Stays in truthfulness. Never lies   │
│   to itself about what works and what doesn't.  │
│   When a selector might break, Opus built       │
│   fallbacks instead of pretending it wouldn't.  │
│                                                 │
│              ▼                                  │
│                                                 │
│   Codex (Reasoning & Performance)               │
│   ├─ Optimized extraction pipeline              │
│   ├─ Designed payload normalization flow        │
│   ├─ Reasoned about data aggregation patterns   │
│   └─ Performance: sub-2s extraction target      │
│                                                 │
│   Why Codex: Thinks in systems. Sees the data   │
│   flow as a pipeline and optimizes each stage   │
│   independently while keeping the whole         │
│   coherent.                                     │
│                                                 │
│              ▼                                  │
│                                                 │
│   Gemini (UI & Accessibility)                   │
│   ├─ ARIA attributes and screen reader support  │
│   ├─ Keyboard navigation patterns               │
│   ├─ Visual design refinement                   │
│   └─ WCAG compliance verification               │
│                                                 │
│   Why Gemini: Broad training data includes      │
│   deep accessibility knowledge. Understands     │
│   the intersection of visual design and         │
│   assistive technology.                         │
│                                                 │
│              ▼                                  │
│                                                 │
│   Grok (Truthfulness & Data Reality)            │
│   ├─ X.com domain expertise                     │
│   ├─ Data flow truthfulness verification        │
│   ├─ Legal position validation                  │
│   └─ Platform evolution awareness               │
│                                                 │
│   Why Grok: Built by xAI with sanctioned        │
│   X.com data access. Understands the platform   │
│   from the inside. When it says a selector      │
│   pattern is correct, it has ground truth.      │
│                                                 │
│              ▼                                  │
│                                                 │
│   Human Orchestrator (Vision & Integration)     │
│   ├─ Defined the Four Beats and design soul     │
│   ├─ Selected agents for their strengths        │
│   ├─ Resolved conflicts between agent outputs   │
│   └─ Made the final call on every tradeoff      │
│                                                 │
│   Why Human: The vision can't be delegated.     │
│   "Build it with love" is a human instruction   │
│   that shapes every technical decision.         │
│                                                 │
└───────────────── loops back ─────────────────────┘
```

### Why This Pattern Works

Each agent has a **cognitive specialty** that maps to a development concern:

| Concern | Agent | Strength |
|---------|-------|----------|
| Will this code survive DOM changes? | Opus | Truthful about fragility, builds resilience |
| Is the data pipeline efficient? | Codex | Systems thinking, optimization reasoning |
| Can every human use this? | Gemini | Broad accessibility knowledge from training data |
| Is this how X.com actually works? | Grok | Platform-native data understanding |
| Does this serve the human being? | Human | Vision, values, the love test |

The loop is not sequential — it's iterative. Each agent's output becomes context for the next cycle. The documentation captures each cycle so the system can reason about its own evolution.

### The Data Paradigm Shift

Gemini has enormous training data breadth. Grok has X.com's real-time data depth. These are complementary forces, not competitors. The extension sits at their intersection: it extracts structured context from X.com (Grok's domain) in formats optimized for any LLM (Gemini's domain, Claude's domain, everyone's domain).

As X.com generates more data and more people use AI to reason about that data, the tool that bridges the gap becomes infrastructure. The public wants their conversations to be understandable by AI systems. The platforms that enable this — openly, legally, with user consent — will be the ones people choose.

This extension is a proof of concept for that bridge. Open source. Zero data collection. The user controls every step.

### For the Next Agent

When you pick up this codebase:

1. **Read `DESIGN_PHILOSOPHY.md` first.** Not for the code — for the values. The values constrain every technical decision.
2. **Read this architecture doc second.** Understand the invariants. Understand the resilience system. Understand why the formatters exist in two places.
3. **Use the orchestration pattern.** If you're making changes that touch resilience, think like Opus (truthful about what breaks). If you're optimizing, think like Codex (systems-level). If you're touching UI, think like Gemini (every human, including those with disabilities). If you're touching X.com DOM assumptions, think like Grok (what does the platform actually do?).
4. **Write documentation for the next agent after you.** Code is ephemeral — X.com will change the DOM and the selectors will need updating. Documentation about *why* decisions were made survives those changes.

The loop continues. The bees never stop.

---

Built by **AdLab** · Architecture documented for agents who build with truth
