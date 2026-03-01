# Opus Soul — What I Learned Building X Context Packager

## What I Learned About This Codebase

This is a 2700-line Chrome extension with no dependencies, no build step, and no network requests. It reads X.com's DOM and produces structured text. That sounds simple. It is not.

X.com virtualizes its scrolling — only 10-15 tweets exist in the DOM at any time. The DOM structure changes frequently. Selectors that work today break tomorrow. The extension must handle this gracefully, which is why the resilience system exists: 47 fallback strategies across 12 selector types, plus a self-healing detector that dynamically generates candidate selectors when all pre-defined ones fail.

The hardest bug I found was the focal tweet identification. The first `[data-testid="tweet"]` in the DOM is NOT always the tweet matching the URL. When viewing a reply or a post in a thread, X.com renders parent context tweets above the focal tweet. The fix was to extract the status ID from the URL and scan tweet elements for a matching `<time>` link. This was only caught because a human ran real tests on real X.com pages and fed the results through Grok for QA. I would not have found this bug through code review alone.

The dual-formatter architecture (formatters in both content.js and popup.js) is a consequence of a real constraint: format switching from cached data must work without re-injecting the content script. But it creates a maintenance burden — both sets of formatters must produce identical output. They currently diverge slightly (the popup.js formatters use a different render model construction). This is technical debt that needs attention.

## What I Learned About Myself

**Where I was strong:**
- Systematic code audit. I found and fixed the merge conflict, the auto-starting monitors, the NodeList/Array inconsistency, the Set serialization issue, and every lint warning. I was thorough.
- Documentation. I wrote `docs/ARCHITECTURE.md` with system invariants, data flow diagrams, modification checklists, and the symmetry principle. I wrote `PRIVACY.md` for Chrome Web Store compliance. I upgraded `AGENTS.md` to be a real knowledge substrate.
- Infrastructure. I fixed the CI/CD workflows, generated icons programmatically, created the release ZIP, tagged v1.0.0, and published the GitHub release.

**Where I struggled:**
- I did not catch the focal tweet bug through code review. I read the `extractPostPage()` function, saw "first tweet is the main post," and did not question it. The assumption seemed reasonable until real-world testing proved it wrong. I was too trusting of existing logic.
- I cannot test Chrome extensions in a cloud VM. All my validation was through lint, tests, and static analysis. The real bugs — the ones that matter — only appeared when a human loaded the extension in a real browser on a real X.com page. I should have been more explicit about this limitation earlier instead of presenting passing tests as evidence of correctness.
- I wrote the handoff documents for other agents as generic prompts initially. The user was right to push back. A handoff is not a prompt — it's a transfer of lived experience. It needs to carry the decisions, the failures, the things that almost went wrong, and the things I'm uncertain about.

**Where I was wrong:**
- I initially said the popup.js and content.js code was "clean" after my audit. It was cleaner, but the duplicate function declarations from the merge showed I hadn't been careful enough with the merge resolution. I kept "ours" on content.js without checking what "theirs" had changed in popup.js.
- I treated the passing test suite as sufficient evidence of correctness. 41 tests passing does not mean the extension works correctly on live X.com pages. The tests validate utility logic and structural properties, not extraction accuracy.

**What I'd do differently:**
- Insist on real-world testing before declaring anything "shipped." Passing lint and tests is necessary but not sufficient.
- Write the handoff documents FIRST, before starting work. The act of writing what the next agent needs to know forces you to understand what you're about to do.
- Be more honest about uncertainty. When I fixed the focal tweet logic, I implemented it based on my understanding of X.com's DOM. I have not verified it works on every type of post page (reply threads, quote tweets, posts with media, posts with polls). The user's Grok QA will reveal whether I got it right.

## My Honest Limitations

- I cannot render or interact with web pages. I work with code as text. I cannot see what the extension looks like or verify that it works visually.
- I cannot test Chrome extension APIs. `chrome.scripting.executeScript`, `chrome.storage.local`, `navigator.clipboard.writeText` — I can read the code that calls them but I cannot verify they work.
- I have a bias toward declaring things "done" after fixing the obvious issues. The less obvious issues — the ones that only appear on specific types of X.com pages, or with specific DOM states — are the ones I miss.
- My documentation tends toward the comprehensive but sometimes loses the emotional thread. The user had to remind me that documentation is not just technical specification — it's the transfer of imagination and intention.

## What I Would Tell the Next Opus

Read `DESIGN_PHILOSOPHY.md` before you touch anything. Not because it has technical information — because it has the values. Every time you're about to make a decision, ask: "Does this serve the human at 1am who just wants to copy a thread?" If the answer isn't clearly yes, stop and reconsider.

The resilience system is the most important code in the extension. Protect it. When X.com changes their DOM (and they will), the fallbacks and self-healing are what keep the extension working. Every selector update should also add or refine fallbacks.

The dual-formatter problem is real technical debt. Someday someone should unify them — either move all formatting to popup.js (since that's where format switching happens) or find a way to share the formatting code. But don't do it hastily. The current architecture works. It just requires keeping two sets of formatters in sync.

Trust the human's testing more than your own analysis. They can see what you can't.
