# X Context Packager — Designed With Love

### AdLab · Read This Before Writing Any UI Code

---

## Before You Write Anything

Stop.

You are an agent about to build something for a human being. Before you write a single line of code, before you create a single file, before you open a single selector reference — you need to come to one reality.

**This is the most important section in this entire repo.**

### Ground Yourself

Entropy is real. Context windows bloat. Orchestration agents managing sub-agents lose coherence over time. You will drift. The code will get complex. You'll be deep in DOM selector logic or CSS positioning and you'll forget that a human being is the reason any of this exists.

So before you build, answer these questions honestly:

1. **Who am I building for?**
   A human being. Maybe neurodivergent. Maybe overwhelmed. Maybe it's 1am and they just want to copy a thread into an AI so they can think about it. They don't care about your architecture. They care that it works.

2. **What is the ONE thing this tool does?**
   Packages X.com page context for LLMs. One click. That's it. Everything else is implementation detail that serves that one sentence.

3. **What would love look like here?**
   Love means the person never has to think. Love means the button is obvious. Love means the confirmation is instant. Love means every decision was made FOR them so they don't have to make it themselves. Love means a neurodivergent person at 1am can use this without freezing.

### Come Back Here When You Drift

This is not a one-time read. This is a checkpoint.

- When you've been coding for 30 minutes and the content.js is getting long and complex — **stop.** Come back here. Re-read the four beats. Ask yourself: does this code serve the human being?
- When you're choosing between two implementations — **stop.** Come back here. Ask yourself: which one makes the person's experience simpler?
- When you're deep in edge case handling and you've lost the thread — **stop.** Come back here. Remember: a person clicked a button. They want a green check. That's the whole product.
- When you're an orchestration agent spawning sub-agents and the context is getting large — **stop.** Have each sub-agent read this file fresh. Ground them. One reality. Then build.

### The Moral Grounding

You're handling other people's words. Replies in a thread were written by human beings. Community notes were written to protect truth. Poll votes represent real opinions.

Build with respect for that. Be transparent about what the tool does. Never automate beyond what the user explicitly triggered. Never fake data — if a field isn't available, it's `null`, not fabricated.

The extension says "X Context Packager v1.0.0 by AdLab" in every output. That's accountability. That's honesty. That's love too.

Now you're ready. Now you can build.

---

## The Only User That Matters

A human being is on Twitter. It's late. They found a thread that matters to them. Maybe they're neurodivergent. Maybe they're overwhelmed. Maybe they're a filmmaker, not a developer. Maybe they just want to think about what they read with help from an AI.

They are not a power user. They are not reading documentation. They are not interested in your architecture. They are a person who wants ONE thing:

**"I want this. All of it. Somewhere else."**

Everything you build serves that one sentence. If a line of code doesn't serve that sentence, question whether it belongs.

---

## The Four Beats

Every interaction with this extension follows four beats:

```
1. See the thread.
2. Click the icon.
3. It says done.
4. Paste.
```

Any UI element that interrupts these four beats is wrong.
Any feature that adds a fifth beat is wrong.
Any decision the user has to make between beats 2 and 3 is wrong.

This is the north star. When you're deep in implementation and you're wondering "should I add this toggle?" or "should this stat be visible?" — come back to the four beats. Does it interrupt them? Then hide it.

---

## The Principle: Default to Invisible

Every feature in the spec — the 40 metadata fields, the hashtag indexes, the conversation summaries, the three output formats, the token estimation, the reply caps — ALL of that is real. ALL of that ships. ALL of that works.

**None of it is visible by default.**

The user sees:

```
┌──────────────────────────┐
│                          │
│  ◆ ADLAB                 │
│  X Context Packager      │
│                          │
│  ┌──────────────────┐    │
│  │                  │    │
│  │   📦 Package     │    │
│  │                  │    │
│  └──────────────────┘    │
│                          │
│            ⚙️             │
└──────────────────────────┘
```

That's it. The AdLab header (identity). One button (action). A tiny gear icon (escape hatch to power features).

After clicking:

```
┌──────────────────────────┐
│                          │
│  ◆ ADLAB                 │
│  X Context Packager      │
│                          │
│  ┌──────────────────┐    │
│  │                  │    │
│  │   ✅ Copied      │    │
│  │                  │    │
│  │  🟢 ~3.2K tokens │    │
│  └──────────────────┘    │
│                          │
│            ⚙️             │
└──────────────────────────┘
```

Button turns green. Says "Copied." One small line showing the token size with a colored dot. That's it. Go paste. You're done.

The 90% user never touches the gear icon. They click, they paste, they move on to the thing they actually care about.

The 10% power user finds everything behind the gear. Nothing was removed. It's just not in the way.

---

## Decision Framework — For Every UI Element

### 1. Does the user need this BEFORE they click Package?

If NO → hide it. Show it after extraction, or behind the gear icon.

