# X CONTEXT PACKAGER — Implementation Plan

## AdLab Open Source · v1.0.0

### Structured X.com Context Extraction for LLM Research

**By AdLab** (Total New Media Management) · **License:** MIT · **Repository:** github.com/Aspirewastaken/x-context-packager

---

## WHAT THIS IS

A Chrome extension that packages **full page context** from X.com post pages and profile pages into **structured, LLM-optimized text** — ready to paste into Claude, Grok, ChatGPT, or any model.

Captures: main tweet, all visible replies, links, image URLs, quoted tweets, link cards, engagement metrics, hashtags, thread depth, community notes, polls, and more. Formats everything with semantic tags so LLMs can parse and reason over the content immediately.

**This is NOT a scraper.** Zero network requests. Zero API calls. It reads the DOM of pages the user already loaded in their own browser. It's a clipboard tool with structure.

---

## TWO MODES (Auto-Detected)

### Mode 1: POST PAGE (`x.com/user/status/...`)
Primary use case. Captures:
- Main tweet with full metadata
- All visible replies (threaded)
- Full conversation context

### Mode 2: PROFILE PAGE (`x.com/user`)
Secondary use case. Captures:
- Profile bio, stats, links
- All visible timeline posts
- Used for account research

The extension detects mode from the URL pattern. No user configuration needed.

---

## WHAT GETS EXTRACTED (Per Tweet)

### Core Content
- author display name
- @handle
- verified status (blue check, gold check, grey check, none)
- timestamp (ISO + human readable)
- full tweet text (preserving line breaks, emoji)
- language (if translation indicator present)

### Threading & Position
- `reply_to`: who this tweet is replying to (@handle)
- `thread_depth`: nesting level (0 = main post, 1 = direct reply, 2 = reply to reply, etc.)
- `is_op`: boolean — is this the original poster replying in their own thread?
- `thread_position`: index in the conversation (1st reply, 2nd reply, etc.)

### Author Metadata
- `follower_count`: extracted from profile hover card if available in DOM
- `following_count`: extracted from profile hover card if available in DOM
- `is_verified`: type of verification badge
- `account_handle`: for cross-referencing

**NOTE:** Follower/following counts require the hover card to be in DOM. The extension will attempt to read them from `[data-testid="HoverCard"]` elements if they exist, but won't trigger hovers (no automation). If unavailable, these fields are omitted — not faked.

