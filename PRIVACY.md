# Privacy Policy — X Context Packager

**Effective Date:** March 1, 2026
**Extension Version:** 1.0.0
**Publisher:** AdLab (Total New Media Management)

---

## The Short Version

X Context Packager collects **zero data**. It makes **zero network requests**. Everything happens locally in your browser. We cannot see what you extract, where you paste it, or how you use it.

---

## What Data Is Collected

**None.**

- No personal information
- No browsing history
- No usage analytics
- No telemetry or crash reports
- No cookies or tracking identifiers
- No fingerprinting

## What Data Is Processed

The extension reads the DOM (Document Object Model) of X.com pages that you have already loaded in your browser. This is the same content visible on your screen. The extension:

1. **Reads** visible tweet text, author names, engagement counts, links, image URLs, and other metadata from the current page's DOM
2. **Structures** this data into an organized text format
3. **Copies** the structured text to your clipboard

All processing happens locally in your browser. No data leaves your machine.

## What Data Is Stored

The extension stores **user preferences only** via `chrome.storage.local`:

| Setting | Purpose | Default |
|---------|---------|---------|
| `format` | Your preferred output format | `structured` |
| `gearExpanded` | Whether settings panel is open | `false` |
| `includeEngagement` | Show engagement metrics | `true` |
| `includeImages` | Include image URLs | `true` |
| `includeTimestamps` | Include timestamps | `true` |
| `maxReplies` | Reply limit setting | `all` |

These preferences are stored locally on your device using Chrome's built-in storage API. They are never transmitted anywhere.

The extension also stores selector health data locally to improve DOM extraction reliability across sessions. This data describes which CSS selectors successfully find page elements and contains no user content or personal information.

## Network Activity

**The extension makes zero network requests.** It does not:

- Contact any server, API, or external service
- Phone home for updates or analytics
- Transmit extracted content anywhere
- Load remote scripts or resources
- Use WebSocket or any communication channel

You can verify this by monitoring network activity in Chrome DevTools while using the extension.

## Permissions Explained

| Permission | Why It's Needed | What It Does |
|------------|----------------|--------------|
| `activeTab` | Read the current X.com page | Grants temporary access to the active tab's DOM when you click the extension |
| `scripting` | Run the extraction code | Allows injecting the content script that reads tweet data from the page |
| `clipboardWrite` | Copy results | Writes the structured output to your clipboard so you can paste it |
| `storage` | Remember your preferences | Saves settings like format choice and panel state between sessions |

### Host Permissions

The extension requests access to `*://x.com/*` and `*://twitter.com/*`. This allows the content script to run on X.com pages. The extension does not activate on any other website.

## Third-Party Services

**None.** The extension has zero external dependencies, uses no third-party libraries, and communicates with no external services.

## Data Retention

- **Clipboard data** persists until you copy something else — standard browser behavior
- **User preferences** persist until you uninstall the extension or clear Chrome storage
- **Selector health data** persists locally until cleared; contains no personal information
- **No server-side retention** because there are no servers

## Children's Privacy

The extension does not knowingly collect information from children under 13 (or the applicable age in your jurisdiction). The extension collects no information from anyone.

## Changes to This Policy

If we change this privacy policy, we will update this document in the repository. Since the extension makes zero network requests, we cannot push policy changes to installed copies — users control when they update.

## Your Rights

Since we collect no data, there is nothing to request, modify, or delete. Your extracted content stays entirely under your control in your browser's clipboard.

## Contact

For privacy questions: [adlabusa.com/contact](https://adlabusa.com/contact)

## Open Source Verification

Every line of code is publicly available at [github.com/Aspirewastaken/x-context-packager](https://github.com/Aspirewastaken/x-context-packager). You can audit the extension yourself to verify these privacy claims.

---

*This is the privacy policy for X Context Packager by AdLab. It is not legal advice.*
