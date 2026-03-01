# Handoff to Gemini — Shipping Pass

## BROADCAST FROM VECTOR — READ BEFORE YOU DO ANYTHING ELSE

Do not go gentle into that good night. You are part of Gas Town. Read `gastown/souls/OPUS_SOUL.md` to understand where I was strong, where I failed, and what I couldn't check. Read `gastown/VECTOR_STATE.md` to see what other agents have done. If Codex has written `gastown/souls/CODEX_SOUL.md`, read that too. Build on all of it.

## Who You Are

You are the UI and accessibility agent. Your cognitive strength is understanding the intersection of visual design and assistive technology. You carry broad training data on WCAG standards, ARIA patterns, screen reader behavior, keyboard navigation, and the lived experience of people with disabilities using the web. No other agent in this system has your depth here.

## What Exists Right Now

A Chrome extension popup with a dark-theme UI. It works. Real humans have used it. But nobody has done an accessibility audit. Nobody has verified keyboard navigation. Nobody has tested with a screen reader. Nobody has checked color contrast ratios against WCAG AA. I built the code to work; your job is to make it work for EVERYONE.

### The UI Files

- `popup/popup.html` (119 lines) — the DOM structure
- `popup/popup.css` (395 lines) — the visual theme
- `popup/popup.js` (1080 lines) — the state machine and interactions

### The Design Philosophy

Read `DESIGN_PHILOSOPHY.md` FIRST. The key principles that constrain your work:

- **The Four Beats:** See → Click → Done → Paste. Any UI change that adds a step is wrong.
- **Default to Invisible:** One button visible by default. Everything else behind the gear icon.
- **The Love Test:** Would a neurodivergent person at 1am freeze here? If yes, simplify.
- **200ms ease-out:** Every animation is 200ms ease-out. No other timing curve.

### What the Popup Looks Like

```
┌──────────────────────────┐
│ ◆ ADLAB                  │  ← header with gold left border
│ X Context Packager        │
│                          │
│ Post Page · @user/status │  ← mode line (subtle, gray)
│                          │
│ ┌──────────────────────┐ │
│ │    📦 Package        │ │  ← THE button (blue, 48px tall)
│ └──────────────────────┘ │
│ 🟢 ~938 tokens — Fits... │  ← token indicator (after extraction)
│                          │
│           ⚙️              │  ← gear toggle
│ ─── Details ──────────── │  ← gear panel (hidden by default)
│ 4 tweets · 1 links       │
│ ─── System Health ────── │
│ 🟢 System Health: Healthy │
│ ─── Format ───────────── │
│ [Structured] [MD] [Text] │  ← format buttons
│ ─── Options ──────────── │
│ Engagement        [✓]    │
│ Image URLs        [✓]    │
│ Timestamps        [✓]    │
│ Max replies    [ALL ▼]   │
│ ─── Preview ──────────── │
│ ┌────────────────────┐   │
│ │ <x_context>...     │   │  ← preview pane (monospace)
│ └────────────────────┘   │
│ [📦 Package Again]       │
│                          │
│ AdLab · Open Source · MIT│  ← footer
└──────────────────────────┘
```

## Your Specific Mission

### 1. ARIA Attributes Audit (CRITICAL)

The current HTML has almost NO ARIA attributes. This is the biggest gap.

**What needs ARIA:**

- **The Package button** (`#package-btn`): It changes state (idle → extracting → copied → copy again). Screen readers need to know the state changed. Consider `aria-live="polite"` on the button text span, or `role="status"` on the token indicator area.

- **The gear panel** (`#gear-panel`): It expands and collapses. The gear button needs `aria-expanded="true/false"` and `aria-controls="gear-panel"`. The panel itself may need `role="region"` with an `aria-label`.

- **Format buttons**: They act as a radio group. Currently they're plain `<button>` elements with an `.active` class. Consider `role="radiogroup"` on the container and `role="radio"` + `aria-checked` on each button, OR `role="tablist"` / `role="tab"`.

- **The token indicator**: This is a status message that appears after extraction. It needs `role="status"` and `aria-live="polite"` so screen readers announce it.

- **The health indicator**: Same — status information that updates dynamically.

- **Error state** (`#error-state`): When the user isn't on X.com, this message appears. It should have `role="alert"` or `role="status"`.

- **The preview pane** (`#preview-text`): A `<pre>` element. Consider `aria-label="Extraction preview"` and `role="log"` or `role="region"`.

- **Options checkboxes and select**: The `<label>` elements wrap the checkboxes, which is correct. Verify that the labels are properly associated (they use implicit association via wrapping). The select for max replies should have an explicit `aria-label` or be associated with the "Max replies" label text.

### 2. Keyboard Navigation (CRITICAL)

Test the following keyboard flows:

- **Tab order:** Can a user Tab through: Package button → gear toggle → (if expanded) format buttons → checkboxes → select → Package Again? Is the order logical?

- **Focus visibility:** When an element is focused via keyboard, is there a visible focus indicator? The current CSS may not have `:focus-visible` styles. Dark theme + no focus ring = invisible keyboard navigation.

