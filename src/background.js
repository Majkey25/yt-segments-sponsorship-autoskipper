import { AdguardApi, MESSAGE_HANDLER_NAME } from '@adguard/api-mv3';
import { localScriptRules as localScriptRulesJs } from '../.build/filters/local_script_rules.js';
import '../lib/sponsorblock.js';
import '../lib/settings.js';
import '../lib/adblock-config.js';

const segmentCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 50;

let adguardApi = null;
let adguardMessageHandler = null;

const adguardReady = initializeAdguard().catch((error) => {
  console.error('[YT Autoskipper] Ad blocking failed to initialize', error);
  return null;
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'sync' || !changes.settings) {
    return;
  }

  const settings = SegmentSettings.sanitizeSettings(changes.settings.newValue);
  void updateAdguard(settings.adBlockEnabled, settings.adBlockScope);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.handlerName === MESSAGE_HANDLER_NAME) {
    return adguardReady.then(() => {
      if (!adguardMessageHandler) {
        return undefined;
      }
      return adguardMessageHandler(message, sender);
    });
  }

  if (!message || message.type !== 'GET_SEGMENTS') {
    return undefined;
  }

  getSegments(message.videoID, message.categories)
    .then((segments) => sendResponse({ ok: true, segments }))
    .catch((error) => sendResponse({ ok: false, error: error.message || 'Failed to load segments' }));

  return true;
});

async function initializeAdguard() {
  const stored = await chrome.storage.sync.get('settings');
  const settings = SegmentSettings.sanitizeSettings(stored.settings);

  adguardApi = await AdguardApi.create({ localScriptRulesJs });
  adguardMessageHandler = adguardApi.getMessageHandler();
  await adguardApi.start(
    AdblockConfig.createAdguardConfiguration(settings.adBlockEnabled, settings.adBlockScope)
  );
  return adguardApi;
}

async function updateAdguard(enabled, scope) {
  await adguardReady;
  if (!adguardApi) {
    return;
  }

  try {
    await adguardApi.configure(AdblockConfig.createAdguardConfiguration(enabled, scope));
  } catch (error) {
    console.error('[YT Autoskipper] Failed to update ad blocking', error);
  }
}

async function getSegments(videoID, requestedCategories) {
  if (!/^[A-Za-z0-9_-]{6,20}$/.test(videoID || '')) {
    throw new TypeError('Invalid YouTube video ID');
  }

  const allowedCategories = new Set(Object.keys(SegmentSettings.CATEGORY_DEFINITIONS));
  const categories = Array.isArray(requestedCategories)
    ? [...new Set(requestedCategories.filter((category) => allowedCategories.has(category)))].sort()
    : [];

  if (categories.length === 0) {
    return [];
  }

  const cacheKey = `${videoID}|${categories.join(',')}`;
  const cached = segmentCache.get(cacheKey);
  if (cached && Date.now() - cached.savedAt < CACHE_TTL_MS) {
    return cached.segments;
  }

  const prefix = await SponsorBlockClient.sha256Prefix(videoID);
  const url = SponsorBlockClient.buildSkipSegmentsUrl(prefix, categories);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store'
    });

    if (response.status === 404) {
      saveCache(cacheKey, []);
      return [];
    }

    if (!response.ok) {
      throw new Error(`SponsorBlock API returned HTTP ${response.status}`);
    }

    const payload = await response.json();
    const segments = SponsorBlockClient.pickVideoSegments(payload, videoID);
    saveCache(cacheKey, segments);
    return segments;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('SponsorBlock request timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function saveCache(key, segments) {
  if (segmentCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = segmentCache.keys().next().value;
    if (oldestKey) {
      segmentCache.delete(oldestKey);
    }
  }
  segmentCache.set(key, { segments, savedAt: Date.now() });
}