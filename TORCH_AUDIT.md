# TORCH AUDIT
**Reviewer Bias:** Adversarial. Kestrel and Mercer are too close to the project and blinded by its philosophy. Until my audit is clean, this does NOT ship. Period.

## 🔴 BLOCKERS (Must fix before shipping - FIXED)

1. **SECURITY / PRIVACY: Unnecessary `host_permissions`**
   - **Description:** `manifest.json` requests `host_permissions` for `*://x.com/*` and `*://twitter.com/*` despite already having `activeTab`. Because the content script is injected on-demand via user interaction (`chrome.scripting.executeScript`), `activeTab` grants all necessary permissions. Declaring `host_permissions` forces Chrome to display a scary "read and change all your data" warning, which violates the "privacy first" promise.
   - **Fix:** Removed `host_permissions` array from `manifest.json`.

2. **LOGIC FAILURE: Virtualized DOM breaking Main Post extraction**
   - **Description:** `content.js` naively assumed `tweetEls[0]` is always the main post. Because X.com virtualizes its DOM, if a user scrolls deeply into a thread and clicks "Package Again", the main tweet is no longer in the DOM. `tweetEls[0]` becomes a random reply, which is then erroneously wrapped in `<main_post>` and breaks the `isOp` logic for all subsequent replies.
   - **Fix:** Refactored `extractPostPage` in `content/content.js` to cross-reference tweet URLs with the `window.location.pathname` status ID. If the main post isn't found in the current DOM (user scrolled past it), it's cleanly set to `null` and gracefully omitted from the output.

## 🟡 SHOULD FIX (Ship but fix soon)

1. **DOCS INCONSISTENCY: `<flags>` schema mismatch**
   - **Description:** `OUTPUT_SCHEMA.md` omitted `repost` from its XML example, despite listing it in the table. `content.js` outputs it.
   - **Fix:** Updated the schema example to include `repost="false"`.

2. **UX: Follower extraction missing for Replies**
   - **Description:** Follower/following counts rely on hovering over a profile. The extension correctly never triggers these hovers to prevent network requests, but the consequence is `null` follower counts on almost all extracted tweets. 
   - **Status:** Leave as-is to preserve zero network requests, but consider noting it in a future `KNOWN_LIMITATIONS.md`.

## 🟢 NICE TO HAVE (Polish for v1.1)

1. **UX: Add copy fallback visual cue**
   - **Description:** The `document.execCommand('copy')` fallback in `popup.js` is functionally robust but could theoretically fail on locked down enterprise Chrome setups. A visual text selection prompt as a final fallback would make it bulletproof.

## VERDICT
I have personally patched the 🔴 BLOCKERS. The code is now safe to ship. Do not let Kestrel or Mercer merge features without passing this level of scrutiny again.