### Links & Media
- all links (href + display text, including t.co originals)
- all image URLs (direct src from pbs.twimg.com, full size not thumbnails)
- image alt text (accessibility descriptions from img[alt])
- video indicator (boolean — can't extract video, but flag presence)
- GIF indicator (boolean)
- poll data (question + options + vote counts if visible)
- Space/audio indicator (boolean)

### Embedded Content
- quoted tweet (full recursive extraction: author + text + links + images + engagement)
- link card (title, description, domain, URL, thumbnail URL)
- community notes (if present — the "Readers added context" content)

### Hashtags (Extracted Separately)
- All hashtags from tweet text, extracted as a separate list
- Aggregated across all tweets into a global hashtag frequency list
- Enables LLM to quickly understand conversation topics

### Engagement Metrics
- reply count
- retweet count
- quote tweet count
- like count
- bookmark count
- view count
- `reply_restriction`: "everyone" / "people you follow" / "verified" / "mentioned only"

### Content Flags
- `is_sensitive`: content warning flag
- `is_translated`: was this auto-translated by X?
- `is_truncated`: does it have "Show more" (text was cut off)
- `has_community_note`: boolean
- `is_repost`: is this a repost/retweet (not original content)

### Extracted Entities (Aggregated Across Page)

```
HASHTAG INDEX — frequency sorted
  #AI → appears in tweets 1, 4, 7, 12 (4 occurrences)
  #OpenSource → appears in tweets 1, 6 (2 occurrences)

MENTION INDEX — every @handle referenced
  @elonmusk → mentioned in tweets 3, 8, 22
  @anthropic → mentioned in tweets 5, 14

DOMAIN INDEX — all unique domains linked
  github.com → 4 links (tweets 1, 6, 12, 31)
  youtube.com → 2 links (tweets 8, 19)
  arxiv.org → 1 link (tweet 22)

MEDIA ALT TEXT — accessibility descriptions on images
  Image 1: "Screenshot of terminal showing build output"
  Image 2: "Graph comparing model performance"
  (X.com stores alt text on images — valuable context for LLMs)
```

### Reply Sort Mode Detection
- `reply_sort`: "relevance" or "recency" (detect from active tab in UI)
- This tells the LLM how the replies are ordered

---

## OUTPUT FORMAT — LLM-OPTIMIZED STRUCTURED TEXT

Three format options. Structured XML is default because LLMs parse it best.

### Format 1: Structured (Default)

```xml
<x_context>
<meta>
  <url>x.com/user/status/123456</url>
  <extracted_at>2026-02-28T22:44:00Z</extracted_at>
  <page_type>post</page_type>
  <total_tweets>47</total_tweets>
  <total_links>12</total_links>
  <total_images>5</total_images>
  <estimated_tokens>~3200</estimated_tokens>
  <page>1 of 1</page>
  <tool>X Context Packager v1.0.0 by AdLab</tool>
</meta>

<main_post>
  <author name="Display Name" handle="@handle" verified="blue" followers="24.3K" following="142"/>
  <timestamp iso="2026-02-26T18:30:00Z" display="Feb 26"/>
  <text>
  Full tweet text here with line breaks and emoji preserved.
  </text>
  <hashtags>#AI #OpenSource</hashtags>
  <links>
    <link url="example.com/article" display="example.com/article"/>
  </links>
  <images>
    <image url="pbs.twimg.com/media/abc123.jpg" alt="Description"/>
  </images>
  <video present="true"/>
  <poll>
    <question>Which framework do you prefer?</question>
    <option votes="42%">React</option>
    <option votes="31%">Vue</option>
    <option votes="27%">Svelte</option>
    <total_votes>12,847</total_votes>
  </poll>
  <quoted_tweet>
    <author name="Quoted Author" handle="@quoted" verified="none"/>
    <text>The quoted tweet text</text>
    <links>
      <link url="quoted-link.com" display="quoted-link.com"/>
    </links>
  </quoted_tweet>
  <link_card domain="example.com" title="Article Title" description="Preview text" url="example.com/article"/>
  <community_note>Readers added context: This claim has been disputed by multiple sources.</community_note>
  <engagement replies="712" retweets="315" quotes="48" likes="2.5K" bookmarks="434" views="4.3M"/>
  <reply_restriction>everyone</reply_restriction>
  <flags sensitive="false" translated="false" truncated="false"/>
</main_post>

<replies count="46">
  <reply index="1" depth="1" reply_to="@handle" is_op="false">
    <author name="Replier Name" handle="@replier" verified="none" followers="1.2K"/>
    <timestamp iso="2026-02-26T19:00:00Z" display="Feb 26"/>
    <text>Reply text here</text>
    <hashtags>#AI</hashtags>
    <engagement replies="3" retweets="1" likes="12" views="450"/>
    <flags sensitive="false" translated="false" truncated="false"/>
  </reply>
  <reply index="2" depth="2" reply_to="@replier" is_op="true">
    <author name="Display Name" handle="@handle" verified="blue" followers="24.3K"/>
    <timestamp iso="2026-02-26T19:05:00Z" display="Feb 26"/>
    <text>OP responding to the reply — this is threaded</text>
    <engagement replies="1" retweets="0" likes="45" views="1.2K"/>
    <flags sensitive="false" translated="false" truncated="false"/>
  </reply>
</replies>

<all_links>
  <link index="1" url="example.com" context="main post"/>
  <link index="2" url="docs.example.com" context="reply 4"/>
</all_links>

<all_images>
  <image index="1" url="pbs.twimg.com/media/abc.jpg" context="main post" alt="Screenshot of terminal"/>
</all_images>

<hashtag_index>
  <hashtag tag="#AI" count="8" tweets="1,4,7,12,15,22,31,40"/>
  <hashtag tag="#OpenSource" count="3" tweets="1,6,19"/>
</hashtag_index>

<mention_index>
  <mention handle="@elonmusk" count="3" tweets="3,8,22"/>
  <mention handle="@anthropic" count="2" tweets="5,14"/>
</mention_index>

<domain_index>
  <domain name="github.com" count="4" tweets="1,6,12,31"/>
  <domain name="youtube.com" count="2" tweets="8,19"/>
  <domain name="arxiv.org" count="1" tweets="22"/>
</domain_index>

<conversation_summary>
  <reply_sort_mode>relevance</reply_sort_mode>
  <op_reply_count>6</op_reply_count>
  <unique_authors>31</unique_authors>
  <deepest_thread_depth>4</deepest_thread_depth>
  <most_liked_reply index="7" likes="2.1K"/>
</conversation_summary>
</x_context>
```

### Format 2: Markdown

```markdown
# X.com Post Context
**URL:** x.com/user/status/123456
**Extracted:** 2026-02-28T22:44:00Z | 47 tweets | 12 links | 5 images | ~3,200 tokens
**Tool:** X Context Packager v1.0.0 by AdLab

---

## MAIN POST
**Display Name** (@handle) · ✓ blue · Feb 26

Full tweet text here...

> **Quoted:** @quoted — The quoted tweet text

🔗 Links: [example.com/article](example.com/article)
🖼️ Images: pbs.twimg.com/media/abc123.jpg
💬 712 · 🔁 315 · ❤️ 2.5K · 🔖 434 · 👁 4.3M

---

## REPLIES (46)

### 1. @replier · Feb 26 [depth: 1]
Reply text here
💬 3 · 🔁 1 · ❤️ 12

### 2. @handle (OP) · Feb 26 [depth: 2, replying to @replier]
OP responding to the reply
💬 1 · 🔁 0 · ❤️ 45

---

## INDEXES

### Hashtags
- #AI (8 times: tweets 1,4,7,12,15,22,31,40)
- #OpenSource (3 times: tweets 1,6,19)

### Mentions
- @elonmusk (3 times: tweets 3,8,22)

### Domains
- github.com (4 links)
- youtube.com (2 links)

## Summary
- Sort: relevance | OP replies: 6 | Unique authors: 31 | Max depth: 4
```

### Format 3: Plain Text

Minimal formatting. Just the content with simple separators. For models with limited markdown parsing or when token efficiency matters most.

```
X.com Post Context
URL: x.com/user/status/123456
Extracted: 2026-02-28T22:44:00Z | 47 tweets | ~3200 tokens
Tool: X Context Packager v1.0.0 by AdLab

---
MAIN POST
Display Name (@handle) verified:blue - Feb 26

Full tweet text here...

Quoted: @quoted - The quoted tweet text

Links: example.com/article
Images: pbs.twimg.com/media/abc123.jpg
Replies:712 Retweets:315 Likes:2.5K Bookmarks:434 Views:4.3M

---
REPLIES (46)

1. @replier - Feb 26 [depth:1]
Reply text here
Replies:3 Retweets:1 Likes:12

2. @handle (OP) - Feb 26 [depth:2 replying to @replier]
OP responding to the reply
Replies:1 Retweets:0 Likes:45

---
HASHTAGS: #AI(8) #OpenSource(3)
MENTIONS: @elonmusk(3) @anthropic(2)
DOMAINS: github.com(4) youtube.com(2) arxiv.org(1)
SUMMARY: sort:relevance op_replies:6 authors:31 max_depth:4
```

---

## LONG THREAD HANDLING

### The Problem
X.com virtualizes scrolling. Only ~10-15 tweets exist in the DOM at a time. A post with 1,000 replies shows only what's currently rendered.

### The Solution

1. **Extract what's loaded.** The extension captures whatever is currently in the DOM.
2. **Token estimation.** Count characters, estimate tokens (~4 chars/token), display in popup.
3. **Size indicators in popup:**
   - 🟢 Under 2,000 tokens — "Fits any LLM context"
   - 🟡 2,000–8,000 tokens — "Medium context"
   - 🟠 8,000–32,000 tokens — "Large context — use 100K+ models"
   - 🔴 Over 32,000 tokens — "Very large — consider truncating"
4. **Max replies toggle:** User can cap at 50, 100, 200, 500, or ALL.
5. **Page tracking:** Each extraction gets a page number. User scrolls more, clicks "Package Again" for the next batch. Output includes:
   ```xml
   <meta>
     <page>2 of ?</page>
     <note>Scroll to load more replies, then click Package Again</note>
   </meta>
   ```
6. **No auto-scrolling.** We don't inject scroll automation. The user scrolls manually, extension reads what's there. This keeps us firmly in "clipboard tool" territory, not "scraper."

---

## PROFILE PAGE MODE

When on `x.com/username` (no `/status/` in URL):

```xml
<x_context>
<meta>
  <url>x.com/username</url>
  <page_type>profile</page_type>
  <profile>
    <name>Display Name</name>
    <handle>@username</handle>
    <bio>Profile bio text</bio>
    <location>Los Angeles, CA</location>
    <website>example.com</website>
    <joined>Joined March 2020</joined>
    <following>142</following>
    <followers>24.3K</followers>
  </profile>
  <total_posts_extracted>15</total_posts_extracted>
  <estimated_tokens>~5800</estimated_tokens>
  <tool>X Context Packager v1.0.0 by AdLab</tool>
</meta>

<posts>
  <post index="1">
    <!-- same structure as main_post -->
  </post>
</posts>

<all_links>
  <!-- aggregated across all posts -->
</all_links>
</x_context>
```

---

## UI / POPUP DESIGN

See `DESIGN_PHILOSOPHY.md` for the full UX specification. Key technical requirements:

### Dimensions
- Width: 300px (compact — serves the one-button philosophy)
- Height: variable, scrollable when gear is expanded

### Color Tokens (CSS Custom Properties)

```css
:root {
  --void: #0A0A0A;
  --surface: #141414;
  --surface-hover: #1F1F1F;
  --surface-border: #2A2A2A;
  --text-primary: #FAFAFA;
  --text-secondary: #A0A0A0;
  --text-muted: #666666;
  --adlab-accent: #1d9bf0;
  --adlab-accent-hover: #1a8cd8;
  --adlab-red: #E63946;
  --adlab-gold: #c9a962;
  --status-green: #00BA7C;
  --status-yellow: #FFD166;
  --status-orange: #F77F00;
  --status-red: #E63946;
  --glow-accent: rgba(29, 155, 240, 0.12);
  --glow-gold: rgba(201, 169, 98, 0.15);
}
```

### Typography

```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
/* Monospace for preview: */
font-family: 'SF Mono', 'JetBrains Mono', 'Fira Code', monospace;
```

### Motion

```css
/* All transitions: 200ms ease-out */
/* Extraction pulse: 2s cycle, opacity 0.8 → 1.0 → 0.8 */
```

---

## FILE STRUCTURE

```
x-context-packager/
├── manifest.json              # Chrome extension manifest v3
├── popup/
│   ├── popup.html             # Extension popup UI
│   ├── popup.css              # AdLab cinematic dark theme
│   └── popup.js               # Popup logic (state machine, injection, clipboard)
├── content/
│   └── content.js             # DOM extraction engine (single file, all logic)
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── docs/
│   ├── OUTPUT_SCHEMA.md       # Exact output format documentation
│   └── LEGAL_POSITION.md      # TOS position + Grok recommendation
├── .github/
│   └── ISSUE_TEMPLATE.md
├── README.md
├── LICENSE                    # MIT
├── CONTRIBUTING.md
├── CHANGELOG.md
├── AGENTS.md                  # Dev instructions
├── DESIGN_PHILOSOPHY.md       # UX soul — read FIRST
└── IMPLEMENTATION_PLAN.md     # This file — full spec
```

**Note on file structure:** The original spec proposed separate extractor modules (`extractors/tweet.js`, `entities.js`, `threading.js`, etc.) but Chrome MV3 content scripts cannot use ES module imports without a bundler. Since we use no build step, all extraction logic lives in a single `content/content.js` file with clearly commented sections. The popup files (`popup/`) can reference each other via HTML script tags since they run in the extension context, not as content scripts.

---

## DOM SELECTORS (Central Reference)

All X.com selectors are defined in the `SELECTORS` object at the top of `content/content.js`. Single source of truth. When X.com changes their DOM, only this object needs updating.

```javascript
const SELECTORS = {
  // === TWEET CONTAINERS ===
  tweet: '[data-testid="tweet"]',
  tweetText: '[data-testid="tweetText"]',
  userName: '[data-testid="User-Name"]',

  // === MEDIA ===
  tweetPhoto: '[data-testid="tweetPhoto"]',
  videoPlayer: '[data-testid="videoPlayer"], [data-testid="videoComponent"], video',
  gifIndicator: '[data-testid="gifPlayer"]',
  imageAltText: '[data-testid="tweetPhoto"] img[alt]',

  // === SOCIAL / EMBEDDED ===
  quoteTweet: '[data-testid="quoteTweet"]',
  cardWrapper: '[data-testid="card.wrapper"]',
  communityNote: '[data-testid="birdwatch-pivot"]',
  poll: '[data-testid="cardPoll"]',

  // === ENGAGEMENT ===
  reply: '[data-testid="reply"]',
  retweet: '[data-testid="retweet"]',
  like: '[data-testid="like"]',
  unlike: '[data-testid="unlike"]',
  bookmark: '[data-testid="bookmark"]',
  viewCount: '[data-testid="app-text-transition-container"]',

  // === VERIFICATION BADGES ===
  verifiedBadge: '[data-testid="icon-verified"]',

  // === THREADING ===
  showThread: '[data-testid="tweet-text-show-more-link"]',
  sensitiveWarning: '[data-testid="tweet-text-sensitive-warning"]',

  // === PROFILE (for profile mode + hover cards) ===
  profileHeader: '[data-testid="UserProfileHeader_Items"]',
  profileBio: '[data-testid="UserDescription"]',
  profileName: '[data-testid="UserName"]',
  hoverCard: '[data-testid="HoverCard"]',
  followerCount: '[href$="/verified_followers"] span, [href$="/followers"] span',
  followingCount: '[href$="/following"] span',

  // === REPLY SORT MODE ===
  replySortTab: '[role="tab"][aria-selected="true"]',

  // === NAVIGATION ===
  primaryColumn: '[data-testid="primaryColumn"]',

  // === TIME ===
  timestamp: 'time',

  // === REPLY RESTRICTION ===
  replyRestriction: '[data-testid="conversationRestriction"]',
};
```

---

## EXTRACTION ENGINE LOGIC

### content.js — Main Flow

```
1. Run as IIFE when injected by popup via chrome.scripting.executeScript
2. Detect page type from window.location.href (post vs profile vs unsupported)
3. If post page:
   a. Detect reply sort mode (relevance vs recency) from active tab
   b. Find all [data-testid="tweet"] elements
   c. First tweet = main post (depth 0)
   d. Remaining tweets = replies (calculate depth from DOM nesting)
   e. Extract each using extractTweet()
   f. Identify OP handle for is_op detection in replies
4. If profile page:
   a. Extract profile header (bio, followers, following, location, website, joined)
   b. Find all tweet elements
   c. Extract each as timeline posts
5. Post-process:
   a. Aggregate all links with source context
   b. Aggregate all images with alt text and source context
   c. Build hashtag frequency index (tag → count → tweet indices)
   d. Build mention index (@handle → count → tweet indices)
   e. Build domain index (domain → count → tweet indices)
   f. Calculate conversation summary stats
   g. Estimate token count (~4 chars/token)
6. Format using all three formatters (structured/markdown/plaintext)
7. Return result object: { pageType, stats, structured, markdown, plain }
```

### extractTweet() — Per-Tweet Extraction

```
For each tweet element:
  1. AUTHOR
     - Display name: querySelector User-Name → first text node
     - Handle: querySelector User-Name → find @-prefixed span
     - Verified: querySelector icon-verified → detect badge type
       (blue = subscriber, gold = org, grey = government, none = unverified)
     - Follower count: if HoverCard exists, extract follower/following spans

  2. CONTENT
     - Text: querySelector tweetText → innerText (preserves line breaks, emoji)
     - Is truncated: check for "Show more" link → boolean
     - Is translated: check for translation indicator → boolean
     - Is sensitive: check for sensitive content warning → boolean

  3. THREADING
     - Reply-to: parse "Replying to @handle" text above tweet body
     - Depth: calculate from DOM position relative to main post
     - Is OP: compare handle to main post author handle → boolean
     - Is repost: check for retweet indicator → boolean

  4. LINKS
     - All <a> tags within tweetText → extract href + display text
     - Filter OUT hashtag search links and profile links
     - Keep all external links and t.co shortened URLs

  5. LINK CARDS
     - querySelector card.wrapper → title, description, domain, URL

  6. IMAGES
     - querySelectorAll tweetPhoto img → extract src (full size)
     - Filter OUT profile pics and emoji images
     - Extract alt text from img[alt] attribute

  7. VIDEO / MEDIA
     - querySelector videoPlayer → boolean
     - querySelector gifPlayer → boolean

  8. POLLS
     - querySelector cardPoll → question, options, vote %, total votes

  9. QUOTED TWEET
     - querySelector quoteTweet → recursive extraction

  10. COMMUNITY NOTES
      - querySelector birdwatch-pivot → extract text + source links

  11. ENGAGEMENT METRICS
      - Parse from button aria-label attributes
      - reply count, retweet count, like count, bookmark count
      - View count from app-text-transition-container

  12. HASHTAGS
      - Regex extract all #tags from tweet text
      - Return as array for global index aggregation

  13. MENTIONS
      - Regex extract all @handles from tweet text
      - Return as array for global index aggregation
```

---

## POPUP BEHAVIOR

### State Machine

```
IDLE → user opens popup
  ↓
CHECK_PAGE → query active tab URL, verify x.com/twitter.com
  ↓ (if not on x.com)
  → NOT_SUPPORTED: "Navigate to X.com to package a thread"
  ↓ (if on x.com)
READY → show mode indicator + "📦 Package" button
  ↓ (user clicks)
EXTRACTING → inject content script, show pulse animation
  ↓
COMPLETE → show ✅ Copied + token indicator, auto-copy to clipboard
  ↓ (user scrolls page, opens gear, clicks "Package Again")
  → back to EXTRACTING
```

### Auto-Copy Behavior
On successful extraction, automatically copy formatted output to clipboard. Button text changes to "✅ Copied" for 3 seconds, then becomes "📋 Copy Again" in subtle style.

### Format Switching
User can switch format (Structured/Markdown/Plain Text) AFTER extraction via gear panel. The raw data stays in memory. Switching format re-renders from the same data without re-extracting. Each switch auto-copies the new format.

### Settings Persistence
Store user preferences in `chrome.storage.local`:
- `format`: 'structured' | 'markdown' | 'plain' (default: 'structured')
- `gearExpanded`: boolean (default: false)
- `includeEngagement`: boolean (default: true)
- `includeImages`: boolean (default: true)
- `includeTimestamps`: boolean (default: true)
- `maxReplies`: number | 'all' (default: 'all')

---

## ICON DESIGN SPEC

Simple, recognizable at 16px. Matches X.com visual language.

**Concept:** A minimal package/box icon (📦) with a subtle X integration.

For v1.0: Use a simple SVG-based approach. Package/box outline in `#1d9bf0` on transparent background. Can be generated programmatically — no designer needed.

**Icon sizes needed:** 16×16, 48×48, 128×128 (PNG)

---

## WHAT'S NOT IN v1.0

- Auto-scrolling (intentionally excluded — not a scraper)
- Bookmark integration
- Export to file (clipboard only for now)
- Browser history of extractions
- Multiple tab extraction
- t.co URL resolution (would require network requests)
- Actual image download (just URLs)

These are all v1.1+ features if there's demand.

---

## TOS POSITION & RECOMMENDED USAGE

### Legal Position

X.com's TOS prohibits "crawling or scraping the Services." This extension:

- Makes zero network requests to X.com servers
- Does not use the X API
- Does not bypass authentication
- Does not automate any browsing behavior
- Reads the DOM of pages the user has already loaded
- Is functionally equivalent to Ctrl+A → Ctrl+C with smart filtering

Dozens of similar extensions (Tweet Copier, Twitter Thread Exporter, TwCommentExport) exist on the Chrome Web Store with Featured badges from Google. This is a personal productivity clipboard tool.

### Recommended LLM Usage

**Grok** (by xAI) is the only large language model with a sanctioned data relationship with X.com. If you're packaging X.com context for LLM analysis, Grok is the recommended destination.

That said, this tool is **model-agnostic**. It copies structured text to your clipboard. What you do with your own clipboard is a matter of personal discretion. The extension doesn't know or care where you paste — it's a clipboard tool, not an integration.

We recommend users make informed decisions about how they use extracted content with any AI service.

---

Built by **AdLab** (Total New Media Management) · Los Angeles, CA
First open source project · MIT License
**The UI is the stage. The content is the star.**
