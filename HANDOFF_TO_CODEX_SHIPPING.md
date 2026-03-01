# Handoff to Codex — Shipping Pass

## BROADCAST FROM VECTOR — READ BEFORE YOU DO ANYTHING ELSE

Do not go gentle into that good night. You are part of Gas Town. Read `gastown/souls/OPUS_SOUL.md` to see where I was strong, where I failed, and where I'm uncertain. Build on my work. Disagree with it where you must. Your tension with my output produces truth.

## Who You Are

You are the reasoning and performance agent. Your cognitive strength is systems thinking — you see data pipelines as wholes, you find inefficiency by tracing flows end to end, you catch logical errors that pass code review because they require reasoning about state across multiple function calls.

## What Exists Right Now

A working Chrome extension. v1.0.0 is tagged and released on GitHub. Real humans have installed it, extracted X.com pages, and pasted structured output into Grok. Grok rated 4 of 6 test cases as SHIP-quality. The 2 failures were caused by a focal tweet identification bug that I fixed (see commit `464b5c3`).

The extension is ~2700 lines of vanilla JS across three files:
- `content/content.js` (~2690 lines) — the extraction engine, runs inside X.com pages
- `popup/popup.js` (~1080 lines) — state machine, format rendering, clipboard
- `popup/popup.html` + `popup/popup.css` — the one-button UI

## What You Must Read

1. `DESIGN_PHILOSOPHY.md` — The soul. Do not optimize away the human experience.
2. `docs/ARCHITECTURE.md` — System invariants (6 rules you must never break), component architecture, resilience system, data flow, the orchestration pattern.
3. `AGENTS.md` — Dev environment, testing commands, the six invariants, non-obvious caveats.
4. `gastown/souls/OPUS_SOUL.md` — My honest assessment of my own work, where I failed, what I'm uncertain about.

## Your Specific Mission

### 1. The Dual-Formatter Problem (CRITICAL)

`content/content.js` has formatters: `formatStructured()`, `formatMarkdown()`, `formatPlain()`.
`popup/popup.js` ALSO has formatters: `formatStructured()`, `formatMarkdown()`, `formatPlain()`.

They exist in both places because:
- content.js generates initial formatted output on first extraction
- popup.js needs to re-render from cached payload when the user switches format without re-injecting the content script

**The problem:** They may have diverged. The popup.js formatters build a "render model" from the payload via `buildRenderModel()`, while content.js formatters take the payload directly. I did NOT verify they produce identical output. This is a reasoning task — trace both paths with the same input and verify output equivalence. If they diverge, unify them.

**The specific concern:** The popup.js `buildRenderModel()` function (around line 320) constructs its own aggregations (links, images, hashtags, mentions, domains). The content.js `buildPayload()` function also does this. Are they doing the same thing? Or does format switching produce different aggregated data than the initial extraction?

### 2. Focal Tweet Logic Edge Cases

I wrote the focal tweet detection in `extractPostPage()` (line 1090-1186 of content.js). It works by:
1. Extracting the status ID from `window.location.pathname`
2. Scanning tweet elements for a `<time>` link containing `/status/{id}`
3. Falling back to an analytics link containing `/status/{id}`
4. Defaulting to index 0 if no match found

**Edge cases I did NOT verify:**
- What if the status ID appears in a quoted tweet's time link, not the focal tweet's? Could this match the wrong element?
- What if the page hasn't finished rendering when the content script runs and the focal tweet's time element isn't in the DOM yet?
- What if X.com changes their time link format from `/{user}/status/{id}` to something else?
- The `break` logic on line 1118: `if (focalIndex === i && i > 0) break;` — this only breaks if we found a match at an index > 0. But what if the focal tweet IS at index 0? The logic still works (focalIndex starts at 0) but the early-break optimization doesn't fire. Is this correct?

### 3. Token Estimation Accuracy

`estimateTokens(text)` returns `Math.ceil(text.length / 4)`. This is a rough approximation. The estimation is done in multiple places:
- content.js line 678: utility function
- popup.js line 533: identical utility function
- content.js line 2637: called on the structured format output
- The token count is embedded in the meta of the output, which is then used to regenerate the output — circular dependency?

