/**
 * X Context Packager — Content Script
 * AdLab Open Source · v1.0.0
 *
 * This is the extraction engine. It runs inside X.com pages when injected
 * by the popup via chrome.scripting.executeScript. It reads the DOM, extracts
 * all visible tweet/reply/profile context, normalizes it into a payload,
 * formats it into three output formats, and returns the result.
 *
 * ZERO network requests. ZERO API calls. DOM reading only.
 *
 * All selectors are centralized in the SELECTORS object below.
 * When X.com changes their DOM, only SELECTORS needs updating.
 */

(() => {
  'use strict';

  // =========================================================================
  // SELECTORS — Single source of truth for all X.com DOM selectors
  // =========================================================================

  const SELECTORS = {
    // Tweet containers
    tweet: '[data-testid="tweet"]',
    tweetText: '[data-testid="tweetText"]',
    userName: '[data-testid="User-Name"]',

    // Media
    tweetPhoto: '[data-testid="tweetPhoto"]',
    videoPlayer: '[data-testid="videoPlayer"], [data-testid="videoComponent"], video',
    gifIndicator: '[data-testid="gifPlayer"]',

    // Embedded content
    quoteTweet: '[data-testid="quoteTweet"]',
    cardWrapper: '[data-testid="card.wrapper"]',
    communityNote: '[data-testid="birdwatch-pivot"]',
    poll: '[data-testid="cardPoll"]',

    // Engagement (aria-label based)
    reply: '[data-testid="reply"]',
    retweet: '[data-testid="retweet"]',
    like: '[data-testid="like"]',
    unlike: '[data-testid="unlike"]',
    bookmark: '[data-testid="bookmark"]',

    // Verification
    verifiedBadge: '[data-testid="icon-verified"]',

    // Threading
    showMore: '[data-testid="tweet-text-show-more-link"]',
    sensitiveWarning: '[data-testid="tweet-text-sensitive-warning"]',
    cellInnerDiv: '[data-testid="cellInnerDiv"]',

    // Profile
    profileHeader: '[data-testid="UserProfileHeader_Items"]',
    profileBio: '[data-testid="UserDescription"]',
    profileName: '[data-testid="UserName"]',
    hoverCard: '[data-testid="HoverCard"]',
    profileFollowLinks: 'a[href$="/following"], a[href$="/followers"], a[href$="/verified_followers"]',

    // Navigation
    primaryColumn: '[data-testid="primaryColumn"]',
    analyticsLink: 'a[href*="/analytics"]',

    // Time
    timestamp: 'time',

    // Reply sort
    replySortTab: '[role="tab"][aria-selected="true"]',
  };

  // =========================================================================
  // UTILITIES
  // =========================================================================

  /**
   * Safe querySelector that never throws
   */
  function qs(el, selector) {
    try { return el.querySelector(selector); } catch { return null; }
  }

  /**
   * Safe querySelectorAll that never throws
   */
  function qsa(el, selector) {
    try { return Array.from(el.querySelectorAll(selector)); } catch { return []; }
  }

  /**
   * Extract text content safely
   */
  function textOf(el) {
    return el ? el.innerText?.trim() || el.textContent?.trim() || '' : '';
  }

  /**
   * Parse engagement number from aria-label (e.g., "712 replies" → 712, "2.5K likes" → "2.5K")
   */
  function parseEngagement(el) {
    if (!el) return null;
    const label = el.getAttribute('aria-label') || '';
    const match = label.match(/^([\d,.]+[KMB]?)\s/i);
    if (match) return match[1];
    // Try getting the text content of the span inside
    const span = el.querySelector('span span');
    if (span) {
      const text = span.textContent?.trim();
      if (text && text !== '') return text;
    }
    return null;
  }

  /**
   * Estimate tokens from text (~4 chars per token)
   */
  function estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }

  /**
   * Classify token size for indicator
   */
  function classifyTokenSize(tokens) {
    if (tokens < 2000) return { level: 'green', label: 'Fits any LLM context' };
    if (tokens < 8000) return { level: 'yellow', label: 'Medium context' };
    if (tokens < 32000) return { level: 'orange', label: 'Large context — use 100K+ models' };
    return { level: 'red', label: 'Very large — consider truncating' };
  }

  /**
   * Extract domain from URL
   */
  function extractDomain(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return null;
    }
  }

  // =========================================================================
  // PAGE TYPE DETECTION
  // =========================================================================

  function detectPageType(url) {
    try {
      const u = new URL(url);
      const host = u.hostname;
      if (host !== 'x.com' && host !== 'twitter.com' && host !== 'www.x.com' && host !== 'www.twitter.com') {
        return 'unsupported';
      }
      const path = u.pathname;
      // Exclude non-content paths
      const nonContent = ['/settings', '/messages', '/i/', '/notifications', '/explore', '/search', '/home', '/compose', '/login', '/signup'];
      if (nonContent.some(p => path.startsWith(p))) return 'unsupported';
      // Post page: /user/status/id
      if (/^\/[^/]+\/status\/\d+/.test(path)) return 'post';
      // Profile page: /user (but not /user/status, /user/followers, etc.)
      if (/^\/[^/]+\/?$/.test(path)) return 'profile';
      return 'unsupported';
    } catch {
      return 'unsupported';
    }
  }

  // =========================================================================
  // TWEET EXTRACTION
  // =========================================================================

  /**
   * Extract all metadata from a single tweet DOM element
   */
  function extractTweet(tweetEl, context = {}) {
    const tweet = {
      author: { name: null, handle: null, verified: 'none', followers: null, following: null },
      timestamp: { iso: null, display: null },
      text: null,
      hashtags: [],
      mentions: [],
      links: [],
      images: [],
      video: false,
      gif: false,
      quotedTweet: null,
      linkCard: null,
      communityNote: null,
      poll: null,
      engagement: { replies: null, retweets: null, quotes: null, likes: null, bookmarks: null, views: null },
      replyRestriction: null,
      flags: { sensitive: false, translated: false, truncated: false, repost: false, hasCommunityNote: false },
      threading: { replyTo: null, depth: context.depth || 0, isOp: context.isOp || false, position: context.position || 0 },
    };

    try {
      // --- AUTHOR ---
      const userNameEl = qs(tweetEl, SELECTORS.userName);
      if (userNameEl) {
        // Display name is usually the first text span
        const nameSpans = qsa(userNameEl, 'span');
        if (nameSpans.length > 0) {
          // Find the display name (first non-@ text)
          for (const span of nameSpans) {
            const t = span.textContent?.trim();
            if (t && !t.startsWith('@') && !t.startsWith('·') && t !== '·') {
              tweet.author.name = t;
              break;
            }
          }
          // Find the handle (@...)
          for (const span of nameSpans) {
            const t = span.textContent?.trim();
            if (t && t.startsWith('@')) {
              tweet.author.handle = t;
              break;
            }
          }
        }
        // If handle not found in spans, try links
        if (!tweet.author.handle) {
          const links = qsa(userNameEl, 'a[href]');
          for (const link of links) {
            const href = link.getAttribute('href') || '';
            const match = href.match(/^\/([^/]+)\/?$/);
            if (match) {
              tweet.author.handle = '@' + match[1];
              break;
            }
          }
        }

        // Verified badge
        const badge = qs(tweetEl, SELECTORS.verifiedBadge);
        if (badge) {
          // Try to detect badge type from SVG fill
          const svg = qs(badge, 'svg');
          if (svg) {
            const fill = svg.getAttribute('fill') || '';
            const path = qs(svg, 'path');
            const d = path ? path.getAttribute('d') || '' : '';
            // Gold badge typically has a different color/fill
            if (fill.includes('D18800') || fill.includes('E8A100') || fill.includes('gold')) {
              tweet.author.verified = 'gold';
            } else if (fill.includes('829AAB') || fill.includes('grey') || fill.includes('gray')) {
              tweet.author.verified = 'grey';
            } else {
              tweet.author.verified = 'blue';
            }
          } else {
            tweet.author.verified = 'blue';
          }
        }
      }

      // --- TIMESTAMP ---
      const timeEl = qs(tweetEl, SELECTORS.timestamp);
      if (timeEl) {
        tweet.timestamp.iso = timeEl.getAttribute('datetime') || null;
        tweet.timestamp.display = timeEl.textContent?.trim() || null;
      }

      // --- TEXT ---
      const textEl = qs(tweetEl, SELECTORS.tweetText);
      if (textEl) {
        tweet.text = textEl.innerText?.trim() || null;

        // Extract hashtags
        const hashtagMatches = (tweet.text || '').match(/#\w+/g);
        if (hashtagMatches) {
          tweet.hashtags = [...new Set(hashtagMatches.map(h => h.toLowerCase()))];
        }

        // Extract mentions
        const mentionMatches = (tweet.text || '').match(/@\w+/g);
        if (mentionMatches) {
          tweet.mentions = [...new Set(mentionMatches.map(m => m.toLowerCase()))];
        }

        // Extract links from tweetText
        const linkEls = qsa(textEl, 'a[href]');
        for (const a of linkEls) {
          const href = a.getAttribute('href') || '';
          const display = a.textContent?.trim() || '';
          // Filter out hashtag links and profile links
          if (href.includes('/search?q=%23') || href.includes('/hashtag/')) continue;
          if (/^\/[^/]+\/?$/.test(href) && display.startsWith('@')) continue;
          // Keep external links and t.co
          if (href.startsWith('http') || href.startsWith('https')) {
            tweet.links.push({ url: href, display: display });
          }
        }
      }

      // --- TRUNCATED ---
      if (qs(tweetEl, SELECTORS.showMore)) {
        tweet.flags.truncated = true;
      }

      // --- REPLY-TO ---
      // Look for "Replying to @handle" pattern
      const replyingTo = qsa(tweetEl, 'a[href]');
      for (const a of replyingTo) {
        const parent = a.parentElement;
        if (parent && /replying to/i.test(parent.textContent || '')) {
          const href = a.getAttribute('href') || '';
          const match = href.match(/^\/([^/]+)\/?$/);
          if (match) {
            tweet.threading.replyTo = '@' + match[1];
            break;
          }
        }
      }

      // --- REPOST DETECTION ---
      // Check for retweet indicator above the tweet
      const parentCells = tweetEl.parentElement;
      if (parentCells) {
        const prevSibling = parentCells.previousElementSibling;
        if (prevSibling && /reposted|retweeted/i.test(prevSibling.textContent || '')) {
          tweet.flags.repost = true;
        }
      }

      // --- IMAGES ---
      const photoEls = qsa(tweetEl, SELECTORS.tweetPhoto + ' img');
      for (const img of photoEls) {
        const src = img.getAttribute('src') || '';
        const alt = img.getAttribute('alt') || '';
        // Filter out profile pics and emoji
        if (src.includes('profile_images') || src.includes('emoji')) continue;
        if (src.includes('pbs.twimg.com/media') || src.includes('pbs.twimg.com/card_img')) {
          // Try to get full size
          const fullSrc = src.replace(/&name=\w+/, '&name=large').replace(/\?name=\w+/, '?name=large');
          tweet.images.push({ url: fullSrc, alt: alt || null });
        }
      }

      // --- VIDEO ---
      if (qs(tweetEl, SELECTORS.videoPlayer)) {
        tweet.video = true;
      }

      // --- GIF ---
      if (qs(tweetEl, SELECTORS.gifIndicator)) {
        tweet.gif = true;
      }

      // --- QUOTED TWEET ---
      const quoteEl = qs(tweetEl, SELECTORS.quoteTweet);
      if (quoteEl) {
        tweet.quotedTweet = extractQuotedTweet(quoteEl);
      }

      // --- LINK CARD ---
      const cardEl = qs(tweetEl, SELECTORS.cardWrapper);
      if (cardEl && !quoteEl) { // Don't extract card if it's a quoted tweet
        tweet.linkCard = extractLinkCard(cardEl);
      }

      // --- COMMUNITY NOTE ---
      const noteEl = qs(tweetEl, SELECTORS.communityNote);
      if (noteEl) {
        tweet.communityNote = textOf(noteEl);
        tweet.flags.hasCommunityNote = true;
      }

      // --- POLL ---
      const pollEl = qs(tweetEl, SELECTORS.poll);
      if (pollEl) {
        tweet.poll = extractPoll(pollEl);
      }

      // --- ENGAGEMENT ---
      // Try aria-label approach on engagement buttons
      const replyBtn = qs(tweetEl, SELECTORS.reply);
      const retweetBtn = qs(tweetEl, SELECTORS.retweet);
      const likeBtn = qs(tweetEl, SELECTORS.like) || qs(tweetEl, SELECTORS.unlike);
      const bookmarkBtn = qs(tweetEl, SELECTORS.bookmark);

      tweet.engagement.replies = parseEngagement(replyBtn);
      tweet.engagement.retweets = parseEngagement(retweetBtn);
      tweet.engagement.likes = parseEngagement(likeBtn);
      tweet.engagement.bookmarks = parseEngagement(bookmarkBtn);

      // Views - look for view count container (usually on main post)
      const viewEls = qsa(tweetEl, SELECTORS.analyticsLink);
      if (viewEls.length > 0) {
        const viewText = viewEls[0].textContent?.trim();
        if (viewText) {
          const viewMatch = viewText.match(/([\d,.]+[KMB]?)/i);
          if (viewMatch) tweet.engagement.views = viewMatch[1];
        }
      }

      // --- SENSITIVE ---
      if (qs(tweetEl, SELECTORS.sensitiveWarning)) {
        tweet.flags.sensitive = true;
      }

    } catch (e) {
      // Never crash on extraction errors — return partial data
      tweet._error = e.message;
    }

    return tweet;
  }

  /**
   * Extract quoted tweet content
   */
  function extractQuotedTweet(quoteEl) {
    try {
      const qt = { author: { name: null, handle: null, verified: 'none' }, text: null, links: [], images: [] };

      // Author from quoted tweet
      const nameEl = qs(quoteEl, 'span');
      if (nameEl) {
        const spans = qsa(quoteEl, 'span');
        for (const span of spans) {
          const t = span.textContent?.trim();
          if (t && t.startsWith('@')) {
            qt.author.handle = t;
          } else if (t && !qt.author.name && t.length > 1 && !t.startsWith('·')) {
            qt.author.name = t;
          }
        }
      }

      // Text
      const textEl = qs(quoteEl, SELECTORS.tweetText);
      if (textEl) {
        qt.text = textEl.innerText?.trim() || null;
        // Links
        const linkEls = qsa(textEl, 'a[href]');
        for (const a of linkEls) {
          const href = a.getAttribute('href') || '';
          if (href.startsWith('http')) {
            qt.links.push({ url: href, display: a.textContent?.trim() || '' });
          }
        }
      }

      // Images
      const imgs = qsa(quoteEl, 'img[src*="pbs.twimg.com/media"]');
      for (const img of imgs) {
        qt.images.push({ url: img.getAttribute('src') || '', alt: img.getAttribute('alt') || null });
      }

      // Verified
      if (qs(quoteEl, SELECTORS.verifiedBadge)) {
        qt.author.verified = 'blue';
      }

      return qt;
    } catch {
      return null;
    }
  }

  /**
   * Extract link card content
   */
  function extractLinkCard(cardEl) {
    try {
      const card = { title: null, description: null, domain: null, url: null };

      // Try to get the link
      const link = qs(cardEl, 'a[href]');
      if (link) {
        card.url = link.getAttribute('href') || null;
        card.domain = card.url ? extractDomain(card.url) : null;
      }

      // Title and description from spans
      const spans = qsa(cardEl, 'span');
      for (const span of spans) {
        const text = span.textContent?.trim();
        if (!text) continue;
        if (!card.domain && text.includes('.') && text.length < 50) {
          card.domain = text;
        } else if (!card.title && text.length > 5) {
          card.title = text;
        } else if (!card.description && text.length > card.title?.length) {
          card.description = text;
        }
      }

      return (card.title || card.url) ? card : null;
    } catch {
      return null;
    }
  }

  /**
   * Extract poll data
   */
  function extractPoll(pollEl) {
    try {
      const poll = { question: null, options: [], totalVotes: null };

      // Options are usually in list items or divs with percentage
      const optionEls = qsa(pollEl, '[role="listitem"], [data-testid]');
      for (const opt of optionEls) {
        const text = textOf(opt);
        if (text) {
          const percentMatch = text.match(/([\d.]+%)/);
          const label = text.replace(/([\d.]+%)/, '').trim();
          if (label) {
            poll.options.push({ label, votes: percentMatch ? percentMatch[1] : null });
          }
        }
      }

      // Total votes
      const allText = textOf(pollEl);
      const totalMatch = allText.match(/([\d,]+)\s*votes?/i);
      if (totalMatch) poll.totalVotes = totalMatch[1];

      return poll.options.length > 0 ? poll : null;
    } catch {
      return null;
    }
  }

  // =========================================================================
  // PAGE EXTRACTORS
  // =========================================================================

  /**
   * Extract post page: main tweet + all visible replies
   */
  function extractPostPage() {
    try {
      const tweetEls = qsa(document, SELECTORS.tweet);
      if (tweetEls.length === 0) {
        return { error: 'No tweets found on this page' };
      }

      // First tweet is the main post
      const mainPost = extractTweet(tweetEls[0], { depth: 0, position: 0, isOp: false });
      const opHandle = mainPost.author.handle;

      // Remaining are replies
      const replies = [];
      for (let i = 1; i < tweetEls.length; i++) {
        const el = tweetEls[i];

        // Calculate depth from DOM structure
        let depth = 1;
        // Look for indentation clues — thread connectors, nested reply containers
        const parentArticle = el.closest('article');
        if (parentArticle) {
          // Count ancestor cellInnerDiv elements as proxy for nesting
          let parent = el.parentElement;
          let nestLevel = 0;
          while (parent && parent !== document.body) {
            if (parent.matches?.(SELECTORS.cellInnerDiv)) nestLevel++;
            parent = parent.parentElement;
          }
          // Heuristic: more nesting = deeper thread
          if (nestLevel > 3) depth = 2;
          if (nestLevel > 5) depth = 3;
        }

        // Check if reply mentions someone (reply-to context)
        const reply = extractTweet(el, {
          depth: depth,
          position: i,
          isOp: opHandle && qs(el, SELECTORS.userName)?.textContent?.includes(opHandle?.replace('@', ''))
        });

        // Override isOp based on handle comparison
        if (opHandle && reply.author.handle) {
          reply.threading.isOp = reply.author.handle.toLowerCase() === opHandle.toLowerCase();
        }

        replies.push(reply);
      }

      // Detect reply sort mode
      let replySortMode = 'relevance';
      const activeTab = qs(document, SELECTORS.replySortTab);
      if (activeTab) {
        const tabText = (activeTab.textContent || '').toLowerCase();
        if (tabText.includes('recent') || tabText.includes('latest')) {
          replySortMode = 'recency';
        }
      }

      return { mainPost, replies, replySortMode };
    } catch {
      return { error: 'Failed to extract post context from the current page' };
    }
  }

  /**
   * Extract profile page: profile header + visible timeline posts
   */
  function extractProfilePage() {
    try {
      const profile = {
        name: null,
        handle: null,
        bio: null,
        location: null,
        website: null,
        joined: null,
        following: null,
        followers: null,
      };

      // Profile name
      const nameEl = qs(document, SELECTORS.profileName);
      if (nameEl) {
        const spans = qsa(nameEl, 'span');
        for (const span of spans) {
          const t = span.textContent?.trim();
          if (t && t.startsWith('@')) {
            profile.handle = t;
          } else if (t && !profile.name && t.length > 0) {
            profile.name = t;
          }
        }
      }

      // Bio
      const bioEl = qs(document, SELECTORS.profileBio);
      if (bioEl) {
        profile.bio = textOf(bioEl) || null;
      }

      // Header items (location, website, joined date)
      const headerEl = qs(document, SELECTORS.profileHeader);
      if (headerEl) {
        const items = qsa(headerEl, 'span');
        for (const item of items) {
          const text = item.textContent?.trim() || '';
          if (text.startsWith('Joined')) {
            profile.joined = text;
          } else if (text.includes('.') && text.length < 40 && !text.includes('Joined')) {
            profile.website = text;
          } else if (text.length > 0 && text.length < 50 && !text.includes('Joined') && !text.includes('Born')) {
            if (!profile.location) profile.location = text;
          }
        }
      }

      // Follower/following counts
      const followLinks = qsa(document, SELECTORS.profileFollowLinks);
      for (const link of followLinks) {
        const href = link.getAttribute('href') || '';
        const countSpan = qs(link, 'span span');
        const count = countSpan ? countSpan.textContent?.trim() : null;
        if (href.includes('/following') && !href.includes('/followers')) {
          profile.following = count;
        } else if (href.includes('/followers') || href.includes('/verified_followers')) {
          profile.followers = count;
        }
      }

      // Timeline posts
      const tweetEls = qsa(document, SELECTORS.tweet);
      const posts = [];
      for (let i = 0; i < tweetEls.length; i++) {
        posts.push(extractTweet(tweetEls[i], { depth: 0, position: i + 1, isOp: false }));
      }

      return { profile, posts };
    } catch {
      return { error: 'Failed to extract profile context from the current page' };
    }
  }

  // =========================================================================
  // NORMALIZATION — Build indexes and payload
  // =========================================================================

  function buildPayload(pageType, url, extractedData, options = {}) {
    const payload = {
      meta: {
        url: url,
        extractedAt: new Date().toISOString(),
        pageType: pageType,
        totalTweets: 0,
        totalLinks: 0,
        totalImages: 0,
        estimatedTokens: 0,
        tokenSize: null,
        page: options.page || 1,
        tool: 'X Context Packager v1.0.0 by AdLab',
      },
      mainPost: null,
      replies: [],
      profile: null,
      posts: [],
      allLinks: [],
      allImages: [],
      hashtagIndex: [],
      mentionIndex: [],
      domainIndex: [],
      conversationSummary: null,
    };

    // Collect all tweets for index building
    let allTweets = [];

    if (pageType === 'post') {
      payload.mainPost = extractedData.mainPost;
      payload.replies = extractedData.replies || [];
      allTweets = [extractedData.mainPost, ...payload.replies];
      payload.meta.totalTweets = allTweets.length;

      // Apply max replies cap
      if (options.maxReplies && options.maxReplies !== 'all') {
        const cap = parseInt(options.maxReplies, 10);
        if (!isNaN(cap) && payload.replies.length > cap) {
          payload.replies = payload.replies.slice(0, cap);
          allTweets = [extractedData.mainPost, ...payload.replies];
        }
      }

      // Conversation summary
      const uniqueAuthors = new Set();
      let maxDepth = 0;
      let opReplyCount = 0;
      let mostLiked = { index: 0, likes: 0 };

      for (let i = 0; i < payload.replies.length; i++) {
        const r = payload.replies[i];
        if (r.author.handle) uniqueAuthors.add(r.author.handle.toLowerCase());
        if (r.threading.depth > maxDepth) maxDepth = r.threading.depth;
        if (r.threading.isOp) opReplyCount++;
        const likeCount = parseFloat((r.engagement.likes || '0').replace(/[KMB,]/gi, ''));
        if (likeCount > mostLiked.likes) {
          mostLiked = { index: i + 1, likes: r.engagement.likes };
        }
      }

      payload.conversationSummary = {
        replySortMode: extractedData.replySortMode || 'relevance',
        opReplyCount: opReplyCount,
        uniqueAuthors: uniqueAuthors.size,
        deepestThreadDepth: maxDepth,
        mostLikedReply: mostLiked.likes ? mostLiked : null,
      };

    } else if (pageType === 'profile') {
      payload.profile = extractedData.profile;
      payload.posts = extractedData.posts || [];
      allTweets = payload.posts;
      payload.meta.totalTweets = allTweets.length;
    }

    // Build aggregated indexes
    const hashtagMap = {};
    const mentionMap = {};
    const domainMap = {};
    let linkIndex = 0;
    let imageIndex = 0;

    for (let i = 0; i < allTweets.length; i++) {
      const t = allTweets[i];
      if (!t) continue;
      const tweetLabel = pageType === 'post' ? (i === 0 ? 'main post' : `reply ${i}`) : `post ${i + 1}`;

      // Links
      for (const link of (t.links || [])) {
        linkIndex++;
        payload.allLinks.push({ index: linkIndex, url: link.url, display: link.display, context: tweetLabel });
        const domain = extractDomain(link.url);
        if (domain) {
          if (!domainMap[domain]) domainMap[domain] = { count: 0, tweets: [] };
          domainMap[domain].count++;
          domainMap[domain].tweets.push(i + 1);
        }
      }

      // Images
      for (const img of (t.images || [])) {
        imageIndex++;
        payload.allImages.push({ index: imageIndex, url: img.url, alt: img.alt, context: tweetLabel });
      }

      // Hashtags
      for (const tag of (t.hashtags || [])) {
        if (!hashtagMap[tag]) hashtagMap[tag] = { count: 0, tweets: [] };
        hashtagMap[tag].count++;
        hashtagMap[tag].tweets.push(i + 1);
      }

      // Mentions
      for (const mention of (t.mentions || [])) {
        if (!mentionMap[mention]) mentionMap[mention] = { count: 0, tweets: [] };
        mentionMap[mention].count++;
        mentionMap[mention].tweets.push(i + 1);
      }

      // Quoted tweet links
      if (t.quotedTweet) {
        for (const link of (t.quotedTweet.links || [])) {
          linkIndex++;
          payload.allLinks.push({ index: linkIndex, url: link.url, display: link.display, context: tweetLabel + ' (quoted)' });
        }
      }

      // Link card
      if (t.linkCard && t.linkCard.url) {
        linkIndex++;
        payload.allLinks.push({ index: linkIndex, url: t.linkCard.url, display: t.linkCard.title || '', context: tweetLabel + ' (card)' });
        const domain = extractDomain(t.linkCard.url);
        if (domain) {
          if (!domainMap[domain]) domainMap[domain] = { count: 0, tweets: [] };
          domainMap[domain].count++;
          if (!domainMap[domain].tweets.includes(i + 1)) domainMap[domain].tweets.push(i + 1);
        }
      }
    }

    // Convert maps to sorted arrays
    payload.hashtagIndex = Object.entries(hashtagMap)
      .map(([tag, data]) => ({ tag, count: data.count, tweets: data.tweets }))
      .sort((a, b) => b.count - a.count);

    payload.mentionIndex = Object.entries(mentionMap)
      .map(([handle, data]) => ({ handle, count: data.count, tweets: data.tweets }))
      .sort((a, b) => b.count - a.count);

    payload.domainIndex = Object.entries(domainMap)
      .map(([domain, data]) => ({ domain, count: data.count, tweets: data.tweets }))
      .sort((a, b) => b.count - a.count);

    payload.meta.totalLinks = payload.allLinks.length;
    payload.meta.totalImages = payload.allImages.length;

    return payload;
  }

  // =========================================================================
  // FORMATTERS
  // =========================================================================

  /**
   * Escape XML special characters
   */
  function escXml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function xmlAttr(name, value) {
    if (value === null || value === undefined || value === '') return '';
    return ` ${name}="${escXml(value)}"`;
  }

  /**
   * Format a single tweet for structured XML output
   */
  function formatTweetStructured(tweet, tag, attrs = '', options = {}) {
    const lines = [];
    const indent = tag === 'main_post' ? '  ' : '    ';

    lines.push(`<${tag}${attrs}>`);

    // Author
    const a = tweet.author;
    const authorAttrs = `${xmlAttr('name', a.name)}${xmlAttr('handle', a.handle)}${xmlAttr('verified', a.verified || 'none')}${xmlAttr('followers', a.followers)}${xmlAttr('following', a.following)}`;
    lines.push(`${indent}<author${authorAttrs}/>`);

    // Timestamp
    if (options.includeTimestamps !== false && (tweet.timestamp.iso || tweet.timestamp.display)) {
      lines.push(`${indent}<timestamp${xmlAttr('iso', tweet.timestamp.iso)}${xmlAttr('display', tweet.timestamp.display)}/>`);
    }

    // Text
    if (tweet.text) {
      lines.push(`${indent}<text>`);
      lines.push(`${indent}${escXml(tweet.text)}`);
      lines.push(`${indent}</text>`);
    }

    // Hashtags
    if (tweet.hashtags.length > 0) {
      lines.push(`${indent}<hashtags>${escXml(tweet.hashtags.join(' '))}</hashtags>`);
    }

    // Links
    if (tweet.links.length > 0) {
      lines.push(`${indent}<links>`);
      for (const l of tweet.links) {
        lines.push(`${indent}  <link${xmlAttr('url', l.url)}${xmlAttr('display', l.display)}/>`);
      }
      lines.push(`${indent}</links>`);
    }

    // Images
    if (options.includeImages !== false && tweet.images.length > 0) {
      lines.push(`${indent}<images>`);
      for (const img of tweet.images) {
        lines.push(`${indent}  <image${xmlAttr('url', img.url)}${xmlAttr('alt', img.alt)}/>`);
      }
      lines.push(`${indent}</images>`);
    }

    // Video/GIF
    if (tweet.video) lines.push(`${indent}<video present="true"/>`);
    if (tweet.gif) lines.push(`${indent}<gif present="true"/>`);

    // Poll
    if (tweet.poll) {
      lines.push(`${indent}<poll>`);
      for (const opt of tweet.poll.options) {
        lines.push(`${indent}  <option${xmlAttr('votes', opt.votes)}>${escXml(opt.label)}</option>`);
      }
      if (tweet.poll.totalVotes) lines.push(`${indent}  <total_votes>${escXml(tweet.poll.totalVotes)}</total_votes>`);
      lines.push(`${indent}</poll>`);
    }

    // Quoted tweet
    if (tweet.quotedTweet) {
      const qt = tweet.quotedTweet;
      lines.push(`${indent}<quoted_tweet>`);
      lines.push(`${indent}  <author${xmlAttr('name', qt.author.name)}${xmlAttr('handle', qt.author.handle)}${xmlAttr('verified', qt.author.verified || 'none')}/>`);
      if (qt.text) lines.push(`${indent}  <text>${escXml(qt.text)}</text>`);
      if (qt.links.length > 0) {
        lines.push(`${indent}  <links>`);
        for (const l of qt.links) lines.push(`${indent}    <link${xmlAttr('url', l.url)}${xmlAttr('display', l.display)}/>`);
        lines.push(`${indent}  </links>`);
      }
      lines.push(`${indent}</quoted_tweet>`);
    }

    // Link card
    if (tweet.linkCard) {
      const c = tweet.linkCard;
      lines.push(`${indent}<link_card${xmlAttr('domain', c.domain)}${xmlAttr('title', c.title)}${xmlAttr('description', c.description)}${xmlAttr('url', c.url)}/>`);
    }

    // Community note
    if (tweet.communityNote) {
      lines.push(`${indent}<community_note>${escXml(tweet.communityNote)}</community_note>`);
    }

    // Engagement
    if (options.includeEngagement !== false) {
      const e = tweet.engagement;
      const engAttrs = `${xmlAttr('replies', e.replies)}${xmlAttr('retweets', e.retweets)}${xmlAttr('quotes', e.quotes)}${xmlAttr('likes', e.likes)}${xmlAttr('bookmarks', e.bookmarks)}${xmlAttr('views', e.views)}`;
      if (engAttrs) lines.push(`${indent}<engagement${engAttrs}/>`);
    }

    // Flags
    const f = tweet.flags;
    if (f.sensitive || f.translated || f.truncated) {
      lines.push(`${indent}<flags sensitive="${f.sensitive}" translated="${f.translated}" truncated="${f.truncated}"/>`);
    }

    lines.push(`</${tag}>`);
    return lines.join('\n');
  }

  /**
   * Format 1: Structured XML
   */
  function formatStructured(payload, options = {}) {
    const lines = [];

    lines.push('<x_context>');

    // Meta
    lines.push('<meta>');
    lines.push(`  <url>${escXml(payload.meta.url)}</url>`);
    lines.push(`  <extracted_at>${escXml(payload.meta.extractedAt)}</extracted_at>`);
    lines.push(`  <page_type>${escXml(payload.meta.pageType)}</page_type>`);
    lines.push(`  <total_tweets>${payload.meta.totalTweets}</total_tweets>`);
    lines.push(`  <total_links>${payload.meta.totalLinks}</total_links>`);
    lines.push(`  <total_images>${payload.meta.totalImages}</total_images>`);
    lines.push(`  <estimated_tokens>~${payload.meta.estimatedTokens}</estimated_tokens>`);
    lines.push(`  <page>${payload.meta.page} of ?</page>`);
    lines.push(`  <tool>${escXml(payload.meta.tool)}</tool>`);
    lines.push('</meta>');
    lines.push('');

    if (payload.meta.pageType === 'post') {
      // Main post
      if (payload.mainPost) {
        lines.push(formatTweetStructured(payload.mainPost, 'main_post', '', options));
        lines.push('');
      }

      // Replies
      if (payload.replies.length > 0) {
        lines.push(`<replies count="${payload.replies.length}">`);
        for (let i = 0; i < payload.replies.length; i++) {
          const r = payload.replies[i];
          const attrs = `${xmlAttr('index', i + 1)}${xmlAttr('depth', r.threading.depth)}${xmlAttr('reply_to', r.threading.replyTo)}${xmlAttr('is_op', r.threading.isOp)}`;
          lines.push(formatTweetStructured(r, 'reply', attrs, options));
        }
        lines.push('</replies>');
        lines.push('');
      }

    } else if (payload.meta.pageType === 'profile') {
      // Profile header
      if (payload.profile) {
        const p = payload.profile;
        lines.push('<profile>');
        if (p.name !== null && p.name !== undefined) lines.push(`  <name>${escXml(p.name)}</name>`);
        if (p.handle !== null && p.handle !== undefined) lines.push(`  <handle>${escXml(p.handle)}</handle>`);
        if (p.bio) lines.push(`  <bio>${escXml(p.bio)}</bio>`);
        if (p.location) lines.push(`  <location>${escXml(p.location)}</location>`);
        if (p.website) lines.push(`  <website>${escXml(p.website)}</website>`);
        if (p.joined) lines.push(`  <joined>${escXml(p.joined)}</joined>`);
        if (p.following) lines.push(`  <following>${escXml(p.following)}</following>`);
        if (p.followers) lines.push(`  <followers>${escXml(p.followers)}</followers>`);
        lines.push('</profile>');
        lines.push('');
      }

      // Posts
      if (payload.posts.length > 0) {
        lines.push(`<posts count="${payload.posts.length}">`);
        for (let i = 0; i < payload.posts.length; i++) {
          lines.push(formatTweetStructured(payload.posts[i], 'post', `${xmlAttr('index', i + 1)}`, options));
        }
        lines.push('</posts>');
        lines.push('');
      }
    }

    // All links
    if (payload.allLinks.length > 0) {
      lines.push('<all_links>');
      for (const l of payload.allLinks) {
        lines.push(`  <link index="${l.index}" url="${escXml(l.url)}" context="${escXml(l.context)}"/>`);
      }
      lines.push('</all_links>');
      lines.push('');
    }

    // All images
    if (payload.allImages.length > 0 && options.includeImages !== false) {
      lines.push('<all_images>');
      for (const img of payload.allImages) {
        let attrs = `index="${img.index}" url="${escXml(img.url)}" context="${escXml(img.context)}"`;
        if (img.alt) attrs += ` alt="${escXml(img.alt)}"`;
        lines.push(`  <image ${attrs}/>`);
      }
      lines.push('</all_images>');
      lines.push('');
    }

    // Hashtag index
    if (payload.hashtagIndex.length > 0) {
      lines.push('<hashtag_index>');
      for (const h of payload.hashtagIndex) {
        lines.push(`  <hashtag tag="${escXml(h.tag)}" count="${h.count}" tweets="${h.tweets.join(',')}"/>`);
      }
      lines.push('</hashtag_index>');
      lines.push('');
    }

    // Mention index
    if (payload.mentionIndex.length > 0) {
      lines.push('<mention_index>');
      for (const m of payload.mentionIndex) {
        lines.push(`  <mention handle="${escXml(m.handle)}" count="${m.count}" tweets="${m.tweets.join(',')}"/>`);
      }
      lines.push('</mention_index>');
      lines.push('');
    }

    // Domain index
    if (payload.domainIndex.length > 0) {
      lines.push('<domain_index>');
      for (const d of payload.domainIndex) {
        lines.push(`  <domain name="${escXml(d.domain)}" count="${d.count}" tweets="${d.tweets.join(',')}"/>`);
      }
      lines.push('</domain_index>');
      lines.push('');
    }

    // Conversation summary
    if (payload.conversationSummary) {
      const cs = payload.conversationSummary;
      lines.push('<conversation_summary>');
      lines.push(`  <reply_sort_mode>${escXml(cs.replySortMode)}</reply_sort_mode>`);
      lines.push(`  <op_reply_count>${cs.opReplyCount}</op_reply_count>`);
      lines.push(`  <unique_authors>${cs.uniqueAuthors}</unique_authors>`);
      lines.push(`  <deepest_thread_depth>${cs.deepestThreadDepth}</deepest_thread_depth>`);
      if (cs.mostLikedReply) {
        lines.push(`  <most_liked_reply index="${cs.mostLikedReply.index}" likes="${escXml(cs.mostLikedReply.likes)}"/>`);
      }
      lines.push('</conversation_summary>');
    }

    lines.push('</x_context>');

    return lines.join('\n');
  }

  /**
   * Format a single tweet for markdown output
   */
  function formatTweetMarkdown(tweet, prefix = '', options = {}) {
    const lines = [];
    const v = tweet.author.verified !== 'none' ? ` · ✓ ${tweet.author.verified}` : '';
    const displayName = tweet.author.name ?? 'null';
    const handle = tweet.author.handle ?? 'null';
    const timestamp = options.includeTimestamps !== false ? ` · ${tweet.timestamp.display ?? 'null'}` : '';

    lines.push(`${prefix}**${displayName}** (${handle})${v}${timestamp}`);

    if (tweet.threading.replyTo) {
      lines.push(`${prefix}> Replying to ${tweet.threading.replyTo}`);
    }

    if (tweet.text) {
      lines.push('');
      lines.push(tweet.text);
    }

    if (tweet.quotedTweet) {
      lines.push('');
      lines.push(`> **Quoted:** ${tweet.quotedTweet.author.handle ?? 'null'} — ${tweet.quotedTweet.text ?? 'null'}`);
    }

    if (tweet.linkCard) {
      lines.push(`🔗 [${tweet.linkCard.title || tweet.linkCard.domain}](${tweet.linkCard.url})`);
    }

    if (tweet.links.length > 0 && !tweet.linkCard) {
      for (const l of tweet.links) {
        lines.push(`🔗 [${l.display}](${l.url})`);
      }
    }

    if (tweet.images.length > 0 && options.includeImages !== false) {
      for (const img of tweet.images) {
        lines.push(`🖼️ ${img.url}${img.alt ? ' (' + img.alt + ')' : ''}`);
      }
    }

    if (tweet.communityNote) {
      lines.push(`📝 Community Note: ${tweet.communityNote}`);
    }

    if (tweet.poll) {
      lines.push('📊 Poll:');
      for (const opt of tweet.poll.options) {
        lines.push(`  - ${opt.label}: ${opt.votes ?? 'null'}`);
      }
    }

    if (options.includeEngagement !== false) {
      const e = tweet.engagement;
      const parts = [];
      if (e.replies) parts.push(`💬 ${e.replies}`);
      if (e.retweets) parts.push(`🔁 ${e.retweets}`);
      if (e.likes) parts.push(`❤️ ${e.likes}`);
      if (e.bookmarks) parts.push(`🔖 ${e.bookmarks}`);
      if (e.views) parts.push(`👁 ${e.views}`);
      if (parts.length > 0) lines.push(parts.join(' · '));
    }

    return lines.join('\n');
  }

  /**
   * Format 2: Markdown
   */
  function formatMarkdown(payload, options = {}) {
    const lines = [];

    lines.push('# X.com Post Context');
    lines.push(`**URL:** ${payload.meta.url}`);
    lines.push(`**Extracted:** ${payload.meta.extractedAt} | ${payload.meta.totalTweets} tweets | ${payload.meta.totalLinks} links | ${payload.meta.totalImages} images | ~${payload.meta.estimatedTokens} tokens`);
    lines.push(`**Tool:** ${payload.meta.tool}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    if (payload.meta.pageType === 'post') {
      if (payload.mainPost) {
        lines.push('## MAIN POST');
        lines.push(formatTweetMarkdown(payload.mainPost, '', options));
        lines.push('');
        lines.push('---');
        lines.push('');
      }

      if (payload.replies.length > 0) {
        lines.push(`## REPLIES (${payload.replies.length})`);
        lines.push('');
        for (let i = 0; i < payload.replies.length; i++) {
          const r = payload.replies[i];
          const depthStr = r.threading.depth > 1 ? ` [depth: ${r.threading.depth}]` : '';
          const opStr = r.threading.isOp ? ' (OP)' : '';
          const timeLabel = options.includeTimestamps !== false ? ` · ${r.timestamp.display ?? 'null'}` : '';
          lines.push(`### ${i + 1}. ${r.author.handle ?? 'null'}${opStr}${timeLabel}${depthStr}`);
          lines.push(formatTweetMarkdown(r, '', options));
          lines.push('');
        }
        lines.push('---');
        lines.push('');
      }

    } else if (payload.meta.pageType === 'profile') {
      if (payload.profile) {
        const p = payload.profile;
        lines.push('## PROFILE');
        lines.push(`**${p.name}** (${p.handle})`);
        if (p.bio) lines.push(`> ${p.bio}`);
        const meta = [];
        if (p.followers) meta.push(`${p.followers} followers`);
        if (p.following) meta.push(`${p.following} following`);
        if (p.location) meta.push(p.location);
        if (p.joined) meta.push(p.joined);
        if (meta.length > 0) lines.push(meta.join(' · '));
        lines.push('');
        lines.push('---');
        lines.push('');
      }

      if (payload.posts.length > 0) {
        lines.push(`## POSTS (${payload.posts.length})`);
        lines.push('');
        for (let i = 0; i < payload.posts.length; i++) {
          lines.push(`### ${i + 1}.`);
          lines.push(formatTweetMarkdown(payload.posts[i], '', options));
          lines.push('');
        }
        lines.push('---');
        lines.push('');
      }
    }

    // Indexes
    if (payload.hashtagIndex.length > 0) {
      lines.push('## INDEXES');
      lines.push('');
      lines.push('### Hashtags');
      for (const h of payload.hashtagIndex) {
        lines.push(`- ${h.tag} (${h.count} times: tweets ${h.tweets.join(',')})`);
      }
      lines.push('');
    }

    if (payload.mentionIndex.length > 0) {
      lines.push('### Mentions');
      for (const m of payload.mentionIndex) {
        lines.push(`- ${m.handle} (${m.count} times: tweets ${m.tweets.join(',')})`);
      }
      lines.push('');
    }

    if (payload.domainIndex.length > 0) {
      lines.push('### Domains');
      for (const d of payload.domainIndex) {
        lines.push(`- ${d.domain} (${d.count} links)`);
      }
      lines.push('');
    }

    // Summary
    if (payload.conversationSummary) {
      const cs = payload.conversationSummary;
      lines.push('## SUMMARY');
      lines.push(`Sort: ${cs.replySortMode} | OP replies: ${cs.opReplyCount} | Unique authors: ${cs.uniqueAuthors} | Max depth: ${cs.deepestThreadDepth}`);
    }

    return lines.join('\n');
  }

  /**
   * Format a single tweet for plain text output
   */
  function formatTweetPlain(tweet, options = {}) {
    const lines = [];
    const v = tweet.author.verified !== 'none' ? ` verified:${tweet.author.verified}` : '';
    const timestamp = options.includeTimestamps !== false ? ` - ${tweet.timestamp.display ?? 'null'}` : '';

    lines.push(`${tweet.author.name ?? 'null'} (${tweet.author.handle ?? 'null'})${v}${timestamp}`);

    if (tweet.threading.replyTo) {
      lines.push(`Replying to ${tweet.threading.replyTo}`);
    }

    if (tweet.text) lines.push(tweet.text);

    if (tweet.quotedTweet) {
      lines.push(`Quoted: ${tweet.quotedTweet.author.handle ?? 'null'} - ${tweet.quotedTweet.text ?? 'null'}`);
    }

    if (tweet.linkCard) {
      lines.push(`Link: ${tweet.linkCard.title || ''} - ${tweet.linkCard.url}`);
    }

    if (tweet.links.length > 0 && !tweet.linkCard) {
      lines.push(`Links: ${tweet.links.map(l => l.url).join(', ')}`);
    }

    if (tweet.images.length > 0 && options.includeImages !== false) {
      lines.push(`Images: ${tweet.images.map(i => i.url).join(', ')}`);
    }

    if (tweet.communityNote) {
      lines.push(`Community Note: ${tweet.communityNote}`);
    }

    if (options.includeEngagement !== false) {
      const e = tweet.engagement;
      const parts = [];
      if (e.replies) parts.push(`Replies:${e.replies}`);
      if (e.retweets) parts.push(`Retweets:${e.retweets}`);
      if (e.likes) parts.push(`Likes:${e.likes}`);
      if (e.bookmarks) parts.push(`Bookmarks:${e.bookmarks}`);
      if (e.views) parts.push(`Views:${e.views}`);
      if (parts.length > 0) lines.push(parts.join(' '));
    }

    return lines.join('\n');
  }

  /**
   * Format 3: Plain text
   */
  function formatPlain(payload, options = {}) {
    const lines = [];

    lines.push('X.com Post Context');
    lines.push(`URL: ${payload.meta.url}`);
    lines.push(`Extracted: ${payload.meta.extractedAt} | ${payload.meta.totalTweets} tweets | ~${payload.meta.estimatedTokens} tokens`);
    lines.push(`Tool: ${payload.meta.tool}`);
    lines.push('');
    lines.push('---');

    if (payload.meta.pageType === 'post') {
      if (payload.mainPost) {
        lines.push('MAIN POST');
        lines.push(formatTweetPlain(payload.mainPost, options));
        lines.push('');
        lines.push('---');
      }

      if (payload.replies.length > 0) {
        lines.push(`REPLIES (${payload.replies.length})`);
        lines.push('');
        for (let i = 0; i < payload.replies.length; i++) {
          const r = payload.replies[i];
          const depth = r.threading.depth > 1 ? ` [depth:${r.threading.depth}]` : '';
          const op = r.threading.isOp ? ' (OP)' : '';
          const replyTo = r.threading.replyTo ? ` replying to ${r.threading.replyTo}` : '';
          const timeLabel = options.includeTimestamps !== false ? ` - ${r.timestamp.display ?? 'null'}` : '';
          lines.push(`${i + 1}. ${r.author.handle ?? 'null'}${op}${timeLabel}${depth}${replyTo}`);
          lines.push(formatTweetPlain(r, options));
          lines.push('');
        }
        lines.push('---');
      }

    } else if (payload.meta.pageType === 'profile') {
      if (payload.profile) {
        const p = payload.profile;
        lines.push('PROFILE');
        lines.push(`${p.name} (${p.handle})`);
        if (p.bio) lines.push(`Bio: ${p.bio}`);
        if (p.followers) lines.push(`Followers: ${p.followers}`);
        if (p.following) lines.push(`Following: ${p.following}`);
        if (p.location) lines.push(`Location: ${p.location}`);
        if (p.joined) lines.push(p.joined);
        lines.push('');
        lines.push('---');
      }

      if (payload.posts.length > 0) {
        lines.push(`POSTS (${payload.posts.length})`);
        lines.push('');
        for (let i = 0; i < payload.posts.length; i++) {
          lines.push(`${i + 1}.`);
          lines.push(formatTweetPlain(payload.posts[i], options));
          lines.push('');
        }
        lines.push('---');
      }
    }

    // Indexes
    if (payload.hashtagIndex.length > 0) {
      lines.push(`HASHTAGS: ${payload.hashtagIndex.map(h => `${h.tag}(${h.count})`).join(' ')}`);
    }
    if (payload.mentionIndex.length > 0) {
      lines.push(`MENTIONS: ${payload.mentionIndex.map(m => `${m.handle}(${m.count})`).join(' ')}`);
    }
    if (payload.domainIndex.length > 0) {
      lines.push(`DOMAINS: ${payload.domainIndex.map(d => `${d.domain}(${d.count})`).join(' ')}`);
    }

    if (payload.conversationSummary) {
      const cs = payload.conversationSummary;
      lines.push(`SUMMARY: sort:${cs.replySortMode} op_replies:${cs.opReplyCount} authors:${cs.uniqueAuthors} max_depth:${cs.deepestThreadDepth}`);
    }

    return lines.join('\n');
  }

  // =========================================================================
  // MAIN — Execute extraction and return result
  // =========================================================================

  const url = window.location.href;
  const pageType = detectPageType(url);

  if (pageType === 'unsupported') {
    return {
      success: false,
      error: 'unsupported',
      message: 'Navigate to X.com to package a thread',
    };
  }

  try {
    let extractedData;
    if (pageType === 'post') {
      extractedData = extractPostPage();
    } else {
      extractedData = extractProfilePage();
    }

    if (extractedData.error) {
      return {
        success: false,
        error: 'no_content',
        message: extractedData.error,
      };
    }

    const payload = buildPayload(pageType, url, extractedData);

    // Generate all three formats from canonical payload
    const structured = formatStructured(payload);
    const markdown = formatMarkdown(payload);
    const plain = formatPlain(payload);

    // Calculate token estimates for the default (structured) format
    const tokens = estimateTokens(structured);
    payload.meta.estimatedTokens = tokens;
    payload.meta.tokenSize = classifyTokenSize(tokens);

    // Re-generate formatted strings with updated metadata
    const structuredFinal = formatStructured(payload);
    const markdownFinal = formatMarkdown(payload);
    const plainFinal = formatPlain(payload);

    return {
      success: true,
      pageType: pageType,
      stats: {
        tweets: payload.meta.totalTweets,
        links: payload.meta.totalLinks,
        images: payload.meta.totalImages,
        tokens: tokens,
        tokenSize: payload.meta.tokenSize,
      },
      structured: structuredFinal,
      markdown: markdownFinal,
      plain: plainFinal,
      payload: payload,
    };
  } catch {
    return {
      success: false,
      error: 'extraction_failed',
      message: 'Extraction failed — try refreshing the page and packaging again',
    };
  }

})();