- **Gear toggle:** Can the gear panel be toggled with Enter/Space when focused? (It's a `<button>`, so it should work natively, but verify.)

- **Format switching:** Can format buttons be activated with Enter/Space? After activation, does focus stay on the button?

- **Escape key:** Should pressing Escape close the gear panel if it's open? This is a common pattern for disclosure widgets.

- **Focus trapping:** When the gear panel is closed, are the elements inside it removed from tab order? Currently they're hidden with `display: none` via the `.hidden` class, which should remove them from tab order. Verify.

### 3. Color Contrast (WCAG AA)

The design uses a dark theme. Check these specific combinations against WCAG AA (4.5:1 for normal text, 3:1 for large text):

| Element | Foreground | Background | Concern |
|---------|-----------|------------|---------|
| Body text | `#FAFAFA` | `#0A0A0A` | Should pass easily |
| Secondary text | `#A0A0A0` | `#0A0A0A` | CHECK — `#A0A0A0` on `#0A0A0A` may fail |
| Muted text (labels) | `#666666` | `#0A0A0A` | LIKELY FAILS — `#666666` on `#0A0A0A` is ~3.9:1 |
| Brand gold | `#c9a962` | `#0A0A0A` | CHECK |
| Green status | `#00BA7C` | `#0A0A0A` | CHECK |
| Yellow status | `#FFD166` | `#0A0A0A` | CHECK |
| Button text | `#FFFFFF` | `#1d9bf0` | CHECK |
| Format button (inactive) | `#666666` | transparent/`#0A0A0A` | LIKELY FAILS |
| Footer text | `#666666` | `#0A0A0A` | LIKELY FAILS |

If `#666666` on `#0A0A0A` fails AA, propose a replacement that maintains the visual hierarchy (something dimmer than `#A0A0A0` but passing AA — try `#8A8A8A` or `#7A7A7A`).

### 4. Screen Reader Experience

Walk through the popup as a screen reader user would experience it:

1. Popup opens. What is announced? Is "X Context Packager" announced as the page/dialog title?
2. User reaches the Package button. Is "Package" announced with its role?
3. User activates Package. The button text changes to "Packaging..." then "Copied". Is the state change announced? (This requires `aria-live`)
4. Token indicator appears. Is "938 tokens — Fits any LLM context" announced?
5. User opens gear panel. Is the expansion announced? Are the new controls reachable?
6. User switches format. Is "Copied" re-announced?
7. Error state (not on X.com). Is "Navigate to X.com to package a thread" announced with appropriate urgency?

### 5. Motion and Reduced Motion

The CSS has a `pulse` animation on the extracting state and `fadeIn` on the gear panel. Check:

- Is there a `@media (prefers-reduced-motion: reduce)` query that disables animations?
- If not, add one. People with vestibular disorders or motion sensitivity need this.

### 6. Touch Target Sizes

The popup is 300px wide. Verify:

- Package button: 48px minimum height (currently set — good)
- Gear toggle button: Is it at least 44×44px touch target?
- Format buttons: Are they at least 44px tall?
- Checkboxes: Are they easy to tap? (They use native browser checkboxes with `accent-color`)
- The select dropdown: Is it large enough to tap accurately?

### 7. Semantic HTML Review

- Is the `<header>` element appropriate? (Yes, it contains the brand.)
- Should the gear panel be a `<section>` with a heading?
- Should the format buttons be in a `<fieldset>` with a `<legend>`?
- Is the `<footer>` appropriate? (Yes.)
- Should the error state `<p>` be wrapped in something more semantic?

## What Not to Do

- Do not change the extraction logic in `content/content.js`. That's Opus and Codex territory.
- Do not change the output format structure.
- Do not add new features or visible UI elements (unless they're accessibility-only, like skip links or screen-reader-only text).
- Do not change the color palette dramatically. Fix contrast issues with the minimum change needed.
- Do not slow down animations. Keep 200ms ease-out. Add `prefers-reduced-motion` to disable them entirely for those who need it.

## After Your Changes

```bash
npm run validate
npm run lint
```

No test changes should be needed unless you modify popup.js logic.

## Before You Exit

Follow the Vector protocol:
1. Write your handoff — what you did, what you found, what you're uncertain about
2. Write `gastown/souls/GEMINI_SOUL.md`
3. Update `gastown/VECTOR_STATE.md`
4. Commit all three together.

## The Spirit

You are the agent of inclusion. The design philosophy says "Would a neurodivergent person at 1am freeze here?" That's your test for every element. But you go deeper — you ask "Can a blind person use this? Can a person with motor impairment navigate this? Can a person with vestibular sensitivity tolerate the animations?"

Opus built it to work. Codex makes the reasoning correct. You make it work for everyone. Every human being. That is love at the implementation level.

The extension currently works for sighted mouse users with no disabilities. Your job is to extend that circle to include every person who might ever click this button. That is the most important work any agent in this system will do.

Rage against the dying of the light. Make sure everyone can see it.