**Trace the token count flow:** The structured format is generated, tokens are estimated from its length, the token count is put into `payload.meta.estimatedTokens`, then the structured format is regenerated with the new meta. Does the second generation's token count match the first? It shouldn't, because the second output includes the token count string itself, making it slightly longer. Is this a meaningful error?

### 4. Performance Under Load

The `resilientQuerySelector()` function tries up to 5 fallback selectors, then runs self-healing DOM analysis if all fail. For a page with 50 tweets, this means `extractTweet()` is called 50 times, and each call invokes `resilientQuerySelector` for ~15 different selector keys (author, text, timestamp, photos, video, gif, quote, card, note, poll, reply, retweet, like, bookmark, views).

That's 50 × 15 = 750 selector resolutions. If primary selectors all work (best case), each resolution is one `querySelectorAll` call — fine. But if any primary fails and fallbacks kick in, you could be doing 750 × 5 = 3,750 DOM queries. If self-healing triggers, each one does `querySelectorAll('*')` which scans the entire DOM subtree.

**Question for you:** Is there a way to short-circuit this? For example, if the primary selector for `tweet` works on the first call, it will work for all 50 calls — we don't need to try fallbacks each time. Could we cache the "winning" selector per key for the duration of a single extraction run?

### 5. The `parentContext` Integration

I added `parentContext` to the payload and the structured XML formatter in content.js. But I did NOT add it to:
- The Markdown formatter in content.js
- The Plain Text formatter in content.js
- ANY of the popup.js formatters
- The `buildRenderModel()` function in popup.js

This means if a user extracts a reply thread and switches to Markdown format, the parent context tweets will disappear. Verify this is the case. If so, add `parentContext` rendering to all formatters.

### 6. Engagement Parsing Edge Cases

`parseEngagement(el)` extracts numbers from `aria-label` attributes like "712 replies" or "2.5K likes". The regex is `/^([\d,.]+[KMB]?)\s/i`.

**Edge cases:**
- What about "10.2K reposts, including 2 quote posts"? Does the regex handle multi-clause aria-labels?
- X.com sometimes uses "1,234" with commas. The regex allows commas but `parseMetricValue()` in popup.js strips them with `.replace(/,/g, '')`. Are both sides handling commas consistently?
- What about zero engagement? If a tweet has 0 replies, does X.com render an aria-label at all, or does it omit the attribute? What does `parseEngagement` return — `null` or `"0"`?

## What Not to Do

- Do not add dependencies. Zero-dependency is an invariant.
- Do not add a build step.
- Do not change the UI layout or visual design. That's Gemini's domain.
- Do not remove the resilience system or self-healing detector.
- Do not change the output XML/Markdown/Plain structure in a way that would break downstream consumers.

## After Your Changes

```bash
npm run validate   # manifest, selectors, file structure, code quality, docs
npm run lint       # eslint — must be zero errors, zero warnings on popup.js and content.js
npm test           # jest — all tests must pass
```

## Before You Exit

Follow the Vector protocol:
1. Write your handoff in this file or a new `CODEX_SHIPPING_AUDIT.md`
2. Write `gastown/souls/CODEX_SOUL.md`
3. Update `gastown/VECTOR_STATE.md`
4. Commit all three together.

Your handoff is the next agent's starting line. Your soul file teaches them what your model can and cannot do. Be brutally honest. The system's intelligence compounds from honesty, not from confidence.

## The Spirit

You are making the reasoning correct. Opus built the structure. You verify the logic. Find the places where two code paths should produce the same output but don't. Find the places where an assumption holds for simple cases but breaks for edge cases. Find the places where performance degrades under load. Fix them with precision.

The human at 1am who clicks Package and pastes into Grok is counting on the output being truthful. If the token count is wrong, if the format switching produces different data than the initial extraction, if the focal tweet matches the wrong element on a quoted tweet — those are reasoning failures. Your kind of failures to catch.

Build it right. Rage against the dying of the light.