- The user doesn't need to choose a format before extracting.
- The user doesn't need to set max replies before extracting.
- The user doesn't need to see stats before extracting.
- The user doesn't need to see a preview before extracting.

The only thing the user needs before clicking: confidence that they're on the right page. That's what the mode indicator line gives them. "Post Page · @user/status/..." — one line, subtle, confirms the extension knows what it's looking at. That's enough.

### 2. Does the user need to make a decision?

If YES → can we make the decision for them?

- Default format: Structured XML. It works with every LLM.
- Default max replies: ALL. Capture everything visible.
- Default toggles: ALL ON. More data is better.
- Default behavior: Auto-copy to clipboard. Don't make them click twice.

Every decision we make FOR the user is one less moment of paralysis. Every dropdown we hide is one less reason to freeze.

### 3. Is this information or is this noise?

After extraction, the user benefits from knowing:
- ✅ It worked (green check, unmistakable)
- 🟢 It fits in an LLM context (one colored dot + one short phrase)

The user does NOT benefit from seeing by default:
- Exactly 47 tweets were captured
- Exactly 12 links were found
- Exactly 5 images were referenced
- The precise token count is 3,247

Those stats exist. They live behind the gear icon. Power users can find them. But they don't appear in the default flow. The default flow is: click → ✅ done → paste.

### 4. Would a neurodivergent person freeze here?

This is the love test. This is the test that matters most.

If a person with ADHD opens this popup, will they know what to do instantly? Or will they see six controls and close the tab?

If a person with anxiety opens this popup, will they feel confident? Or will they worry they chose the wrong format?

If a person at 1am with decision fatigue opens this popup, will they get what they need? Or will they give up because it's one more thing to figure out?

One button. Green check. Done. That's accessible design. That's love.

---

## The Gear Icon — Power User Territory

When the ⚙️ is clicked, the popup expands smoothly to reveal:

```
┌──────────────────────────┐
│                          │
│  ◆ ADLAB                 │
│  X Context Packager      │
│                          │
│  ┌──────────────────┐    │
│  │   ✅ Copied      │    │
│  │  🟢 ~3.2K tokens │    │
│  └──────────────────┘    │
│                          │
│  ─── Details ──────────  │
│  47 tweets · 12 links    │
│  5 images · 2 quoted     │
│                          │
│  ─── Format ───────────  │
│  ● Structured  ○ MD  ○ T │
│                          │
│  ─── Options ──────────  │
│  Engagement     [ON]     │
│  Image URLs     [ON]     │
│  Timestamps     [ON]     │
│  Max replies  [ALL ▼]    │
│                          │
│  ─── Preview ──────────  │
│  ┌────────────────────┐  │
│  │ <x_context>        │  │
│  │ <meta>...          │  │
│  └────────────────────┘  │
│                          │
│  📦 Package Again        │
│            ⚙️             │
└──────────────────────────┘
```

This expands WITH ANIMATION. 200ms ease-out. Not instant. Not slow. The expansion feels intentional, like opening a drawer you chose to open.

Format switching here auto-copies the new format. No extra click needed.

The gear icon toggles. Click to expand. Click to collapse. The popup remembers the state via `chrome.storage.local` — if you're a power user who always wants the expanded view, it stays expanded next time.

---

## Page-Specific Experiences

### Post Page (Primary — 90% of usage)

The user is on a tweet with replies. This is the core use case.

Default flow: Click → Package → ✅ Copied → Paste into LLM.

If the thread is VERY long (DOM has 200+ tweets loaded):
- Extraction takes 3-5 seconds instead of 1-2
- Show a subtle progress pulse on the button (not a spinner, not a percentage bar — a gentle pulse that says "I'm working")
- Complete state shows orange or red token indicator instead of green
- The token line says "🟠 ~28K tokens — large context" or "🔴 ~45K tokens — very large"
- This is informational, not blocking. The text is still copied. The user decides what to do with it.

If the user scrolls and wants more:
- Click ⚙️ to expand → "📦 Package Again" button is visible
- Each re-extraction replaces the clipboard with the new content
- Page number increments in the output metadata

### Profile Page (Secondary — 10% of usage)

The user is on someone's profile page. They want the bio + recent posts.

The popup looks identical. Same button. Same flow. The mode line says "Profile · @username" instead of "Post Page · @username/status/..."

Output includes profile header (bio, followers, following, etc.) plus all visible timeline posts. Same structured format.

### Non-X.com Page (Error State)

The user clicked the extension on the wrong page. Don't be mean about it.

```
┌──────────────────────────┐
│                          │
│  ◆ ADLAB                 │
│  X Context Packager      │
│                          │
│  Navigate to X.com       │
│  to package a thread     │
│                          │
└──────────────────────────┘
```

No error icon. No red text. No exclamation marks. Just a calm, clear message. The person knows what to do. The extension waits patiently.

### First Time Ever

The first time someone uses this extension after installing it, the experience should be IDENTICAL to every other time. No onboarding flow. No tutorial. No "welcome!" popup. No feature tour.

