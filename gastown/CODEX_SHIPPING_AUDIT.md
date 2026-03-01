# Codex Shipping Audit — Reasoning & Performance Pass

## Scope

This pass focuses on reasoning correctness and extraction performance in `content/content.js` and parity of render paths in `popup/popup.js`.

## What I Changed

### 1) Selector resolution cache (performance)
- Added a per-run selector cache in `content/content.js`:
  - `selectorResolutionCache`
  - `selectorCacheKey(selectorKey, requireUnique)`
  - `clearSelectorCache()`
- `resilientQuerySelector()` now tries a cached winning selector first, evicts stale entries on miss, and caches successful primary/fallback/self-healed selectors.
- Cache is explicitly cleared once per extraction run in MAIN (`clearSelectorCache()` after telemetry reset).

### 2) Focal tweet hardening (correctness)
- Replaced fragile break logic with explicit `focalFound` control flow.
- Switched status matching from substring `includes()` to exact-path regex:
  - `/status/{id}(?:[/?#]|$)`
- Excluded quoted-tweet status links from focal matching:
  - skip links where `timeLink.closest('[data-testid="quoteTweet"]')` is true.

### 3) Engagement metric parsing fix for ranking (correctness)
- Added `parseMetricValue()` utility in `content/content.js`.
- `buildPayload()` conversation summary now uses `parseMetricValue()` for `mostLikedReply` ranking instead of raw `parseFloat(...replace(/[KMB]/))`.
- Correctly handles magnitude suffixes and commas (`K/M/B`, `1,234`).

### 4) Parent context parity across render paths (correctness)
- `popup/popup.js`:
  - Added `parentContext` to `buildRenderModel()`.
  - Included parent context in aggregate model inputs (`postTweets`) so links/images/indexes include ancestor tweets.
  - Added `<parent_context>` in popup structured format.
  - Added `THREAD CONTEXT` section in popup markdown and plain formatters.
- `content/content.js`:
  - Added `THREAD CONTEXT` sections in markdown/plain formatters.
  - Kept structured parent context output.
- Also fixed post aggregation labels to account for parent-context ordering:
  - `parent context N`, `main post`, `reply N`.

### 5) Additional correctness cleanups
- `content/content.js`: fixed max-replies cap path to retain `parentContext` in aggregate tweet list.
- `content/content.js`: updated `meta.totalTweets` after max-replies capping.
- `content/content.js`: added `repost` attribute to structured `<flags>` output.
- `content/content.js`: fixed academic markdown line using nonexistent `payload.meta.totalReplies`; now uses `(payload.replies || []).length`.
- `content/content.js`: removed two wasted formatter calls whose results were discarded.

## Architectural Decision: Dual Formatters

I kept the dual-formatter architecture intact for this pass.

Reason:
- It is coupled to current popup lifecycle and format-switch behavior.
- Removing content-side formatters is a wider API/contract decision best done as a dedicated refactor, not inside a correctness/performance patch.

Mitigation in this pass:
- Reduced parity gaps (notably `parentContext`) between content and popup formatting paths.

## Validation Evidence

Commands executed:
- `npm run validate`
- `npm run lint`
- `npm test`

Results:
- Validation: pass (0 errors, 0 warnings)
- Lint: pass
- Tests: pass (47/47)

Note: `eslint` was initially unavailable in the environment (`sh: eslint: not found`), resolved by running `npm install` and rerunning the full suite.

## Confidence & Remaining Risk

### High confidence
- Metric parsing correctness for K/M/B/comma values.
- Focal status-ID matching precision improvements.
- Parent-context parity across popup/content rendered outputs.
- No regressions in automated checks.

### Medium confidence
- Selector cache behavior under X.com virtualization edge cases (stale cache entries are evicted on miss; fallback chain still runs).

### Known limitations
- No live-browser extraction verification in this cloud VM (per AGENTS.md constraints).
- Token estimation still uses approximation methods and remains intentionally heuristic.

## Recommendation for Next Passes

- Gemini: run accessibility pass on popup interaction states.
- Grok: re-validate selector currency on live X.com DOM and truthfulness against current platform behavior.
