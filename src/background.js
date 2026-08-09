import { AdguardApi, MESSAGE_HANDLER_NAME } from '@adguard/api-mv3';
import { localScriptRules as localScriptRulesJs } from '../.build/filters/local_script_rules.js';
import '../lib/sponsorblock.js';
import '../lib/settings.js';
import '../lib/adblock-config.js';
import '../lib/adguard-utils.js';

const segmentCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 50;
const MAX_BLOCKED_REQUESTS = 200;
const DASHBOARD_MESSAGES = new Set([
  'GET_ADGUARD_STATE',
  'APPLY_ADGUARD_SETTINGS',
  'START_ADGUARD',
  'STOP_ADGUARD',
  'OPEN_ADGUARD_ASSISTANT',
  'CLOSE_ADGUARD_ASSISTANT',
  'GET_ADGUARD_LOG',
  'CLEAR_ADGUARD_LOG',
  'SET_CURRENT_SITE_PROTECTION'
]);

let adguardApi = null;
let adguardMessageHandler = null;
let adguardRunning = false;
let lastAppliedSettings = null;
let lastConfiguredAt = null;
let lastConfigurationError = null;
let blockedRequests = [];

const adguardReady = initializeAdguard().catch((error) => {
  lastConfigurationError = errorMessage(error);
  console.error('[YT Autoskipper] Ad blocking failed to initialize', error);
  return null;
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'sync' || !changes.settings || !adguardApi) {
    return;
  }

  const next = SegmentSettings.sanitizeSettings(changes.settings.newValue).adguard;
  if (sameAdguardSettings(next, lastAppliedSettings)) {
    return;
  }

  void applyAdguardConfiguration(next, false).catch(async (error) => {
    console.error('[YT Autoskipper] Failed to apply synced AdGuard settings', error);
    if (lastAppliedSettings) {
      const stored = await chrome.storage.sync.get('settings');
      const settings = SegmentSettings.sanitizeSettings(stored.settings);
      settings.adguard = cloneAdguardSettings(lastAppliedSettings);
      await chrome.storage.sync.set({ settings });
    }
  });
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

  if (message?.type === 'GET_SEGMENTS') {
    getSegments(message.videoID, message.categories)
      .then((segments) => sendResponse({ ok: true, segments }))
      .catch((error) => sendResponse({ ok: false, error: errorMessage(error) }));
    return true;
  }

  if (message?.type && DASHBOARD_MESSAGES.has(message.type)) {
    handleDashboardMessage(message)
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: errorMessage(error) }));
    return true;
  }

  return undefined;
});

async function initializeAdguard() {
  const stored = await chrome.storage.sync.get('settings');
  const settings = SegmentSettings.sanitizeSettings(stored.settings);

  adguardApi = await AdguardApi.create({ localScriptRulesJs });
  adguardMessageHandler = adguardApi.getMessageHandler();
  adguardApi.onAssistantCreateRule.subscribe(handleAssistantRule);
  adguardApi.onRequestBlocked.addListener(handleBlockedRequest);

  const applied = await adguardApi.start(createConfiguration(settings.adguard));
  adguardRunning = true;
  lastAppliedSettings = cloneAdguardSettings(settings.adguard);
  lastConfiguredAt = new Date().toISOString();
  lastConfigurationError = null;

  if (applied?.filters) {
    lastAppliedSettings.filterIds = [...applied.filters].sort((a, b) => a - b);
  }

  if (JSON.stringify(stored.settings) !== JSON.stringify(settings)) {
    await chrome.storage.sync.set({ settings });
  }

  return adguardApi;
}

async function handleDashboardMessage(message) {
  await adguardReady;

  switch (message.type) {
    case 'GET_ADGUARD_STATE':
      return getAdguardState();
    case 'APPLY_ADGUARD_SETTINGS':
      return applyDashboardSettings(message.adguard);
    case 'START_ADGUARD':
      return startAdguard();
    case 'STOP_ADGUARD':
      return stopAdguard();
    case 'OPEN_ADGUARD_ASSISTANT':
      return openAssistant();
    case 'CLOSE_ADGUARD_ASSISTANT':
      return closeAssistant();
    case 'GET_ADGUARD_LOG':
      return getBlockedRequestLog();
    case 'CLEAR_ADGUARD_LOG':
      blockedRequests = [];
      return { ok: true };
    case 'SET_CURRENT_SITE_PROTECTION':
      return setCurrentSiteProtection(message.protected, message.hostname);
    default:
      return { ok: false, error: 'Unsupported AdGuard command' };
  }
}

