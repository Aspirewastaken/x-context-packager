/**
 * X Context Packager — Performance Worker
 * AdLab Open Source · v1.0.0
 * Moves heavy DOM-free render-model construction off the main thread.
 */

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function parseMetricValue(raw) {
  if (!raw) return -1;
  const text = String(raw).trim().toUpperCase().replace(/,/g, '');
  const match = text.match(/^(\d+(?:\.\d+)?)([KMB])?$/);
  if (!match) return Number.parseFloat(text) || -1;
  const value = Number.parseFloat(match[1]);
  const suffix = match[2];
  if (suffix === 'K') return value * 1000;
  if (suffix === 'M') return value * 1000000;
  if (suffix === 'B') return value * 1000000000;
  return value;
}

function buildConversationSummary(replies, replySortMode) {
  const uniqueAuthors = new Set();
  let opReplyCount = 0;
  let deepestThreadDepth = 0;
  let mostLikedReply = null;
  let mostLikedValue = -1;

  replies.forEach((reply, i) => {
    const authorHandle = reply?.author?.handle;
    if (authorHandle) uniqueAuthors.add(authorHandle.toLowerCase());

    const depth = Number(reply?.threading?.depth || 0);
    if (depth > deepestThreadDepth) deepestThreadDepth = depth;

    if (reply?.threading?.isOp) opReplyCount += 1;

    const likes = parseMetricValue(reply?.engagement?.likes);
    if (likes > mostLikedValue) {
      mostLikedValue = likes;
      mostLikedReply = reply?.engagement?.likes
        ? { index: i + 1, likes: reply.engagement.likes }
        : null;
    }
  });

  return {
    replySortMode: replySortMode || 'relevance',
    opReplyCount,
    uniqueAuthors: uniqueAuthors.size,
    deepestThreadDepth,
    mostLikedReply,
  };
}

function addDomain(domainMap, url, tweetNumber) {
  const domain = extractDomain(url);
  if (!domain) return;
  if (!domainMap[domain]) domainMap[domain] = { count: 0, tweets: [] };
  domainMap[domain].count += 1;
  if (!domainMap[domain].tweets.includes(tweetNumber)) {
    domainMap[domain].tweets.push(tweetNumber);
  }
}

function buildRenderModel(payload, options) {
  const startTime = Date.now();
  
  self.postMessage({ type: 'progress', message: 'Building render model...' });

  const pageType = payload?.meta?.pageType || 'post';
  const model = {
    meta: {
      url: payload?.meta?.url || '',
      extractedAt: payload?.meta?.extractedAt || new Date().toISOString(),
      pageType,
      page: payload?.meta?.page || 1,
      hasMore: payload?.meta?.hasMore || false,
      tool: payload?.meta?.tool || 'X Context Packager v1.0.0 by AdLab',
    },
    mainPost: payload?.mainPost || null,
    replies: [],
    profile: payload?.profile || null,
    posts: [],
    allLinks: [],
    allImages: [],
    hashtagIndex: [],
    mentionIndex: [],
    domainIndex: [],
    conversationSummary: null,
  };

  if (pageType === 'post') {
    const replies = Array.isArray(payload?.replies) ? payload.replies : [];
    if (options.maxReplies !== 'all') {
      const cap = Number.parseInt(options.maxReplies, 10);
      model.replies = Number.isFinite(cap) ? replies.slice(0, cap) : replies;
    } else {
      model.replies = replies;
    }
  } else {
    model.posts = Array.isArray(payload?.posts) ? payload.posts : [];
  }

  const postTweets = pageType === 'post'
    ? [model.mainPost, ...model.replies].filter(Boolean)
    : model.posts.slice();

  const hashtagMap = {};
  const mentionMap = {};
  const domainMap = {};

  postTweets.forEach((tweet, i) => {
    const context = pageType === 'post'
      ? (i === 0 ? 'main post' : `reply ${i}`)
      : `post ${i + 1}`;

    for (const tag of (tweet.hashtags || [])) {
      if (!hashtagMap[tag]) hashtagMap[tag] = { count: 0, tweets: [] };
      hashtagMap[tag].count += 1;
      hashtagMap[tag].tweets.push(i + 1);
    }

    for (const mention of (tweet.mentions || [])) {
      if (!mentionMap[mention]) mentionMap[mention] = { count: 0, tweets: [] };
      mentionMap[mention].count += 1;
      mentionMap[mention].tweets.push(i + 1);
    }

    for (const link of (tweet.links || [])) {
      model.allLinks.push({
        index: model.allLinks.length + 1,
        url: link.url,
        context,
      });
      addDomain(domainMap, link.url, i + 1);
    }

    if (tweet.quotedTweet) {
      for (const link of (tweet.quotedTweet.links || [])) {
        model.allLinks.push({
          index: model.allLinks.length + 1,
          url: link.url,
          context: `${context} (quoted)`,
        });
        addDomain(domainMap, link.url, i + 1);
      }
    }

    if (tweet.linkCard?.url) {
      model.allLinks.push({
        index: model.allLinks.length + 1,
        url: tweet.linkCard.url,
        context: `${context} (card)`,
      });
      addDomain(domainMap, tweet.linkCard.url, i + 1);
    }

    if (options.includeImages) {
      for (const image of (tweet.images || [])) {
        model.allImages.push({
          index: model.allImages.length + 1,
          url: image.url,
          alt: image.alt || null,
          context,
        });
      }
    }
  });

  model.hashtagIndex = Object.entries(hashtagMap)
    .map(([tag, data]) => ({ tag, count: data.count, tweets: data.tweets }))
    .sort((a, b) => b.count - a.count);

  model.mentionIndex = Object.entries(mentionMap)
    .map(([handle, data]) => ({ handle, count: data.count, tweets: data.tweets }))
    .sort((a, b) => b.count - a.count);

  model.domainIndex = Object.entries(domainMap)
    .map(([domain, data]) => ({ domain, count: data.count, tweets: data.tweets }))
    .sort((a, b) => b.count - a.count);

  model.meta.totalTweets = postTweets.length;
  model.meta.totalLinks = model.allLinks.length;
  model.meta.totalImages = model.allImages.length;

  if (pageType === 'post') {
    model.conversationSummary = buildConversationSummary(model.replies, payload?.conversationSummary?.replySortMode);
  }

  const timingMs = Date.now() - startTime;

  return { model, timingMs };
}

self.onmessage = function (e) {
  try {
    if (e.data.type === 'build-model') {
      const { payload, options, requestId } = e.data;
      const { model, timingMs } = buildRenderModel(payload, options);
      self.postMessage({
        type: 'model-built',
        model,
        timingMs,
        requestId
      });
    }
  } catch (err) {
    self.postMessage({
      type: 'error',
      error: err.message,
      requestId: e.data?.requestId
    });
  }
};