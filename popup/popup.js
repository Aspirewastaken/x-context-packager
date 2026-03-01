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
  const gearPanel = document.getElementById('gear-panel');
  const statsDetail = document.getElementById('stats-detail');
  const statTweets = document.getElementById('stat-tweets');
  const statLinks = document.getElementById('stat-links');
  const statImages = document.getElementById('stat-images');
  const previewSection = document.getElementById('preview-section');
  const previewText = document.getElementById('preview-text');
  const packageAgainBtn = document.getElementById('package-again-btn');
  const formatBtns = document.querySelectorAll('.format-btn');

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
  document.getElementById('opt-engagement').checked = prefs.includeEngagement !== false;
  document.getElementById('opt-images').checked = prefs.includeImages !== false;
  document.getElementById('opt-timestamps').checked = prefs.includeTimestamps !== false;
  if (prefs.maxReplies) {
    document.getElementById('opt-max-replies').value = prefs.maxReplies;
  }

  // Show gear panel if user prefers it expanded
  if (gearExpanded) {
    gearPanel.classList.remove('hidden');
  }

  // ── CHECK PAGE — Determine if we're on X.com ──
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabUrl = tab?.url || '';
  const isXcom = /^https:\/\/(www\.)?(x\.com|twitter\.com)/.test(tabUrl);

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
      const text = getFormattedText(cachedResult, currentFormat);
      await copyToClipboard(text);
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
    gearPanel.classList.toggle('hidden', !gearExpanded);
    savePrefs({ gearExpanded });
  });

  // ── FORMAT SWITCHING ──
  formatBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      currentFormat = btn.dataset.format;
      formatBtns.forEach(b => b.classList.toggle('active', b === btn));
      savePrefs({ format: currentFormat });

      // If we have cached data, re-render and copy
      if (cachedResult) {
        const text = getFormattedText(cachedResult, currentFormat);
        copyToClipboard(text);
        updatePreview(text);
        flashCopied();
      }
    });
  });

  // ── OPTIONS CHANGE ──
  ['opt-engagement', 'opt-images', 'opt-timestamps'].forEach(id => {
    document.getElementById(id).addEventListener('change', (e) => {
      const key = id.replace('opt-', 'include').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      // Map: opt-engagement → includeEngagement
      const prefKey = id === 'opt-engagement' ? 'includeEngagement'
        : id === 'opt-images' ? 'includeImages'
        : 'includeTimestamps';
      savePrefs({ [prefKey]: e.target.checked });
    });
  });

  document.getElementById('opt-max-replies').addEventListener('change', (e) => {
    savePrefs({ maxReplies: e.target.value });
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

      // Get formatted text for current format
      const text = getFormattedText(result, currentFormat);

      // Copy to clipboard
      await copyToClipboard(text);

      // Update UI — success state
      packageBtn.classList.remove('extracting');
      packageBtn.classList.add('success');
      btnText.textContent = '✅ Copied';
      packageBtn.disabled = false;
      packageButtonMode = 'copy';

      // Show token indicator
      const ts = result.stats.tokenSize;
      tokenDot.className = `token-dot ${ts.level}`;
      tokenLabel.textContent = `~${formatNumber(result.stats.tokens)} tokens — ${ts.label}`;
      tokenIndicator.classList.remove('hidden');

      // Update stats in gear panel
      statTweets.textContent = `${result.stats.tweets} tweets`;
      statLinks.textContent = `${result.stats.links} links`;
      statImages.textContent = `${result.stats.images} images`;
      statsDetail.classList.remove('hidden');

      // Update preview
      updatePreview(text);
      previewSection.classList.remove('hidden');

      // Show package again button
      packageAgainBtn.classList.remove('hidden');

      // After 3 seconds, change to "Copy Again"
      setTimeout(() => {
        if (packageBtn.classList.contains('success')) {
          packageBtn.classList.remove('success');
          packageBtn.classList.add('copy-again');
          btnText.textContent = '📋 Copy Again';
          packageButtonMode = 'copy';
        }
      }, 3000);

    } catch (err) {
      showError('Failed to extract — try refreshing the page');
      packageButtonMode = 'extract';
    }
  }

  // ── HELPERS ──

  function getFormattedText(result, format) {
    switch (format) {
      case 'markdown': return result.markdown;
      case 'plain': return result.plain;
      default: return result.structured;
    }
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
    }, 2000);
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