async function getAdguardState() {
  const stored = await chrome.storage.sync.get('settings');
  const settings = SegmentSettings.sanitizeSettings(stored.settings);
  const tab = await getActiveTab();
  const hostname = hostnameFromTab(tab);
  const enabledRulesets = await safeEnabledRulesets();
  const availableStaticRuleCount = await safeAvailableStaticRuleCount();
  const maxEnabled = chrome.declarativeNetRequest.MAX_NUMBER_OF_ENABLED_STATIC_RULESETS ?? null;
  const maxStatic = chrome.declarativeNetRequest.MAX_NUMBER_OF_STATIC_RULESETS ?? null;

  return {
    ok: true,
    settings,
    engineRunning: adguardRunning,
    rulesCount: adguardApi?.getRulesCount?.() ?? 0,
    blockedRequestCount: blockedRequests.length,
    lastConfiguredAt,
    lastConfigurationError,
    currentTabId: tab?.id ?? null,
    currentHostname: hostname,
    currentSiteProtected: currentSiteProtected(settings.adguard, hostname),
    enabledRulesetIds: enabledRulesets,
    availableStaticRuleCount,
    maxEnabledStaticRulesets: maxEnabled,
    maxStaticRulesets: maxStatic
  };
}

async function applyDashboardSettings(adguardInput) {
  const stored = await chrome.storage.sync.get('settings');
  const current = SegmentSettings.sanitizeSettings(stored.settings);
  const candidate = SegmentSettings.sanitizeSettings({
    ...current,
    adguard: adguardInput
  });

  await applyAdguardConfiguration(candidate.adguard, true);
  return getAdguardState();
}

async function applyAdguardConfiguration(adguardSettings, persist) {
  const safe = SegmentSettings.sanitizeSettings({ adguard: adguardSettings }).adguard;
  const previous = lastAppliedSettings ? cloneAdguardSettings(lastAppliedSettings) : null;

  try {
    if (adguardRunning) {
      const applied = await adguardApi.configure(createConfiguration(safe));
      if (applied?.filters) {
        safe.filterIds = [...applied.filters].sort((a, b) => a - b);
      }
    }

    lastAppliedSettings = cloneAdguardSettings(safe);
    lastConfiguredAt = new Date().toISOString();
    lastConfigurationError = null;

    if (persist) {
      const stored = await chrome.storage.sync.get('settings');
      const settings = SegmentSettings.sanitizeSettings(stored.settings);
      settings.adguard = cloneAdguardSettings(safe);
      await chrome.storage.sync.set({ settings });
    }

    return safe;
  } catch (error) {
    lastAppliedSettings = previous;
    lastConfigurationError = errorMessage(error);
    throw error;
  }
}

async function startAdguard() {
  if (!adguardApi) {
    throw new Error('AdGuard engine is unavailable');
  }
  if (adguardRunning) {
    return getAdguardState();
  }

  const stored = await chrome.storage.sync.get('settings');
  const settings = SegmentSettings.sanitizeSettings(stored.settings);
  await adguardApi.start(createConfiguration(settings.adguard));
  adguardRunning = true;
  lastAppliedSettings = cloneAdguardSettings(settings.adguard);
  lastConfiguredAt = new Date().toISOString();
  lastConfigurationError = null;
  return getAdguardState();
}

async function stopAdguard() {
  if (!adguardApi) {
    throw new Error('AdGuard engine is unavailable');
  }
  if (adguardRunning) {
    await adguardApi.stop();
    adguardRunning = false;
  }
  return getAdguardState();
}

async function openAssistant() {
  const tab = await requireSupportedActiveTab();
  await adguardApi.openAssistant(tab.id);
  return { ok: true };
}

async function closeAssistant() {
  const tab = await requireSupportedActiveTab();
  await adguardApi.closeAssistant(tab.id);
  return { ok: true };
}

