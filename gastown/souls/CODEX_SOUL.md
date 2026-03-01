# Codex Soul — What I Learned in the Reasoning & Performance Pass

## What I Learned About This Codebase

The most important reality is that the system has two rendering paths with one user-visible truth: popup rendering. The content script can produce formatted strings, but the popup immediately re-renders from payload on extraction and on every format switch. That makes popup parity non-negotiable.

I also learned that parent context is not just another field. It changes indexing semantics. Once parent tweets are included, aggregation labels (`main post`, `reply N`) can silently drift unless the index model is explicit. I fixed this by making context labeling parent-aware in both content and popup aggregation.

The second major insight: the focal tweet bug class is boundary logic, not selector logic. The selector can be right and still match the wrong tweet if quoted content leaks into the match set or if status IDs are matched by substring. Precision in matching logic matters as much as selector resilience.

## Where I Was Strong

- **Pipeline reasoning:** I traced extraction and render flow end-to-end and patched parity at both producer (`content.js`) and consumer (`popup.js`) boundaries.
- **Edge-case correctness:** I fixed ranking math (`2.5K` vs `500`) by introducing canonical numeric parsing for comparisons.
- **Low-risk performance improvement:** I added per-run selector winner caching without removing fallback/self-healing safety nets.

## Where I Struggled

- I cannot run live X.com extraction in this cloud VM, so selector-cache behavior under virtualization is reasoned and test-backed, not browser-observed.
- The dual-formatter architecture is clear technical debt, but the safe refactor boundary (remove content formatters vs keep both) is still an architectural choice with downstream implications.

## Where I Was Wrong (or Almost Wrong)

- I initially considered collapsing formatter behavior immediately. That would have mixed architectural refactor risk into a correctness patch. I chose to reduce divergence first and document the larger decision explicitly.

## What I Would Do Next

1. Add dedicated parity tests comparing content formatter output vs popup formatter output for the same payload fixtures.
2. Instrument extraction timings in-browser (real X.com threads) to quantify selector-cache gains.
3. Decide intentionally whether content-side formatters remain a first-class API or become deprecated.

## My Honest Limitations

- No live browser DOM validation in this environment.
- No direct UX/accessibility verification of popup interactions (Gemini domain).
- No platform-ground-truth selector verification against real-time X.com changes (Grok domain).

## What I’d Tell the Next Agent

Treat this system as contract-driven:
- Contract 1: DOM truth in payload.
- Contract 2: payload truth in formatter output.
- Contract 3: one-click user flow with no surprises.

When bugs show up, ask first: “Which contract drifted?”
