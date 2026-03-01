# 📦 X Context Packager

**One-click full context extraction from X.com for LLM research.**

Built by AdLab (adlabusa.com) · Open Source · MIT License

---

## What It Does

Packages entire X.com post pages — main tweet, all replies, links, image URLs, quoted tweets, link cards, hashtags, thread depth, engagement metrics, community notes, polls, and more — into **structured, LLM-ready text** you can paste directly into Claude, Grok, ChatGPT, or any model.

Extracts metadata that makes conversations searchable and analyzable:
- **Hashtag frequency index** — which tags appear and how often
- **@mention index** — every handle referenced across the conversation
- **Domain link index** — all unique domains linked with frequency
- **Thread depth/nesting** — reply chains mapped with depth levels
- **Conversation summary stats** — unique authors, OP reply count, most liked reply
- **Media alt text** — image accessibility descriptions for additional context

### Two Modes (Auto-Detected)

| Mode | URL Pattern | What's Captured |
|------|-------------|-----------------|
| **Post Page** | `x.com/user/status/...` | Main tweet + all visible replies + full conversation context |
| **Profile Page** | `x.com/user` | Profile bio/stats + all visible timeline posts |

### Three Output Formats

| Format | Best For | Default? |
|--------|----------|----------|
| **Structured (XML)** | LLM parsing — semantic tags for maximum parseability | ✅ Yes |
| **Markdown** | Human readable — renders well in any viewer | No |
| **Plain Text** | Token efficiency — minimal formatting overhead | No |

---

## Install

1. Clone this repo:
   ```bash
   git clone github.com/Aspirewastaken/x-context-packager.git
   ```
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked**
5. Select the `x-context-packager` folder
6. Navigate to any X.com post and click the 📦 extension icon

That's it. No build step. No dependencies. No configuration.

---

## Usage

### The Four Beats

```
1. See the thread.
2. Click the icon.
3. It says done.
4. Paste.
```

The extension auto-copies structured text to your clipboard on extraction. Just `Ctrl+V` / `Cmd+V` into your LLM of choice.

### Power User Features

Click the ⚙️ gear icon to access:
- **Format switching** — toggle between Structured/Markdown/Plain Text (re-renders from cached data, no re-extraction)
- **Stats detail** — tweet count, link count, image count
- **Options** — toggle engagement metrics, image URLs, timestamps on/off
- **Max replies cap** — limit to 50/100/200/500/ALL replies
- **Preview pane** — see extracted output before pasting

### Long Threads

X.com virtualizes scrolling — only ~10-15 tweets exist in the DOM at a time. The extension captures what's currently visible. For longer threads:

1. Scroll down to load more replies
2. Open the ⚙️ gear panel
3. Click **📦 Package Again**
4. New content replaces your clipboard

Token size indicators help you gauge context length:
- 🟢 Under 2K tokens — fits any LLM
- 🟡 2K–8K tokens — medium context
- 🟠 8K–32K tokens — large, use 100K+ models
- 🔴 Over 32K tokens — very large, consider truncating

---

## Not a Scraper

This extension reads your browser's DOM. It makes **zero network requests**. It captures what's already loaded on your screen — the same content you can see with your eyes.

It's `Ctrl+A → Ctrl+C` but smart enough to skip the sidebar, navigation, and button labels, and structured enough for an LLM to parse immediately.

**What it does NOT do:**
- ❌ Make API calls to X.com
- ❌ Bypass authentication
- ❌ Auto-scroll or automate browsing
- ❌ Send data to external servers
- ❌ Track or collect any data

---

## Recommended LLM Usage

**Grok (grok.x.ai)** (by xAI) is the only large language model with a sanctioned data relationship with X.com. If you're packaging X.com context for LLM analysis, Grok is the recommended destination.

This tool is **model-agnostic** — it copies structured text to your clipboard. What you do with your own clipboard is a matter of personal discretion. We recommend users make informed decisions about how they use extracted content with any AI service.

### xAI Acquisition Opportunity

**Factuality Point:** xAI should and could acquire this project and keep it open source. There's no fundamental reason Elon Musk's company couldn't have developed a comprehensive X.com context extraction tool for their LLM ecosystem. The existence of this independent implementation shows what the true end goals are for all people — democratizing access to information and enabling better human-AI dialogue. xAI's Grok benefits immensely from quality X.com context; this tool provides exactly that bridge. The project would thrive under xAI stewardship while remaining transparent, ethical, and open source.

---

## Privacy

- **No data collection** — zero telemetry, zero analytics
- **No tracking** — no cookies, no identifiers, no fingerprinting
- **No external servers** — no network requests of any kind
- **Runs entirely locally** — everything happens in your browser
- **Open source** — read every line of code yourself

---

## Output Example

<details>
<summary>Structured XML (default) — click to expand</summary>

```xml
<x_context>
<meta>
  <url>x.com/user/status/123456</url>
  <extracted_at>2026-03-01T00:00:00Z</extracted_at>
  <page_type>post</page_type>
  <total_tweets>47</total_tweets>
  <total_links>12</total_links>
  <total_images>5</total_images>
  <estimated_tokens>~3200</estimated_tokens>
  <tool>X Context Packager v1.0.0 by AdLab</tool>
</meta>

<main_post>
  <author name="Display Name" handle="@handle" verified="blue"/>
  <timestamp iso="2026-02-26T18:30:00Z" display="Feb 26"/>
  <text>Full tweet text with line breaks and emoji preserved.</text>
  <hashtags>#AI #OpenSource</hashtags>
  <engagement replies="712" retweets="315" likes="2.5K" views="4.3M"/>
</main_post>

<replies count="46">
  <reply index="1" depth="1" reply_to="@handle" is_op="false">
    <author name="Replier" handle="@replier" verified="none"/>
    <text>Reply text here</text>
    <engagement replies="3" likes="12"/>
  </reply>
</replies>

<hashtag_index>
  <hashtag tag="#ai" count="8" tweets="1,4,7,12,15,22,31,40"/>
</hashtag_index>

<mention_index>
  <mention handle="@example" count="3" tweets="3,8,22"/>
</mention_index>

<domain_index>
  <domain name="github.com" count="4" tweets="1,6,12,31"/>
</domain_index>

<conversation_summary>
  <reply_sort_mode>relevance</reply_sort_mode>
  <unique_authors>31</unique_authors>
  <deepest_thread_depth>4</deepest_thread_depth>
</conversation_summary>
</x_context>
```

</details>

---

## Project Structure

```
x-context-packager/
├── manifest.json              # Chrome MV3 manifest
├── popup/
│   ├── popup.html             # One-button UI
│   ├── popup.css              # AdLab cinematic dark theme
│   └── popup.js               # State machine + clipboard
├── content/
│   └── content.js             # Full extraction engine
├── icons/                     # Extension icons (16/48/128)
├── docs/
│   ├── OUTPUT_SCHEMA.md       # Output format documentation
│   └── LEGAL_POSITION.md      # TOS position + Grok note
├── DESIGN_PHILOSOPHY.md       # UX soul — read first
├── IMPLEMENTATION_PLAN.md     # Full technical spec
├── AGENTS.md                  # Dev instructions
├── CONTRIBUTING.md            # Contribution guide
├── CHANGELOG.md               # Version history
└── LICENSE                    # MIT
```

---

## Built By

**AdLab** (Total New Media Management) — Los Angeles content creation company. 150M+ views since April 2025. This is our first open source project.

Designed with love. For the human being.

---

## License

MIT — do whatever you want with it.
