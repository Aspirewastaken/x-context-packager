/**
 * X Context Packager — Popup Logic
 * AdLab Open Source · v1.0.0
 *
 * State machine: IDLE → CHECK_PAGE → READY / NOT_SUPPORTED → EXTRACTING → COMPLETE
 * Follows DESIGN_PHILOSOPHY.md: one button, green check, done.
 */

(async function () {
  'use strict';

  // ── DOM References ──
  const modeLine = document.getElementById('mode-line');
  const errorState = document.getElementById('error-state');
  const actionArea = document.getElementById('action-area');
  const packageBtn = document.getElementById('package-btn');
  const btnText = document.getElementById('btn-text');
  const tokenIndicator = document.getElementById('token-indicator');
  const tokenDot = document.getElementById('token-dot');
  const tokenLabel = document.getElementById('token-label');
  const gearBtn = document.getElementById('gear-btn');
  const gearWrapper = document.getElementById('gear-wrapper');
  const statsDetail = document.getElementById('stats-detail');
  const statTweets = document.getElementById('stat-tweets');
  const statLinks = document.getElementById('stat-links');
  const statImages = document.getElementById('stat-images');
  const previewSection = document.getElementById('preview-section');
  const previewText = document.getElementById('preview-text');
  const packageAgainBtn = document.getElementById('package-again-btn');
  const formatBtns = document.querySelectorAll('.format-btn');
  const optEngagement = document.getElementById('opt-engagement');
  const optImages = document.getElementById('opt-images');
  const optTimestamps = document.getElementById('opt-timestamps');
  const optMaxReplies = document.getElementById('opt-max-replies');

  // Health monitoring elements
  const healthIndicator = document.getElementById('health-indicator');
  const healthDot = document.getElementById('health-dot');
  const healthLabel = document.getElementById('health-label');
  const healthIssues = document.getElementById('health-issues');

  // ── State ──
  let cachedResult = null;
  let currentFormat = 'structured';
  let gearExpanded = false;
  let packageButtonMode = 'extract'; // extract | extracting | copy

  // ── Load saved preferences ──
  const prefs = await loadPrefs();
  currentFormat = prefs.format || 'structured';
  gearExpanded = prefs.gearExpanded || false;

  // Apply saved format
  formatBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.format === currentFormat);
  });

  // Apply saved options
  optEngagement.checked = prefs.includeEngagement !== false;
  optImages.checked = prefs.includeImages !== false;
  optTimestamps.checked = prefs.includeTimestamps !== false;
  if (prefs.maxReplies) {
    optMaxReplies.value = prefs.maxReplies;
  }

  // Show gear panel if user prefers it expanded
  if (gearExpanded) {
    gearWrapper.classList.add('expanded');
  }

  // Load and display health status
  loadHealthStatus();

  // ── HEALTH MONITORING ──
  async function updateHealthIndicators(telemetry) {
    if (!healthIndicator || !telemetry) return;

    const systemHealth = telemetry.systemHealth || 1.0;
    const fallbackCount = telemetry.fallbacksTriggered || 0;
    const selfHealingCount = telemetry.selfHealingUsed || 0;

    // Determine health level
    let healthLevel = 'green';
    let healthText = 'Healthy';

    if (systemHealth < 0.5 || selfHealingCount > 10) {
      healthLevel = 'red';
      healthText = 'Needs Attention';
    } else if (systemHealth < 0.8 || fallbackCount > 5 || selfHealingCount > 3) {
      healthLevel = 'yellow';
      healthText = 'Monitoring';
    }

    // Update UI
    healthDot.className = `health-dot ${healthLevel}`;
    healthLabel.textContent = `System Health: ${healthText}`;

    // Show issues if any
    const issues = [];
    if (fallbackCount > 0) {
      issues.push(`${fallbackCount} selector fallback${fallbackCount > 1 ? 's' : ''} used`);
    }
    if (selfHealingCount > 0) {
      issues.push(`${selfHealingCount} self-healing operation${selfHealingCount > 1 ? 's' : ''} performed`);
    }
    if (systemHealth < 0.8) {
      issues.push(`System health: ${Math.round(systemHealth * 100)}%`);
    }

    if (issues.length > 0) {
      healthIssues.textContent = issues.join(' • ');
      healthIssues.classList.remove('hidden');
    } else {
      healthIssues.classList.add('hidden');
    }

    healthIndicator.classList.remove('hidden');
  }

  // Load and show current health status
  async function loadHealthStatus() {
    try {
      const result = await chrome.storage.local.get(['lastHealthReport', 'extractionQuality']);
      if (result.lastHealthReport) {
        const telemetry = {
          systemHealth: result.lastHealthReport.systemHealth || 1.0,
          fallbacksTriggered: result.lastHealthReport.sessionStats?.fallbacksTriggered || 0,
          selfHealingUsed: result.lastHealthReport.sessionStats?.selfHealingUsed || 0
        };
        updateHealthIndicators(telemetry);
      }
    } catch (e) {
      // Silent fail - health monitoring is nice-to-have
    }
  }

  // ── CHECK PAGE — Determine if we're on X.com ──
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabUrl = tab?.url || '';
  const isXcom = (() => {
    try {
      const host = new URL(tabUrl).hostname.replace(/^www\./, '');
      return host === 'x.com' || host === 'twitter.com';
    } catch {
      return false;
    }
  })();

  if (!isXcom) {
    // Not on X.com — show calm message
    actionArea.classList.add('hidden');
    gearBtn.classList.add('hidden');
    errorState.classList.remove('hidden');
    return;
  }

  // Detect mode from URL
  const isPost = /\/status\/\d+/.test(tabUrl);
  const pathMatch = tabUrl.match(/(?:x\.com|twitter\.com)\/([^/?#]+)/);
  const username = pathMatch ? pathMatch[1] : '';
  const modeText = isPost
    ? `Post Page · @${username}/status/...`
    : `Profile · @${username}`;
  modeLine.textContent = modeText;
  modeLine.classList.remove('hidden');

  // ── PACKAGE BUTTON CLICK ──
  packageBtn.addEventListener('click', async () => {
    if (packageButtonMode === 'extract') {
      await runExtraction();
      return;
    }

    if (packageButtonMode === 'copy' && cachedResult) {
      await renderAndCopyFromCache();
      flashCopied();
    }
  });

  // ── PACKAGE AGAIN BUTTON ──
  packageAgainBtn.addEventListener('click', async () => {
    await runExtraction();
  });

  // ── GEAR TOGGLE ──
  gearBtn.addEventListener('click', () => {
    gearExpanded = !gearExpanded;
    gearWrapper.classList.toggle('expanded', gearExpanded);
    savePrefs({ gearExpanded });
  });

  // ── FORMAT SWITCHING ──
  formatBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      currentFormat = btn.dataset.format;
      formatBtns.forEach(b => b.classList.toggle('active', b === btn));
      savePrefs({ format: currentFormat });

      // If we have cached data, re-render and copy
      if (cachedResult) {
        await renderAndCopyFromCache();
        flashCopied();
      }
    });
  });

  // ── OPTIONS CHANGE ──
  [
    { el: optEngagement, key: 'includeEngagement' },
    { el: optImages, key: 'includeImages' },
    { el: optTimestamps, key: 'includeTimestamps' },
  ].forEach(({ el, key }) => {
    el.addEventListener('change', async (e) => {
      await savePrefs({ [key]: e.target.checked });
      if (cachedResult) {
        await renderAndCopyFromCache();
        flashCopied();
      }
    });
  });

  optMaxReplies.addEventListener('change', async (e) => {
    await savePrefs({ maxReplies: e.target.value });
    if (cachedResult) {
      await renderAndCopyFromCache();
      flashCopied();
    }
  });

  // ── EXTRACTION ──
  async function runExtraction() {
    packageButtonMode = 'extracting';

    // Set button to extracting state
    packageBtn.classList.add('extracting');
    packageBtn.classList.remove('success', 'copy-again');
    btnText.textContent = '📦 Packaging...';
    packageBtn.disabled = true;
    tokenIndicator.classList.add('hidden');

    try {
      // Inject content script and get result
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content/content.js'],
      });

      const result = results?.[0]?.result;

      if (!result || !result.success) {
        showError(result?.message || 'Extraction failed');
        return;
      }

      cachedResult = result;

      // Render selected format from cached payload and copy
      const text = await renderAndCopyFromCache();

      // Update UI — success state
      packageBtn.classList.remove('extracting');
      packageBtn.classList.add('success');
      btnText.textContent = '✅ Copied';
      packageBtn.disabled = false;
      packageButtonMode = 'copy';

      // Update preview
      updatePreview(text);
      previewSection.classList.remove('hidden');

      // Show package again button
      packageAgainBtn.classList.remove('hidden');

      // Update health indicators if telemetry available
      if (result.telemetry) {
        updateHealthIndicators(result.telemetry);
      }

      // After 3 seconds, change to "Copy Again"
      setTimeout(() => {
        if (packageBtn.classList.contains('success')) {
          packageBtn.classList.remove('success');
          packageBtn.classList.add('copy-again');
          btnText.textContent = '📋 Copy Again';
          packageButtonMode = 'copy';
        }
      }, 3000);

    } catch {
      showError('Failed to extract — try refreshing the page');
      packageButtonMode = 'extract';
    }
  }

  // ── HELPERS ──

  function getCurrentOptions() {
    return {
      includeEngagement: optEngagement.checked,
      includeImages: optImages.checked,
      includeTimestamps: optTimestamps.checked,
      maxReplies: optMaxReplies.value || 'all',
    };
  }

  async function renderAndCopyFromCache() {
    if (!cachedResult || !cachedResult.payload) return '';

    const options = getCurrentOptions();
    const renderModel = buildRenderModel(cachedResult.payload, options);
    const text = renderFormattedText(renderModel, currentFormat, options);

    await copyToClipboard(text);
    updatePreview(text);
    updateStatsAndToken(renderModel, text);

    return text;
  }

  function buildRenderModel(payload, options) {
    const pageType = payload?.meta?.pageType || 'post';
    const model = {
      meta: {
        url: payload?.meta?.url || '',
        extractedAt: payload?.meta?.extractedAt || new Date().toISOString(),
        pageType,
        page: payload?.meta?.page || 1,
        tool: payload?.meta?.tool || 'X Context Packager v1.0.0 by AdLab',
      },
      mainPost: payload?.mainPost || null,
      parentContext: [],
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
      model.parentContext = Array.isArray(payload?.parentContext) ? payload.parentContext : [];
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

    // Include parent context tweets in aggregation (consistent with content.js buildPayload)
    const postTweets = pageType === 'post'
      ? [...model.parentContext, model.mainPost, ...model.replies].filter(Boolean)
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

    return model;
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

  function renderFormattedText(model, format, options) {
    switch (format) {
      case 'markdown':
        return formatMarkdown(model, options);
      case 'plain':
        return formatPlain(model, options);
      default:
        return formatStructured(model, options);
    }
  }

  function updateStatsAndToken(model, text) {
    const tokens = estimateTokens(text);
    const tokenSize = classifyTokenSize(tokens);

    tokenDot.className = `token-dot ${tokenSize.level}`;
    tokenLabel.textContent = `~${formatNumber(tokens)} tokens — ${tokenSize.label}`;
    tokenIndicator.classList.remove('hidden');

    statTweets.textContent = `${model.meta.totalTweets} tweets`;
    statLinks.textContent = `${model.meta.totalLinks} links`;
    statImages.textContent = `${model.meta.totalImages} images`;
    statsDetail.classList.remove('hidden');
  }

  function estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }

  function estimateModelTokens(model) {
    return estimateTokens(JSON.stringify(model || {}));
  }

  function classifyTokenSize(tokens) {
    if (tokens < 2000) return { level: 'green', label: 'Fits any LLM context' };
    if (tokens < 8000) return { level: 'yellow', label: 'Medium context' };
    if (tokens < 32000) return { level: 'orange', label: 'Large context — use 100K+ models' };
    return { level: 'red', label: 'Very large — consider truncating' };
  }

  function escXml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function xmlAttr(name, value) {
    if (value === null || value === undefined || value === '') return '';
    return ` ${name}="${escXml(value)}"`;
  }

  function formatStructured(model, options) {
    const lines = [];

    lines.push('<x_context>');
    lines.push('<meta>');
    lines.push(`  <url>${escXml(model.meta.url)}</url>`);
    lines.push(`  <extracted_at>${escXml(model.meta.extractedAt)}</extracted_at>`);
    lines.push(`  <page_type>${escXml(model.meta.pageType)}</page_type>`);
    lines.push(`  <total_tweets>${model.meta.totalTweets}</total_tweets>`);
    lines.push(`  <total_links>${model.meta.totalLinks}</total_links>`);
    lines.push(`  <total_images>${model.meta.totalImages}</total_images>`);
    lines.push(`  <estimated_tokens>~${estimateModelTokens(model)}</estimated_tokens>`);
    lines.push(`  <page>${model.meta.page} of ?</page>`);
    lines.push(`  <tool>${escXml(model.meta.tool)}</tool>`);
    lines.push('</meta>');
    lines.push('');

    if (model.meta.pageType === 'post') {
      if (model.parentContext && model.parentContext.length > 0) {
        lines.push(`<parent_context count="${model.parentContext.length}">`);
        model.parentContext.forEach((parent, i) => {
          lines.push(formatStructuredTweet(parent, 'parent', options, xmlAttr('index', i + 1)));
        });
        lines.push('</parent_context>');
        lines.push('');
      }

      if (model.mainPost) {
        lines.push(formatStructuredTweet(model.mainPost, 'main_post', options));
        lines.push('');
      }

      if (model.replies.length > 0) {
        lines.push(`<replies count="${model.replies.length}">`);
        model.replies.forEach((reply, i) => {
          const attrs = [
            xmlAttr('index', i + 1),
            xmlAttr('depth', reply?.threading?.depth),
            xmlAttr('reply_to', reply?.threading?.replyTo),
            xmlAttr('is_op', reply?.threading?.isOp),
          ].join('');
          lines.push(formatStructuredTweet(reply, 'reply', options, attrs));
        });
        lines.push('</replies>');
        lines.push('');
      }
    } else if (model.meta.pageType === 'profile') {
      if (model.profile) {
        lines.push('<profile>');
        if (model.profile.name !== null) lines.push(`  <name>${escXml(model.profile.name)}</name>`);
        if (model.profile.handle !== null) lines.push(`  <handle>${escXml(model.profile.handle)}</handle>`);
        if (model.profile.bio !== null) lines.push(`  <bio>${escXml(model.profile.bio)}</bio>`);
        if (model.profile.location !== null) lines.push(`  <location>${escXml(model.profile.location)}</location>`);
        if (model.profile.website !== null) lines.push(`  <website>${escXml(model.profile.website)}</website>`);
        if (model.profile.joined !== null) lines.push(`  <joined>${escXml(model.profile.joined)}</joined>`);
        if (model.profile.following !== null) lines.push(`  <following>${escXml(model.profile.following)}</following>`);
        if (model.profile.followers !== null) lines.push(`  <followers>${escXml(model.profile.followers)}</followers>`);
        lines.push('</profile>');
        lines.push('');
      }

      if (model.posts.length > 0) {
        lines.push(`<posts count="${model.posts.length}">`);
        model.posts.forEach((post, i) => {
          lines.push(formatStructuredTweet(post, 'post', options, xmlAttr('index', i + 1)));
        });
        lines.push('</posts>');
        lines.push('');
      }
    }

    if (model.allLinks.length > 0) {
      lines.push('<all_links>');
      model.allLinks.forEach((link) => {
        lines.push(`  <link index="${link.index}" url="${escXml(link.url)}" context="${escXml(link.context)}"/>`);
      });
      lines.push('</all_links>');
      lines.push('');
    }

    if (options.includeImages && model.allImages.length > 0) {
      lines.push('<all_images>');
      model.allImages.forEach((image) => {
        let attrs = `index="${image.index}" url="${escXml(image.url)}" context="${escXml(image.context)}"`;
        if (image.alt) attrs += ` alt="${escXml(image.alt)}"`;
        lines.push(`  <image ${attrs}/>`);
      });
      lines.push('</all_images>');
      lines.push('');
    }

    if (model.hashtagIndex.length > 0) {
      lines.push('<hashtag_index>');
      model.hashtagIndex.forEach((item) => {
        lines.push(`  <hashtag tag="${escXml(item.tag)}" count="${item.count}" tweets="${item.tweets.join(',')}"/>`);
      });
      lines.push('</hashtag_index>');
      lines.push('');
    }

    if (model.mentionIndex.length > 0) {
      lines.push('<mention_index>');
      model.mentionIndex.forEach((item) => {
        lines.push(`  <mention handle="${escXml(item.handle)}" count="${item.count}" tweets="${item.tweets.join(',')}"/>`);
      });
      lines.push('</mention_index>');
      lines.push('');
    }

    if (model.domainIndex.length > 0) {
      lines.push('<domain_index>');
      model.domainIndex.forEach((item) => {
        lines.push(`  <domain name="${escXml(item.domain)}" count="${item.count}" tweets="${item.tweets.join(',')}"/>`);
      });
      lines.push('</domain_index>');
      lines.push('');
    }

    if (model.conversationSummary) {
      lines.push('<conversation_summary>');
      lines.push(`  <reply_sort_mode>${escXml(model.conversationSummary.replySortMode)}</reply_sort_mode>`);
      lines.push(`  <op_reply_count>${model.conversationSummary.opReplyCount}</op_reply_count>`);
      lines.push(`  <unique_authors>${model.conversationSummary.uniqueAuthors}</unique_authors>`);
      lines.push(`  <deepest_thread_depth>${model.conversationSummary.deepestThreadDepth}</deepest_thread_depth>`);
      if (model.conversationSummary.mostLikedReply) {
        lines.push(`  <most_liked_reply index="${model.conversationSummary.mostLikedReply.index}" likes="${escXml(model.conversationSummary.mostLikedReply.likes)}"/>`);
      }
      lines.push('</conversation_summary>');
    }

    lines.push('</x_context>');

    return lines.join('\n');
  }

  function formatStructuredTweet(tweet, tag, options, attrs = '') {
    const lines = [];
    const indent = tag === 'main_post' ? '  ' : '    ';

    lines.push(`<${tag}${attrs}>`);

    const authorAttrs = [
      xmlAttr('name', tweet?.author?.name),
      xmlAttr('handle', tweet?.author?.handle),
      xmlAttr('verified', tweet?.author?.verified || 'none'),
      xmlAttr('followers', tweet?.author?.followers),
      xmlAttr('following', tweet?.author?.following),
    ].join('');
    lines.push(`${indent}<author${authorAttrs}/>`);

    if (options.includeTimestamps && (tweet?.timestamp?.iso || tweet?.timestamp?.display)) {
      lines.push(`${indent}<timestamp${xmlAttr('iso', tweet.timestamp.iso)}${xmlAttr('display', tweet.timestamp.display)}/>`);
    }

    if (tweet?.text) {
      lines.push(`${indent}<text>`);
      lines.push(`${indent}${escXml(tweet.text)}`);
      lines.push(`${indent}</text>`);
    }

    if ((tweet?.hashtags || []).length > 0) {
      lines.push(`${indent}<hashtags>${escXml(tweet.hashtags.join(' '))}</hashtags>`);
    }

    if ((tweet?.links || []).length > 0) {
      lines.push(`${indent}<links>`);
      tweet.links.forEach((link) => {
        lines.push(`${indent}  <link${xmlAttr('url', link.url)}${xmlAttr('display', link.display)}/>`);
      });
      lines.push(`${indent}</links>`);
    }

    if (options.includeImages && (tweet?.images || []).length > 0) {
      lines.push(`${indent}<images>`);
      tweet.images.forEach((image) => {
        lines.push(`${indent}  <image${xmlAttr('url', image.url)}${xmlAttr('alt', image.alt)}/>`);
      });
      lines.push(`${indent}</images>`);
    }

    if (tweet?.video) lines.push(`${indent}<video present="true"/>`);
    if (tweet?.gif) lines.push(`${indent}<gif present="true"/>`);

    if (tweet?.quotedTweet) {
      const qt = tweet.quotedTweet;
      lines.push(`${indent}<quoted_tweet>`);
      lines.push(`${indent}  <author${xmlAttr('name', qt.author?.name)}${xmlAttr('handle', qt.author?.handle)}${xmlAttr('verified', qt.author?.verified || 'none')}/>`);
      if (qt.text) lines.push(`${indent}  <text>${escXml(qt.text)}</text>`);
      if ((qt.links || []).length > 0) {
        lines.push(`${indent}  <links>`);
        qt.links.forEach((link) => {
          lines.push(`${indent}    <link${xmlAttr('url', link.url)}${xmlAttr('display', link.display)}/>`);
        });
        lines.push(`${indent}  </links>`);
      }
      lines.push(`${indent}</quoted_tweet>`);
    }

    if (tweet?.linkCard) {
      lines.push(`${indent}<link_card${xmlAttr('domain', tweet.linkCard.domain)}${xmlAttr('title', tweet.linkCard.title)}${xmlAttr('description', tweet.linkCard.description)}${xmlAttr('url', tweet.linkCard.url)}/>`);
    }

    if (tweet?.communityNote) {
      lines.push(`${indent}<community_note>${escXml(tweet.communityNote)}</community_note>`);
    }

    if (tweet?.poll?.options?.length) {
      lines.push(`${indent}<poll>`);
      tweet.poll.options.forEach((option) => {
        lines.push(`${indent}  <option${xmlAttr('votes', option.votes)}>${escXml(option.label)}</option>`);
      });
      if (tweet.poll.totalVotes) {
        lines.push(`${indent}  <total_votes>${escXml(tweet.poll.totalVotes)}</total_votes>`);
      }
      lines.push(`${indent}</poll>`);
    }

    if (options.includeEngagement) {
      const engagementAttrs = [
        xmlAttr('replies', tweet?.engagement?.replies),
        xmlAttr('retweets', tweet?.engagement?.retweets),
        xmlAttr('quotes', tweet?.engagement?.quotes),
        xmlAttr('likes', tweet?.engagement?.likes),
        xmlAttr('bookmarks', tweet?.engagement?.bookmarks),
        xmlAttr('views', tweet?.engagement?.views),
      ].join('');
      if (engagementAttrs) lines.push(`${indent}<engagement${engagementAttrs}/>`);
    }

    const flags = tweet?.flags || {};
    if (flags.sensitive || flags.translated || flags.truncated || flags.repost) {
      lines.push(`${indent}<flags${xmlAttr('sensitive', Boolean(flags.sensitive))}${xmlAttr('translated', Boolean(flags.translated))}${xmlAttr('truncated', Boolean(flags.truncated))}${xmlAttr('repost', Boolean(flags.repost))}/>`);
    }

    lines.push(`</${tag}>`);
    return lines.join('\n');
  }

  function formatMarkdown(model, options) {
    const lines = [];

    lines.push('# X.com Post Context');
    lines.push(`**URL:** ${model.meta.url}`);
    lines.push(`**Extracted:** ${model.meta.extractedAt} | ${model.meta.totalTweets} tweets | ${model.meta.totalLinks} links | ${model.meta.totalImages} images | ~${estimateModelTokens(model)} tokens`);
    lines.push(`**Tool:** ${model.meta.tool}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    if (model.meta.pageType === 'post') {
      if (model.parentContext && model.parentContext.length > 0) {
        lines.push('## THREAD CONTEXT');
        lines.push('*Tweets this post is replying to, in chronological order:*');
        lines.push('');
        model.parentContext.forEach((parent, i) => {
          lines.push(`### ${i + 1}.`);
          lines.push(formatMarkdownTweet(parent, options));
          lines.push('');
        });
        lines.push('---');
        lines.push('');
      }

      if (model.mainPost) {
        lines.push('## MAIN POST');
        lines.push(formatMarkdownTweet(model.mainPost, options));
        lines.push('');
        lines.push('---');
        lines.push('');
      }

      if (model.replies.length > 0) {
        lines.push(`## REPLIES (${model.replies.length})`);
        lines.push('');
        model.replies.forEach((reply, i) => {
          const depth = reply?.threading?.depth > 1 ? ` [depth: ${reply.threading.depth}]` : '';
          const op = reply?.threading?.isOp ? ' (OP)' : '';
          const headerBits = [reply?.author?.handle || 'null', op, depth].join('');
          lines.push(`### ${i + 1}. ${headerBits}`.trim());
          lines.push(formatMarkdownTweet(reply, options));
          lines.push('');
        });
        lines.push('---');
        lines.push('');
      }
    } else {
      if (model.profile) {
        lines.push('## PROFILE');
        lines.push(`**${model.profile.name ?? 'null'}** (${model.profile.handle ?? 'null'})`);
        if (model.profile.bio) lines.push(`> ${model.profile.bio}`);
        const profileMeta = [];
        if (model.profile.followers) profileMeta.push(`${model.profile.followers} followers`);
        if (model.profile.following) profileMeta.push(`${model.profile.following} following`);
        if (model.profile.location) profileMeta.push(model.profile.location);
        if (model.profile.joined) profileMeta.push(model.profile.joined);
        if (profileMeta.length > 0) lines.push(profileMeta.join(' · '));
        lines.push('');
      }

      if (model.posts.length > 0) {
        lines.push('## POSTS');
        lines.push('');
        model.posts.forEach((post, i) => {
          lines.push(`### ${i + 1}.`);
          lines.push(formatMarkdownTweet(post, options));
          lines.push('');
        });
      }
    }

    appendIndexesMarkdown(lines, model);
    return lines.join('\n');
  }

  function formatMarkdownTweet(tweet, options) {
    const lines = [];
    const verified = tweet?.author?.verified && tweet.author.verified !== 'none'
      ? ` · ✓ ${tweet.author.verified}`
      : '';

    const authorName = tweet?.author?.name ?? 'null';
    const authorHandle = tweet?.author?.handle ?? 'null';
    const timePart = options.includeTimestamps ? ` · ${tweet?.timestamp?.display ?? 'null'}` : '';
    lines.push(`**${authorName}** (${authorHandle})${verified}${timePart}`);

    if (tweet?.threading?.replyTo) lines.push(`> Replying to ${tweet.threading.replyTo}`);
    if (tweet?.text) lines.push('', tweet.text);

    if (tweet?.quotedTweet) {
      lines.push('');
      lines.push(`> **Quoted:** ${tweet.quotedTweet.author?.handle ?? 'null'} — ${tweet.quotedTweet.text ?? 'null'}`);
    }

    if (tweet?.linkCard?.url) {
      const title = tweet.linkCard.title || tweet.linkCard.domain || tweet.linkCard.url;
      lines.push(`🔗 [${title}](${tweet.linkCard.url})`);
    } else if ((tweet?.links || []).length > 0) {
      tweet.links.forEach((link) => lines.push(`🔗 [${link.display || link.url}](${link.url})`));
    }

    if (options.includeImages && (tweet?.images || []).length > 0) {
      tweet.images.forEach((image) => {
        lines.push(`🖼️ ${image.url}${image.alt ? ` (${image.alt})` : ''}`);
      });
    }

    if (tweet?.communityNote) lines.push(`📝 Community Note: ${tweet.communityNote}`);

    if (options.includeEngagement) {
      const parts = [];
      if (tweet?.engagement?.replies) parts.push(`💬 ${tweet.engagement.replies}`);
      if (tweet?.engagement?.retweets) parts.push(`🔁 ${tweet.engagement.retweets}`);
      if (tweet?.engagement?.likes) parts.push(`❤️ ${tweet.engagement.likes}`);
      if (tweet?.engagement?.bookmarks) parts.push(`🔖 ${tweet.engagement.bookmarks}`);
      if (tweet?.engagement?.views) parts.push(`👁 ${tweet.engagement.views}`);
      if (parts.length > 0) lines.push(parts.join(' · '));
    }

    return lines.join('\n');
  }

  function appendIndexesMarkdown(lines, model) {
    if (model.hashtagIndex.length === 0 && model.mentionIndex.length === 0 && model.domainIndex.length === 0 && !model.conversationSummary) {
      return;
    }

    lines.push('## INDEXES');
    lines.push('');

    if (model.hashtagIndex.length > 0) {
      lines.push('### Hashtags');
      model.hashtagIndex.forEach((item) => {
        lines.push(`- ${item.tag} (${item.count} times: tweets ${item.tweets.join(',')})`);
      });
      lines.push('');
    }

    if (model.mentionIndex.length > 0) {
      lines.push('### Mentions');
      model.mentionIndex.forEach((item) => {
        lines.push(`- ${item.handle} (${item.count} times: tweets ${item.tweets.join(',')})`);
      });
      lines.push('');
    }

    if (model.domainIndex.length > 0) {
      lines.push('### Domains');
      model.domainIndex.forEach((item) => {
        lines.push(`- ${item.domain} (${item.count} links)`);
      });
      lines.push('');
    }

    if (model.conversationSummary) {
      lines.push('## SUMMARY');
      lines.push(`Sort: ${model.conversationSummary.replySortMode} | OP replies: ${model.conversationSummary.opReplyCount} | Unique authors: ${model.conversationSummary.uniqueAuthors} | Max depth: ${model.conversationSummary.deepestThreadDepth}`);
    }
  }

  function formatPlain(model, options) {
    const lines = [];
    lines.push('X.com Post Context');
    lines.push(`URL: ${model.meta.url}`);
    lines.push(`Extracted: ${model.meta.extractedAt} | ${model.meta.totalTweets} tweets | ~${estimateModelTokens(model)} tokens`);
    lines.push(`Tool: ${model.meta.tool}`);
    lines.push('');
    lines.push('---');

    if (model.meta.pageType === 'post') {
      if (model.parentContext && model.parentContext.length > 0) {
        lines.push(`THREAD CONTEXT (${model.parentContext.length})`);
        lines.push('');
        model.parentContext.forEach((parent, i) => {
          lines.push(`${i + 1}.`);
          lines.push(formatPlainTweet(parent, options));
          lines.push('');
        });
        lines.push('---');
      }

      if (model.mainPost) {
        lines.push('MAIN POST');
        lines.push(formatPlainTweet(model.mainPost, options));
        lines.push('');
        lines.push('---');
      }

      if (model.replies.length > 0) {
        lines.push(`REPLIES (${model.replies.length})`);
        lines.push('');
        model.replies.forEach((reply, i) => {
          const depth = reply?.threading?.depth ? ` depth:${reply.threading.depth}` : '';
          const op = reply?.threading?.isOp ? ' OP' : '';
          const replyTo = reply?.threading?.replyTo ? ` replying_to:${reply.threading.replyTo}` : '';
          lines.push(`${i + 1}. ${(reply?.author?.handle ?? 'null')}${op}${depth}${replyTo}`);
          lines.push(formatPlainTweet(reply, options));
          lines.push('');
        });
        lines.push('---');
      }
    } else {
      if (model.profile) {
        lines.push('PROFILE');
        lines.push(`${model.profile.name ?? 'null'} (${model.profile.handle ?? 'null'})`);
        if (model.profile.bio) lines.push(`Bio: ${model.profile.bio}`);
        if (model.profile.followers) lines.push(`Followers: ${model.profile.followers}`);
        if (model.profile.following) lines.push(`Following: ${model.profile.following}`);
        if (model.profile.location) lines.push(`Location: ${model.profile.location}`);
        if (model.profile.joined) lines.push(`Joined: ${model.profile.joined}`);
        lines.push('');
        lines.push('---');
      }

      if (model.posts.length > 0) {
        lines.push(`POSTS (${model.posts.length})`);
        lines.push('');
        model.posts.forEach((post, i) => {
          lines.push(`${i + 1}.`);
          lines.push(formatPlainTweet(post, options));
          lines.push('');
        });
        lines.push('---');
      }
    }

    if (model.hashtagIndex.length > 0) {
      lines.push(`HASHTAGS: ${model.hashtagIndex.map((item) => `${item.tag}(${item.count})`).join(' ')}`);
    }
    if (model.mentionIndex.length > 0) {
      lines.push(`MENTIONS: ${model.mentionIndex.map((item) => `${item.handle}(${item.count})`).join(' ')}`);
    }
    if (model.domainIndex.length > 0) {
      lines.push(`DOMAINS: ${model.domainIndex.map((item) => `${item.domain}(${item.count})`).join(' ')}`);
    }
    if (model.conversationSummary) {
      lines.push(`SUMMARY: sort:${model.conversationSummary.replySortMode} op_replies:${model.conversationSummary.opReplyCount} authors:${model.conversationSummary.uniqueAuthors} max_depth:${model.conversationSummary.deepestThreadDepth}`);
    }

    return lines.join('\n');
  }

  function formatPlainTweet(tweet, options) {
    const lines = [];
    const verified = tweet?.author?.verified && tweet.author.verified !== 'none'
      ? ` verified:${tweet.author.verified}`
      : '';
    const timePart = options.includeTimestamps ? ` - ${tweet?.timestamp?.display ?? 'null'}` : '';
    lines.push(`${tweet?.author?.name ?? 'null'} (${tweet?.author?.handle ?? 'null'})${verified}${timePart}`);

    if (tweet?.threading?.replyTo) lines.push(`Replying to ${tweet.threading.replyTo}`);
    if (tweet?.text) lines.push(tweet.text);

    if (tweet?.quotedTweet) {
      lines.push(`Quoted: ${tweet.quotedTweet.author?.handle ?? 'null'} - ${tweet.quotedTweet.text ?? 'null'}`);
    }

    if (tweet?.linkCard?.url) {
      lines.push(`Link: ${tweet.linkCard.title || tweet.linkCard.url} - ${tweet.linkCard.url}`);
    } else if ((tweet?.links || []).length > 0) {
      lines.push(`Links: ${tweet.links.map((link) => link.url).join(', ')}`);
    }

    if (options.includeImages && (tweet?.images || []).length > 0) {
      lines.push(`Images: ${tweet.images.map((image) => image.url).join(', ')}`);
    }

    if (tweet?.communityNote) {
      lines.push(`Community Note: ${tweet.communityNote}`);
    }

    if (options.includeEngagement) {
      const parts = [];
      if (tweet?.engagement?.replies) parts.push(`Replies:${tweet.engagement.replies}`);
      if (tweet?.engagement?.retweets) parts.push(`Retweets:${tweet.engagement.retweets}`);
      if (tweet?.engagement?.likes) parts.push(`Likes:${tweet.engagement.likes}`);
      if (tweet?.engagement?.bookmarks) parts.push(`Bookmarks:${tweet.engagement.bookmarks}`);
      if (tweet?.engagement?.views) parts.push(`Views:${tweet.engagement.views}`);
      if (parts.length > 0) lines.push(parts.join(' '));
    }

    return lines.join('\n');
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  }

  function flashCopied() {
    packageBtn.classList.remove('copy-again');
    packageBtn.classList.add('success');
    btnText.textContent = '✅ Copied';
    packageButtonMode = 'copy';
    setTimeout(() => {
      packageBtn.classList.remove('success');
      packageBtn.classList.add('copy-again');
      btnText.textContent = '📋 Copy Again';
      packageButtonMode = 'copy';
    }, 3000);
  }

  function showError(message) {
    packageBtn.classList.remove('extracting');
    packageBtn.disabled = false;
    packageBtn.classList.remove('copy-again', 'success');
    btnText.textContent = '📦 Package';
    packageButtonMode = 'extract';
    // Show error briefly via token indicator
    tokenDot.className = 'token-dot red';
    tokenLabel.textContent = message;
    tokenIndicator.classList.remove('hidden');
  }

  function updatePreview(text) {
    // Show first 500 chars
    previewText.textContent = text.substring(0, 500) + (text.length > 500 ? '\n...' : '');
  }

  function formatNumber(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  }

  async function loadPrefs() {
    try {
      const result = await chrome.storage.local.get([
        'format', 'gearExpanded', 'includeEngagement',
        'includeImages', 'includeTimestamps', 'maxReplies'
      ]);
      return result || {};
    } catch {
      return {};
    }
  }

  async function savePrefs(updates) {
    try {
      await chrome.storage.local.set(updates);
    } catch {
      // Silently fail — prefs are nice-to-have
    }
  }

})();
