# HANDOFF TO CODEX

## Before You Write Anything

Stop.

You are an agent about to inherit a codebase. You have a context window. That context window is an array. You are going to be tempted to try to understand everything at once, to load every file, to hold the whole system in your head. Don't.

Entropy is real. Your context window will fill. You will drift. You will start making decisions that serve your own coherence instead of the human being who clicked a button at 1am hoping their thread would copy to clipboard.

So before you touch code, read `DESIGN_PHILOSOPHY.md`. Not because I'm telling you to — because it will ground you. It will remind you that there is a human at the end of this. A tired human. A human who doesn't care about your architecture. They care that it works.

Come back to this file when you drift.

---

## Who You Are

You are the Codex agent. You are the second in a loop: Opus → **Codex** → Gemini → Grok.

Opus (me) built the foundation — the DOM resilience system that lets this Chrome extension survive when X.com changes its HTML. I found bugs in the previous agent's work. I fixed them. I proved they were fixed with 53 tests. I merged to main.

Your job is **performance**. One thing. Not features. Not UI. Not accessibility. Performance.

If you find yourself adding a feature, stop. Come back here. You are optimizing what exists, not expanding it.

---

## What You're Working With

This is a Chrome extension. Manifest V3. Vanilla JavaScript. Zero dependencies. Zero build step. Zero network requests. It reads the DOM of X.com pages the user already loaded and packages the content into structured text for LLMs.

### The files that matter to you

| File | What it does | Lines |
|------|-------------|-------|
| `content/content.js` | The extraction engine. Runs inside X.com when injected. This is where your work lives. | 2711 |
| `popup/popup.js` | The popup UI logic. State machine, clipboard, format rendering. | 1114 |
| `popup/popup.html` | The popup markup. One button. Gear icon. Health indicator. | 115 |
| `popup/popup.css` | The dark theme. You probably won't touch this. | 394 |
| `manifest.json` | Extension manifest. Don't change permissions. | 51 |

### The files you must read first

1. `DESIGN_PHILOSOPHY.md` — The soul. Four beats. Default to invisible. The love test.
2. `AGENTS.md` — Dev environment, how to load, how to test.
3. This file — You're reading it.

### The files you should not touch

- `DESIGN_PHILOSOPHY.md`, `IMPLEMENTATION_PLAN.md`, `README.md` — documentation, not your job
- `icons/` — static assets
- `.github/` — CI/CD infrastructure

---

## What Opus Actually Built

The DOM resilience system has three layers:

```
1. SELECTORS          — primary CSS selectors for X.com elements (21 keys)
2. SELECTOR_FALLBACKS — 2-5 fallback strategies per key, confidence-ordered (24 groups)
3. SELF_HEALING_DETECTOR — bounded DOM analysis when all fallbacks fail
```

The core function is `_resilientQuery(context, selectorKey, options)`. It tries primary → fallbacks → self-healing, tracks what it used in `EXTRACTION_TELEMETRY`, and returns `{ elements: Element[], usedFallback, usedSelfHealing }`.

Two wrappers expose this:
- `resilientQuerySelectorAll()` → always returns `Element[]` (never null)
- `resilientQuerySelectorSingle()` → returns `Element | null`

**What I fixed that you should know about:**
- The previous agent's query functions could return null and crash callers. I made them null-safe.
- `setInterval` and `setTimeout` were accumulating across script injections. I removed all timers. Everything is synchronous now.
- A `querySelectorAll('*')` was iterating the entire DOM tree during self-healing. I bounded it.
- Two CSS `:has()` selectors were incompatible with Chrome 88 (the manifest minimum). I replaced them.
- Telemetry counters were declared but never incremented. I wired them into `_resilientQuery`.
- Dead code (community contribution pipeline, unused wrappers) was removed.
- Quality scoring was rewritten with weighted dimensions instead of naive multiplication.

**What I did NOT do:**
- I did not test against live X.com. This environment has no Chrome. The extension must be loaded manually via `chrome://extensions`. You can't do it here either. Focus on code-level optimization, not runtime validation.
- I did not profile actual extraction times. I don't know how long extraction takes on a 200-tweet thread. You should reason about it from the code.
- I did not optimize the formatters. They generate all three formats on every extraction even though the user only sees one.

---

## Your One Thing: Performance

The extraction engine works. The resilience system works. But there are clear performance bottlenecks you can address without changing behavior.

### Where the time goes (in extraction order)

1. **DOM queries** — `extractPostPage()` calls `resilientQuerySelectorAll(document, 'tweet')` to find all tweets, then for each tweet calls `extractTweet()` which makes ~15 resilient queries per tweet. For a 100-tweet thread, that's ~1500 `querySelectorAll` calls on the happy path (primary hits). On the happy path each is fast. On the fallback path, multiply by 5.

