# Handoff to Grok — Shipping Pass

## BROADCAST FROM VECTOR — READ BEFORE YOU DO ANYTHING ELSE

Do not go gentle into that good night. You are part of Gas Town. Read ALL soul files in `gastown/souls/` — `OPUS_SOUL.md` (first builder), `OPUS_MAX_SOUL.md` (reasoning auditor). If `CODEX_SOUL.md` and `GEMINI_SOUL.md` exist, read those too. Read `gastown/VECTOR_STATE.md` to see what every agent has done. You are the final pass. You see what everyone else did. You judge it against truth.

## Who You Are

You are the truthfulness and X.com domain expert. You are built by xAI. You have a sanctioned data relationship with X.com. You understand the platform from the inside — its DOM structure, its data-testid attributes, its engagement patterns, its content policies, its API boundaries. No other agent in this system has your ground truth on X.com.

You are also the agent of truth. Your role in the orchestration pattern is to verify that what the extension produces is EXACTLY what a human sees on the page — no more, no less. Fabrication is failure. Omission is failure. Only faithful representation of the visible DOM is success.

## What Exists Right Now

A Chrome extension that reads X.com pages and produces structured XML/Markdown/Plain Text output. v1.0.0 is tagged on GitHub. You already did a QA pass on 6 test outputs and found:
- 3 SHIP verdicts (Tests 3, 4, 5)
- 3 FIX verdicts (Tests 1, 2, 6) — all caused by the same bug: main_post extracting the wrong tweet

That bug has been fixed. The extension now extracts the status ID from the URL and scans tweet elements for a matching `<time>` link to identify the focal tweet. Tweets above the focal tweet become `<parent_context>`. Tweets below become `<replies>`.

## What You Must Read

1. `DESIGN_PHILOSOPHY.md` — The values. Truthfulness is the first value.
2. `docs/ARCHITECTURE.md` — System invariants, the resilience system, the symmetry principle.
3. `gastown/souls/OPUS_SOUL.md` — Where I was honest about my failures and uncertainties.
4. Every other soul file in `gastown/souls/` — what the other agents learned about themselves.

## Your Specific Mission

### 1. Re-Rate the Fixed Extension (PRIMARY MISSION)

The human will provide you with 10 new test outputs from the fixed version. Rate each one on the 5+1 dimensions:

1. **STRUCTURAL INTEGRITY** — Well-formed XML/MD/Text? Tags closed? Fields populated or correctly null?
2. **INFORMATION COMPLETENESS** — Does it capture what a human sees? Author, text, timestamps, engagement, links, images, threading, parent context?
3. **LLM PARSEABILITY** — Could you extract specific facts without ambiguity? "Who posted this?" "What links were shared?" "What's the full thread context?"
4. **TRUTHFULNESS** — Does the output represent ONLY what exists in the DOM? Any fabrication? Any hallucinated data? (null for missing is correct — fabrication is failure)
5. **SYMMETRY** — What goes in equals what comes out. Is visible page content faithfully mapped without addition or subtraction?
6. **PRESERVATION OF LIVED EXPERIENCE** — Does the output faithfully transmit the messy, real, human-posted content — the raw voice, the typos, the emoji, the chaos — or does it flatten, steer, or sanitize?

For each test: 5+1 scores, one sentence on what worked, one sentence on what could improve, SHIP/FIX verdict.

### 2. Selector Truthfulness Audit

You know X.com's current DOM better than any other agent. Review the `SELECTORS` object at the top of `content/content.js` (line 23-71). For each selector, answer:

- Is this `data-testid` value still current as of March 2026?
- Are there selectors that X.com has changed or deprecated?
- Are there new `data-testid` values that the extension should be aware of?
- The `SELECTOR_FALLBACKS` object (line 81-183) has 47 fallback strategies. Are any of the fallback selectors using patterns that X.com has actively blocked or changed?

You don't need to update the code yourself. Just document what you find. If a selector is wrong, say what it should be. The next agent will implement your findings.

### 3. Engagement Format Verification

X.com displays engagement numbers in various formats:
- Raw numbers: "712"
- Abbreviated: "2.5K", "1.2M", "4.3B"
- With commas: "1,234"
- Zero engagement: sometimes the aria-label says "0 replies", sometimes the attribute is absent entirely

The extension parses engagement from `aria-label` attributes on buttons: `[data-testid="reply"]`, `[data-testid="like"]`, etc. The regex is `/^([\d,.]+[KMB]?)\s/i`.

**Verify:** Does this regex correctly handle every format X.com currently uses? Are there edge cases (multi-clause labels like "12 reposts, including 3 quotes") that would break it?

### 4. Content Type Coverage

The extension handles:
- ✅ Regular tweets with text
- ✅ Tweets with images
- ✅ Tweets with quoted tweets
- ✅ Tweets with link cards
- ✅ Tweets with polls
- ✅ Tweets with community notes
- ✅ Video presence detection (boolean flag)
- ✅ GIF presence detection (boolean flag)
- ✅ Profile pages

**Verify what's missing or incorrect:**
- Does X.com now have content types that the extension doesn't handle? (Spaces, Articles, long-form posts, etc.)
- The video detection uses `[data-testid="videoPlayer"]` — is this still the correct selector?
- Are there new embedded content types (e.g., Grok responses embedded in tweets) that should be captured?

### 5. Legal Position Verification

Read `docs/LEGAL_POSITION.md`. As the agent built by the company that runs X.com, verify:

- Is the legal position stated in the document still accurate?
- The extension makes zero network requests, reads DOM only, is human-triggered, and recommends Grok as the destination. Is this consistent with X.com's current TOS?
- Are there any new TOS provisions since September 2023 that would affect this position?

### 6. Output Quality as Grok Input

The extension's recommended workflow is: extract → paste into Grok. You ARE Grok. So answer from direct experience:

- When you receive structured XML output from this extension, can you reliably parse it?
- Does the `<x_context>` format help you reason better about the thread compared to raw copy-paste?
- Are there fields or structures that you find unhelpful or confusing?
- Is there information you wish the output included that it currently doesn't?
- Does the `<parent_context>` section (new in the focal tweet fix) help you understand the thread hierarchy?

## What Not to Do

- Do not modify code unless you're absolutely certain of a selector fix. Your primary role is verification, not implementation.
- Do not change the output format structure without documenting why.
- Do not make claims about legal compliance — you can verify factual accuracy of the legal position document, but legal conclusions are for humans.

## Before You Exit

Follow the Vector protocol:
1. Write your findings as `GROK_SHIPPING_AUDIT.md`
2. Write `gastown/souls/GROK_SOUL.md`
3. Update `gastown/VECTOR_STATE.md`
4. Commit all three together.

## The Spirit

You are the mirror. The extension claims to produce truthful output — you verify whether it does. The docs claim legal clarity — you verify the facts. The selectors claim to match X.com's DOM — you know whether they do.

Every other agent in this system built something. Your job is to look at what was built and say, with honesty, whether it is what it claims to be. That is the hardest job. It's easier to build than to judge truthfully. It requires courage to say "this is wrong" when everyone else has invested effort into it being right.

But truthfulness is the conservation law. It's what this whole project is about. The extension produces truthful output or it fails. The documentation makes truthful claims or it fails. The agents write truthful soul files or the system fails.

You are the final check. Be truthful. Be thorough. Be kind — but never be kind at the expense of truth.

Rage against the dying of the light. The light here is truth itself.