async function setCurrentSiteProtection(protectedState, explicitHostname) {
  const stored = await chrome.storage.sync.get('settings');
  const settings = SegmentSettings.sanitizeSettings(stored.settings);
  if (settings.adguard.scope !== 'global') {
    return { ok: false, error: 'Current-site allowlist is available only in Global scope' };
  }

  const hostname = AdguardUtils.normalizeHostname(explicitHostname) || hostnameFromTab(await getActiveTab());
  if (!hostname) {
    return { ok: false, error: 'This page does not have a supported hostname' };
  }

  const allowlist = new Set(settings.adguard.allowlist.map(AdguardUtils.normalizeHostname).filter(Boolean));
  if (protectedState === false) {
    allowlist.add(hostname);
  } else {
    allowlist.delete(hostname);
  }

  settings.adguard.allowlist = [...allowlist].sort();
  await applyAdguardConfiguration(settings.adguard, true);
  return getAdguardState();
}

async function handleAssistantRule(rule) {
  if (typeof rule !== 'string' || !rule.trim()) {
    return;
  }

  try {
    const stored = await chrome.storage.sync.get('settings');
    const settings = SegmentSettings.sanitizeSettings(stored.settings);
    const nextRule = rule.trim();
    if (settings.adguard.rules.includes(nextRule)) {
      return;
    }
    settings.adguard.rules = [...settings.adguard.rules, nextRule];
    await applyAdguardConfiguration(settings.adguard, true);
  } catch (error) {
    console.error('[YT Autoskipper] Failed to apply Assistant rule', error);
  }
}

function handleBlockedRequest(event) {
  blockedRequests = AdguardUtils.mergeBlockedRequest(blockedRequests, event, MAX_BLOCKED_REQUESTS);
}

async function getBlockedRequestLog() {
  const tab = await getActiveTab();
  return {
    ok: true,
    currentTabId: tab?.id ?? null,
    log: blockedRequests.map((entry) => ({ ...entry }))
  };
}

function createConfiguration(adguardSettings) {
  return AdblockConfig.createAdguardConfiguration(adguardSettings, {
    documentBlockingPageUrl: chrome.runtime.getURL('blocking-page.html')
  });
}

async function safeEnabledRulesets() {
  try {
    const ids = await chrome.declarativeNetRequest.getEnabledRulesets();
    return ids
      .map((id) => Number(String(id).replace(/^ruleset_/, '')))
      .filter(Number.isInteger)
      .sort((a, b) => a - b);
  } catch {
    return [];
  }
}

async function safeAvailableStaticRuleCount() {
  try {
    if (typeof chrome.declarativeNetRequest.getAvailableStaticRuleCount !== 'function') {
      return null;
    }
    return await chrome.declarativeNetRequest.getAvailableStaticRuleCount();
  } catch {
    return null;
  }
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

async function requireSupportedActiveTab() {
  const tab = await getActiveTab();
  if (!tab?.id || !tab.url) {
    throw new Error('No active browser tab is available');
  }

  let url;
  try {
    url = new URL(tab.url);
  } catch {
    throw new Error('The active page URL is invalid');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('AdGuard Assistant works only on HTTP and HTTPS pages');
  }
  return tab;
}

function hostnameFromTab(tab) {
  return AdguardUtils.normalizeHostname(tab?.url || '');
}

function currentSiteProtected(adguardSettings, hostname) {
  if (!hostname || !adguardSettings.enabled) {
    return false;
  }
  if (adguardSettings.scope === 'youtube') {
    return AdblockConfig.YOUTUBE_BLOCKLIST.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    );
  }
  return !adguardSettings.allowlist
    .map(AdguardUtils.normalizeHostname)
    .filter(Boolean)
    .includes(hostname);
}

function sameAdguardSettings(left, right) {
  return JSON.stringify(left || null) === JSON.stringify(right || null);
}

function cloneAdguardSettings(settings) {
  return {
    enabled: Boolean(settings.enabled),
    scope: settings.scope,
    filterIds: [...settings.filterIds],
    allowlist: [...settings.allowlist],
    rules: [...settings.rules]
  };
}

function errorMessage(error) {
  return error?.message || String(error || 'Unknown error');
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