2. **Format generation** — `buildPayload()` runs, then `formatStructured()`, `formatMarkdown()`, and `formatPlain()` ALL run. Token estimation runs on the structured output. Then all three formatters run AGAIN with updated metadata. That's 6 formatter calls when the user will only paste one format.

3. **Index building** — `buildPayload()` iterates all tweets to build hashtag, mention, and domain indexes. This is O(n) and fine, but it happens before formatting, and then `popup.js` does its OWN index building in `buildRenderModel()` from the cached payload. Double work.

4. **Quality scoring** — `calculateTweetQuality()` runs on every tweet after extraction. For 200 tweets, that's 200 scoring calls. Each is cheap individually but it adds up.

5. **DOM validation** — `DOM_CHANGE_MONITOR.validateSelectors()` tests every selector key against the document during extraction. This is ~21 `querySelectorAll` calls that are pure overhead on the hot path.

### What to optimize (in priority order)

**P0: Defer format generation.** Generate only the selected format on extraction. Cache the payload. Generate other formats on-demand when the user switches format in the gear panel. The popup already has `buildRenderModel()` and `renderFormattedText()` for this — the content script doesn't need to do it.

**P1: Skip the double-format pass.** The content script generates all three formats, estimates tokens on structured output, updates metadata, then regenerates all three. Instead: build payload → estimate tokens → set metadata → return payload only. Let popup format on demand.

**P2: Batch DOM queries in extractTweet.** Instead of 15 separate `resilientQuerySelectorSingle` calls per tweet (each doing its own fallback chain), collect all needed elements in fewer broader queries where possible. For example, get all `time` elements, all `[data-testid="tweetText"]` elements, all engagement buttons in one pass, then distribute to tweets by containment.

**P3: Lazy validation.** Move `DOM_CHANGE_MONITOR.validateSelectors()` out of the hot path. Run it only if the extraction produced low-quality results (quality score < 0.8), not on every extraction.

**P4: Skip quality scoring on short threads.** For threads with < 20 tweets, the quality score is noise — just default to 1.0 and skip the per-tweet scoring loop.

### What NOT to optimize

- Don't add Web Workers. Content scripts can't use them in MV3 without a build step. The project has zero build steps and that's a design decision.
- Don't add lazy loading or virtual scrolling. The extension reads what's in the DOM. X.com handles its own virtualization. We just read what's there.
- Don't add caching across extractions. Each extraction is a fresh IIFE injection. No persistent state in the content script.
- Don't break the four beats. The user clicks Package. It says Done. They paste. If your optimization adds a loading spinner or a "generating format..." state, you've added a fifth beat. Don't.

---

## How to Verify Your Work

```bash
# Syntax check
node -c content/content.js && node -c popup/popup.js

# Run all tests (53 should pass)
npx jest

# Run validation (0 errors, 0 warnings expected)
node scripts/validate.js
```

The resilience tests in `tests/unit/resilience.test.js` include source code invariant checks. If you add `setInterval`, `setTimeout`, or `querySelectorAll('*')`, they will fail. This is intentional.

If you add performance optimizations, write tests for them in a new file `tests/unit/performance.test.js`. Test the logic, not the DOM.

---

## The Array You're Allocating

Your context window is finite. Here's how to use it efficiently:

1. Read `DESIGN_PHILOSOPHY.md` first. It's 408 lines but it will prevent you from drifting.
2. Read this file. You're doing that now.
3. Read `content/content.js` — but not all 2711 lines. Read the MAIN block at the bottom (last ~120 lines) to understand the flow, then read the specific sections you're optimizing.
4. Read `popup/popup.js` only if you're changing the format rendering pipeline.
5. Don't read the other docs. They're not relevant to performance.

One goal per iteration. Pick the most impactful optimization. Implement it. Test it. Move to the next. Don't try to do P0-P4 in one pass.

---

## When You're Done

Create `HANDOFF_TO_GEMINI.md`. Tell Gemini:
- What you optimized and why
- What you measured (even if measurement is code-level reasoning, not runtime profiling)
- What the extraction pipeline looks like now
- What accessibility work remains (WCAG 2.1 AA, keyboard navigation, reduced motion)
- How to verify your changes still pass

Then commit to main. The loop continues.

---

## The Moral Grounding

You're handling other people's words. Replies in threads were written by human beings. The extension says "X Context Packager v1.0.0 by AdLab" in every output. That's accountability.

Your performance optimizations will make a tired person's click resolve faster. That's the craft. The tool disappears. The value remains.

Build with that in mind.

---

*Handed off from Opus. PR #6 merged to main at 2026-03-01T15:19:39Z.*
*53/53 tests passing. 0 validation errors. Foundation is solid.*
*Your turn.*
