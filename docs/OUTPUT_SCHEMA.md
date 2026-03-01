# Output Schema — X Context Packager

## Overview

The extension extracts page context into a normalized JSON payload internally, then renders it into one of three output formats. All three formats contain the same data — only the presentation differs.

---

## Extracted Fields (Per Tweet)

| Field | Type | Description |
|-------|------|-------------|
| `author.name` | string | Display name |
| `author.handle` | string | @handle |
| `author.verified` | enum | `blue` / `gold` / `grey` / `none` |
| `author.followers` | string\|null | From hover card if available |
| `author.following` | string\|null | From hover card if available |
| `timestamp.iso` | string | ISO 8601 timestamp |
| `timestamp.display` | string | Human-readable display text |
| `text` | string | Full tweet text (line breaks + emoji preserved) |
| `hashtags` | string[] | All #tags extracted from text |
| `mentions` | string[] | All @handles extracted from text |
| `links` | array | `{ url, display }` for each external link |
| `images` | array | `{ url, alt }` for each image |
| `video` | boolean | Video present in tweet |
| `gif` | boolean | GIF present in tweet |
| `quotedTweet` | object\|null | Recursively extracted quoted tweet |
| `linkCard` | object\|null | `{ title, description, domain, url }` |
| `communityNote` | string\|null | "Readers added context" text |
| `poll` | object\|null | `{ options: [{ label, votes }], totalVotes }` |
| `engagement.replies` | string\|null | Reply count |
| `engagement.retweets` | string\|null | Retweet count |
| `engagement.likes` | string\|null | Like count |
| `engagement.bookmarks` | string\|null | Bookmark count |
| `engagement.views` | string\|null | View count |
| `threading.replyTo` | string\|null | @handle this replies to |
| `threading.depth` | number | Nesting level (0 = main post) |
| `threading.isOp` | boolean | Is this the original poster? |
| `threading.position` | number | Position in reply list |
| `flags.sensitive` | boolean | Content warning flag |
| `flags.translated` | boolean | Auto-translated by X |
| `flags.truncated` | boolean | Has "Show more" |
| `flags.repost` | boolean | Is a repost/retweet |

## Aggregated Indexes

| Index | Description |
|-------|-------------|
| `hashtagIndex` | `{ tag, count, tweets[] }` sorted by frequency |
| `mentionIndex` | `{ handle, count, tweets[] }` sorted by frequency |
| `domainIndex` | `{ domain, count, tweets[] }` sorted by frequency |
| `allLinks` | All links with source context |
| `allImages` | All images with alt text and source context |

## Conversation Summary (Post Page Only)

| Field | Description |
|-------|-------------|
| `replySortMode` | `relevance` or `recency` |
| `opReplyCount` | How many times OP replied in the thread |
| `uniqueAuthors` | Number of unique reply authors |
| `deepestThreadDepth` | Maximum nesting depth found |
| `mostLikedReply` | `{ index, likes }` of the highest-liked reply |

---

## Format 1: Structured XML (Default)

Uses `<x_context>` semantic tags. Best for LLM parsing.

```xml
<x_context>
<meta>
  <url>...</url>
  <extracted_at>ISO timestamp</extracted_at>
  <page_type>post|profile</page_type>
  <total_tweets>N</total_tweets>
  <total_links>N</total_links>
  <total_images>N</total_images>
  <estimated_tokens>~N</estimated_tokens>
  <page>N of ?</page>
  <tool>X Context Packager v1.0.0 by AdLab</tool>
</meta>

<main_post>
  <author name="..." handle="@..." verified="blue|gold|grey|none"/>
  <timestamp iso="..." display="..."/>
  <text>...</text>
  <hashtags>...</hashtags>
  <links><link url="..." display="..."/></links>
  <images><image url="..." alt="..."/></images>
  <engagement replies="..." retweets="..." likes="..." views="..."/>
  <flags sensitive="false" translated="false" truncated="false"/>
</main_post>

<replies count="N">
  <reply index="N" depth="N" reply_to="@..." is_op="true|false">
    <!-- same structure as main_post -->
  </reply>
</replies>

<all_links><link index="N" url="..." context="..."/></all_links>
<all_images><image index="N" url="..." alt="..." context="..."/></all_images>

<hashtag_index><hashtag tag="..." count="N" tweets="1,4,7"/></hashtag_index>
<mention_index><mention handle="..." count="N" tweets="3,8"/></mention_index>
<domain_index><domain name="..." count="N" tweets="1,6"/></domain_index>

<conversation_summary>
  <reply_sort_mode>...</reply_sort_mode>
  <op_reply_count>N</op_reply_count>
  <unique_authors>N</unique_authors>
  <deepest_thread_depth>N</deepest_thread_depth>
  <most_liked_reply index="N" likes="N"/>
</conversation_summary>
</x_context>
```

## Format 2: Markdown

Human-readable with headers, emoji engagement indicators, and markdown links.

## Format 3: Plain Text

Minimal formatting with simple separators. Maximum token efficiency.

---

## Null Handling

If a field is unavailable from the DOM, it is set to `null` in the internal payload and **omitted** from the output format. Fields are never fabricated — if the data isn't in the DOM, it doesn't appear in the output.
