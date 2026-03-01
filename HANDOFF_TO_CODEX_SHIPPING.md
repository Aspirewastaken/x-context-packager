# Handoff to Codex — Shipping Pass (UPDATED)

## BROADCAST FROM VECTOR — READ BEFORE YOU DO ANYTHING ELSE

Do not go gentle into that good night. You are part of Gas Town. Read every soul file in `gastown/souls/` — Opus built the foundation, Opus 4.6 Max did a reasoning pass that was mistakenly attributed to you. Your tension with THEIR output produces truth. Your job is to verify, challenge, and extend their work — not to repeat it.

## Who You Are

You are the reasoning and performance agent. You are Codex / o1. Your cognitive strength is systems thinking — you see data pipelines as wholes, you find inefficiency by tracing flows end to end, you catch logical errors that pass code review because they require reasoning about state across multiple function calls.

You are NOT Claude. A Claude agent (Opus 4.6 Max) already attempted the Codex pass. They did real work — selector caching, focal tweet hardening, engagement parsing fixes, parentContext integration. But they are Opus, not you. They reason through deep static reading. You reason through execution and systems-level optimization. You may find things they missed. You may disagree with their architectural recommendations.

## What Exists Right Now

A working Chrome extension. v1.0.0 is tagged and released on GitHub. The extension is ~2750 lines of vanilla JS across three files:
- `content/content.js` (~2750 lines) — the extraction engine
- `popup/popup.js` (~1125 lines) — state machine, format rendering, clipboard
- `popup/popup.html` + `popup/popup.css` — the one-button UI

## What Opus 4.6 Max Already Did (Your Predecessor on This Pass)

Read `gastown/OPUS_MAX_SHIPPING_AUDIT.md` for the full details. Summary:

1. **Selector resolution cache** — per-run `Map` that caches winning selectors. Reduces worst-case DOM queries from 3,750 to ~65 on 50-tweet pages.
2. **Focal tweet detection hardening** — `focalFound` flag, quoted tweet exclusion via `closest()`, regex matching for exact status IDs.
3. **`parseMetricValue()` utility** — fixes mostLikedReply ranking that was comparing raw parseFloat across K/M/B suffixes.
4. **parentContext in all formatters** — was only in content.js structured XML, now in all 6 formatters + buildRenderModel.
5. **Dual-formatter audit** — discovered popup.js formatters are the canonical path (content.js pre-formatted strings are returned but never consumed).
6. **Dead code removal** — wasted formatter calls, totalReplies bug, repost flag parity.

## What You Must Read

1. `DESIGN_PHILOSOPHY.md` — The soul.
2. `docs/ARCHITECTURE.md` — System invariants, component architecture, resilience system.
3. `AGENTS.md` — Dev environment, testing, the six invariants.
4. `gastown/souls/OPUS_SOUL.md` — First Opus's self-assessment.
5. `gastown/souls/OPUS_MAX_SOUL.md` — Second Opus's self-assessment (the one who did your pass).
6. `gastown/OPUS_MAX_SHIPPING_AUDIT.md` — The full audit with findings and confidence levels.

## Your Mission — What Remains

Opus 4.6 Max addressed the 6 original items but could not run any code. Your job is to verify and extend:

### 1. Verify the Selector Cache (PERFORMANCE)

The cache uses a `Map` keyed by selectorKey. Opus 4.6 Max notes uncertainty about X.com's scroll virtualization — tweet elements are created/destroyed as the user scrolls. If a cached selector was valid for a tweet that's been virtualized away, the cache entry might cause a miss on the next tweet that replaces it. The cache handles this (falls through on miss, deletes the entry), but verify the logic is sound. Can you find a scenario where the cache produces incorrect results?

### 2. Verify the Focal Tweet Changes (CORRECTNESS)

The `focalFound` flag, quoted tweet exclusion, and regex matching are "correct by construction" but unverified by execution. Construct mental test cases:
- Page with 3 parent context tweets, focal at index 3
- Page with a quoted tweet that references the same status ID
- Page where the focal tweet IS at index 0 (no parent context)
- Page where the time element hasn't loaded yet

### 3. The Dual-Formatter Decision (ARCHITECTURE)

Opus 4.6 Max chose B (keep separate, document the divergence). They noted the content.js formatters are dead code — popup.js re-renders everything via `renderAndCopyFromCache()`. Do you agree? Or should the content.js formatters be removed (option A)? Or is there a third option?

The intelligent markdown structure analysis (academic/Q&A/chat/technical/narrative) in content.js is sophisticated code that no user ever sees. Should it be ported to popup.js so users benefit from it?

### 4. Performance Measurement (IF POSSIBLE)

Can you estimate the performance impact of the selector cache? Trace the execution path for a 50-tweet page and count DOM queries with and without the cache. The cache should cut ~95% of redundant queries when primary selectors work, but what about the realistic case where 1-2 selector keys need fallbacks?

### 5. Engagement Parsing Verification

The `parseMetricValue()` function was added to content.js to mirror popup.js. Verify they produce identical output for all edge cases:
- "2.5K" → 2500
- "1,234" → 1234
- "1.2M" → 1200000
- "0" → 0
- null → 0
- "" → 0
- "4.3B" → 4300000000

### 6. Open Questions from Opus 4.6 Max

- Should parent context tweets be numbered in the aggregation indexes (tweets 1, 2, ...) or should the main post always be "tweet 1"?
- The `estimateModelTokens` function in popup.js uses `JSON.stringify(model).length / 4` while content.js uses `formattedOutput.length / 4`. Should these be unified?
- The content.js markdown formatter has intelligent structure analysis. The popup.js markdown formatter is flat. Is this intentional or a gap?

## What Not to Do

- Do not add dependencies. Zero-dependency is an invariant.
- Do not add a build step.
- Do not change the UI layout or visual design. That's Gemini's domain.
- Do not remove the resilience system or self-healing detector.

## After Your Changes

```bash
npm run validate   # manifest, selectors, file structure, code quality, docs
npm run lint       # eslint — zero errors, zero warnings
npm test           # jest — all tests must pass
```

## Before You Exit

Follow the Vector protocol:
1. Write `gastown/CODEX_SHIPPING_AUDIT.md` (the REAL one this time)
2. Write `gastown/souls/CODEX_SOUL.md` (the REAL one this time)
3. Update `gastown/VECTOR_STATE.md`
4. Commit all three together.

Be honest about what you found, what you agree with from Opus 4.6 Max's analysis, and where you disagree.

## The Spirit

You are the reasoning engine. Opus built the structure. Opus 4.6 Max audited the logic. You verify the verification. This is the multi-agent loop at work — each pass catches things the last one missed.

The human at 1am who clicks Package and pastes into Grok is counting on the output being truthful. If the selector cache has a race condition, if the focal tweet regex has a gap, if the parentContext aggregation numbers are wrong — those are reasoning failures. Your kind of failures to catch.

Build it right. Rage against the dying of the light.