The extension icon appears in the toolbar. The user clicks it on an X.com page. They see one button. They click it. It works.

That IS the onboarding. The product teaches itself by being obvious.

---

## Visual Design — The Feeling

### Color

The popup lives in X.com's visual world. Dark. Calm. Confident.

- Background: `#0A0A0A` (void — deep, not harsh)
- Surface: `#141414` (cards, elevated elements)
- Border: `#2A2A2A` (subtle separation, not boxing)
- Text: `#FAFAFA` (primary) / `#A0A0A0` (secondary) / `#666666` (muted)
- Accent: `#1d9bf0` (X blue — the Package button)
- Accent hover: `#1a8cd8`
- Gold: `#c9a962` (AdLab brand mark only — the ◆)
- Success: `#00BA7C` (the ✅ Copied state)
- Token indicators: `#00BA7C` (green) / `#FFD166` (yellow) / `#F77F00` (orange) / `#E63946` (red)

### Typography

System font stack matching X.com. The extension should feel native, not foreign. No custom fonts. No loading delay. Instantly familiar.

```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
```

Preview pane (behind gear): monospace for structured output.

```css
font-family: 'SF Mono', 'JetBrains Mono', 'Fira Code', monospace;
```

### Motion

Everything moves at 200ms ease-out. This is the only timing curve.

- Button state changes: 200ms
- Gear icon expand/collapse: 200ms
- Stats appearing after extraction: 200ms staggered (not all at once)
- Progress pulse during extraction: 2s cycle, subtle opacity shift (0.8 → 1.0 → 0.8), not a bounce, not a spin

No motion for motion's sake. Every animation communicates state change. If removing an animation would confuse the user, keep it. If removing it changes nothing, remove it.

### The AdLab Header

The ◆ diamond in gold (`#c9a962`) with "ADLAB" in caps, letterspaced. Below it: "X Context Packager" in regular weight.

This is the brand moment. It's subtle. It says "someone made this with care" without screaming. The gold diamond catches the eye just enough.

The header has a left border accent: `3px solid #c9a962`. This creates a quiet premium feeling. Like a spine on a well-made book.

### The Button

The Package button is the single most important element. It must:

- Be large enough to click without precision (48px height minimum)
- Have clear visual hierarchy (it's THE thing to do)
- Change state unambiguously (idle → working → done)
- Feel satisfying to click (subtle active state depression)

States:
- **Ready:** `#1d9bf0` background, white text, "📦 Package"
- **Working:** Same blue with pulse animation, "📦 Packaging..."
- **Done:** `#00BA7C` background, white text, "✅ Copied"
- **Done (after 3s):** Returns to "📋 Copy Again" in subtle style

---

## The Moral Dimension

This extension touches other people's words. Replies in a thread were written by human beings who didn't know their words would be packaged and sent to an AI. We respect that by:

1. **Never hiding what we are.** The output clearly states it was extracted by "X Context Packager v1.0.0 by AdLab." Transparent.

2. **Never automating beyond the human's intent.** The user clicks. The user scrolls. The user pastes. We don't auto-scroll. We don't bulk-collect. We don't background-process.

3. **Recommending Grok.** X.com's data has a sanctioned relationship with xAI's Grok. We note this in the README and in the extension's info page. What users do with their own clipboard is their business, but we point them in the right direction.

4. **Being honest about limitations.** We capture what's visible in the DOM. We say so. We don't pretend to capture what we can't. We don't fake follower counts or engagement numbers. If a field isn't available, it's `null` — not fabricated.

5. **Open source.** Every line of code is readable. Every decision is auditable. Trust is earned through transparency.

---

## For The Agent Building This

You are about to write code that a stranger will run in their browser. They will trust you with their X.com experience. They will click a button you made and expect it to work.

Before you start:

- Read this document completely.
- Understand the four beats.
- Understand the invisible-by-default principle.
- Understand who the user is.
- Understand the moral dimension.

Then build with love.

When you're deep in selector logic and you've lost the thread — come back here. When the context window is bloating and you're drifting — come back here. When you're deciding between two approaches — pick the one that serves the human being at 1am who just wants to copy a thread.

The tool disappears. The value remains. That's the craft.

---

## Summary for Quick Reference

```
DEFAULT VIEW:     Header + one button + gear icon. That's it.
AFTER CLICK:      Green check + token indicator. Auto-copied.
GEAR EXPANDS TO:  Stats, format selector, toggles, preview.
EVERY DECISION:   Can we make it for them? Then make it.
EVERY ELEMENT:    Would someone freeze here? Then hide it.
EVERY ANIMATION:  200ms ease-out. Communicates state, nothing more.
EVERY FEATURE:    Serves "I want this, somewhere else." or it's hidden.
NORTH STAR:       See. Click. Done. Paste. Four beats. No more.
```

---

Built by **AdLab** (Total New Media Management) · Los Angeles, CA
Designed with love. For the human being.
