const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SegmentUtils = require('../lib/segment-utils.js');
const Settings = require('../lib/settings.js');
const SponsorBlock = require('../lib/sponsorblock.js');
const AdblockConfig = require('../lib/adblock-config.js');

const root = path.resolve(__dirname, '..');

function requireProjectModule(relativePath) {
  const absolutePath = path.join(root, relativePath);
  assert.ok(fs.existsSync(absolutePath), `${relativePath} must exist`);
  return require(absolutePath);
}

test('extractVideoId accepts normal watch URLs', () => {
  assert.equal(
    SegmentUtils.extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=5'),
    'dQw4w9WgXcQ'
  );
});

test('extractVideoId accepts Shorts URLs', () => {
  assert.equal(
    SegmentUtils.extractVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ'),
    'dQw4w9WgXcQ'
  );
});

test('normalizeSegments rejects malformed ranges and sorts by start time', () => {
  const result = SegmentUtils.normalizeSegments([
    { segment: [20, 30], category: 'intro', actionType: 'skip', UUID: 'b' },
    { segment: [5, 10], category: 'sponsor', actionType: 'skip', UUID: 'a' },
    { segment: [9, 4], category: 'sponsor', actionType: 'skip', UUID: 'bad' },
    { segment: ['x', 12], category: 'sponsor', actionType: 'skip', UUID: 'bad2' },
    { segment: [1, 2], category: 'chapter', actionType: 'chapter', UUID: 'bad3' }
  ]);

  assert.deepEqual(result.map((item) => item.UUID), ['a', 'b']);
});

test('findActiveSegment returns the segment containing current time', () => {
  const segments = [
    { start: 5, end: 10, category: 'sponsor', UUID: 'a' },
    { start: 20, end: 25, category: 'intro', UUID: 'b' }
  ];

  assert.equal(SegmentUtils.findActiveSegment(segments, 7)?.UUID, 'a');
  assert.equal(SegmentUtils.findActiveSegment(segments, 15), null);
});

test('secondsLabel produces compact readable durations', () => {
  assert.equal(SegmentUtils.secondsLabel(4.2), '4s');
  assert.equal(SegmentUtils.secondsLabel(61), '1m 1s');
});

test('sanitizeSettings migrates v1.0.1 flat settings into nested settings', () => {
  const settings = Settings.sanitizeSettings({
    enabled: false,
    adBlockEnabled: true,
    adBlockScope: 'youtube',
    showMarkers: false,
    showToast: true,
    theme: 'light',
    categories: {
      sponsor: 'button',
      intro: 'ignore'
    }
  });

  assert.equal(settings.youtube.enabled, false);
  assert.equal(settings.youtube.showMarkers, false);
  assert.equal(settings.youtube.showToast, true);
  assert.equal(settings.youtube.categories.sponsor, 'button');
  assert.equal(settings.youtube.categories.intro, 'ignore');
  assert.equal(settings.adguard.enabled, true);
  assert.equal(settings.adguard.scope, 'youtube');
  assert.deepEqual(settings.adguard.filterIds, [2, 3, 17, 105]);
  assert.deepEqual(settings.adguard.allowlist, []);
  assert.deepEqual(settings.adguard.rules, []);
  assert.equal(settings.theme, 'light');
});

test('sanitizeSettings validates nested settings and is idempotent', () => {
  const settings = Settings.sanitizeSettings({
    youtube: {
      enabled: true,
      showMarkers: true,
      showToast: false,
      categories: {
        sponsor: 'auto',
        intro: 'wat',
        unknown: 'button'
      }
    },
    adguard: {
      enabled: false,
      scope: 'everywhere',
      filterIds: [17, 2, 2, -1, '3'],
      allowlist: ['Example.com', 'Example.com', 42],
      rules: ['example.com##.ad', '', 42]
    },
    theme: 'neon'
  });

  assert.equal(settings.youtube.enabled, true);
  assert.equal(settings.youtube.showToast, false);
  assert.equal(settings.youtube.categories.intro, Settings.DEFAULT_SETTINGS.youtube.categories.intro);
  assert.equal(settings.youtube.categories.unknown, undefined);
  assert.equal(settings.adguard.enabled, false);
  assert.equal(settings.adguard.scope, 'global');
  assert.deepEqual(settings.adguard.filterIds, [2, 17]);
  assert.deepEqual(settings.adguard.allowlist, ['Example.com']);
  assert.deepEqual(settings.adguard.rules, ['example.com##.ad']);
  assert.equal(settings.theme, 'system');
  assert.deepEqual(Settings.sanitizeSettings(settings), settings);
  assert.deepEqual(Settings.RECOMMENDED_FILTER_IDS, [2, 3, 17, 105]);
  assert.deepEqual(Settings.AD_BLOCK_SCOPES, ['global', 'youtube']);
});

test('sanitizeSettings preserves existing explicit filter selections', () => {
  const settings = Settings.sanitizeSettings({
    adguard: {
      filterIds: [18, 2, 18]
    }
  });

  assert.deepEqual(settings.adguard.filterIds, [2, 18]);
});

test('activeCategories reads the nested YouTube category model', () => {
  const settings = Settings.sanitizeSettings({
    youtube: {
      categories: {
        sponsor: 'auto',
        intro: 'button',
        filler: 'ignore'
      }
    }
  });

  assert.ok(Settings.activeCategories(settings).includes('sponsor'));
  assert.ok(Settings.activeCategories(settings).includes('intro'));
  assert.ok(!Settings.activeCategories(settings).includes('filler'));
});

test('sha256Prefix returns the documented four character privacy prefix', async () => {
  const prefix = await SponsorBlock.sha256Prefix('dQw4w9WgXcQ');
  assert.equal(prefix.length, 4);
  assert.match(prefix, /^[0-9a-f]{4}$/);
});

test('buildSkipSegmentsUrl encodes categories and skip action type', () => {
  const url = new URL(SponsorBlock.buildSkipSegmentsUrl('abcd', ['sponsor', 'intro']));
  assert.equal(url.pathname, '/api/skipSegments/abcd');
  assert.deepEqual(JSON.parse(url.searchParams.get('categories')), ['sponsor', 'intro']);
  assert.deepEqual(JSON.parse(url.searchParams.get('actionTypes')), ['skip']);
  assert.equal(url.searchParams.get('service'), 'YouTube');
});

test('pickVideoSegments returns only the exact matching video', () => {
  const result = SponsorBlock.pickVideoSegments([
    { videoID: 'other', segments: [{ UUID: 'x' }] },
    { videoID: 'target', segments: [{ UUID: 'y' }] }
  ], 'target');

  assert.deepEqual(result, [{ UUID: 'y' }]);
});

test('AdGuard configuration exposes all public configuration fields', () => {
  const configuration = AdblockConfig.createAdguardConfiguration({
    enabled: true,
    scope: 'global',
    filterIds: [2, 3, 17],
    allowlist: ['example.com'],
    rules: ['example.org##.ad']
  }, {
    documentBlockingPageUrl: 'chrome-extension://id/blocking-page.html'
  });

  assert.deepEqual(configuration.filters, [2, 3, 17]);
  assert.equal(configuration.filteringEnabled, true);
  assert.equal(configuration.assetsPath, 'filters');
  assert.deepEqual(configuration.allowlist, ['example.com']);
  assert.deepEqual(configuration.rules, ['example.org##.ad']);
  assert.equal(configuration.documentBlockingPageUrl, 'chrome-extension://id/blocking-page.html');
  assert.equal(configuration.blocklist, undefined);
});

test('AdGuard YouTube scope uses blocklist and omits allowlist', () => {
  const configuration = AdblockConfig.createAdguardConfiguration({
    enabled: false,
    scope: 'youtube',
    filterIds: [2],
    allowlist: ['example.com'],
    rules: []
  });

  assert.equal(configuration.filteringEnabled, false);
  assert.deepEqual(configuration.blocklist, AdblockConfig.YOUTUBE_BLOCKLIST);
  assert.equal(configuration.allowlist, undefined);
});

test('AdGuard domain helpers normalize and parse domain lists', () => {
  const AdguardUtils = requireProjectModule('lib/adguard-utils.js');

  assert.equal(AdguardUtils.normalizeHostname('HTTPS://Example.COM:443/path'), 'example.com');
  assert.equal(AdguardUtils.normalizeHostname('sub.example.com.'), 'sub.example.com');
  assert.equal(AdguardUtils.normalizeHostname('javascript:alert(1)'), null);
  assert.equal(AdguardUtils.normalizeHostname('bad host'), null);
  assert.deepEqual(
    AdguardUtils.parseDomainList('Example.com\nhttps://example.com/x\nsub.example.com\n'),
    ['example.com', 'sub.example.com']
  );
});

test('AdGuard request log deduplicates request IDs and stays bounded', () => {
  const AdguardUtils = requireProjectModule('lib/adguard-utils.js');
  let log = [];

  log = AdguardUtils.mergeBlockedRequest(log, {
    requestId: 'a',
    tabId: 1,
    requestUrl: 'https://ads.example/a.js',
    referrerUrl: 'https://example.com',
    requestType: 'SCRIPT',
    assumedFilterId: 2
  }, 2);
  log = AdguardUtils.mergeBlockedRequest(log, {
    requestId: 'a',
    tabId: 1,
    requestUrl: 'https://ads.example/a.js',
    referrerUrl: 'https://example.com',
    requestType: 'SCRIPT',
    companyCategoryName: 'Advertising'
  }, 2);

  assert.equal(log.length, 1);
  assert.equal(log[0].assumedFilterId, 2);
  assert.equal(log[0].companyCategoryName, 'Advertising');

  log = AdguardUtils.mergeBlockedRequest(log, { requestId: 'b', requestUrl: 'https://b.test' }, 2);
  log = AdguardUtils.mergeBlockedRequest(log, { requestId: 'c', requestUrl: 'https://c.test' }, 2);
  assert.deepEqual(log.map((entry) => entry.requestId), ['b', 'c']);
});

test('AdGuard filter helpers validate catalog IDs and named presets', () => {
  const AdguardFilters = requireProjectModule('lib/adguard-filters.js');
  const catalog = [
    { id: 2, name: 'Base', group: 'Ad blocking' },
    { id: 3, name: 'Tracking', group: 'Privacy' },
    { id: 17, name: 'URL Tracking', group: 'Privacy' },
    { id: 18, name: 'Cookie Notices', group: 'Annoyances' },
    { id: 19, name: 'Popups', group: 'Annoyances' },
    { id: 20, name: 'Mobile App Banners', group: 'Annoyances' },
    { id: 21, name: 'Other Annoyances', group: 'Annoyances' },
    { id: 22, name: 'Widgets', group: 'Annoyances' },
    { id: 105, name: 'EasyList Czech and Slovak', group: 'Language-specific' }
  ];

  assert.deepEqual(AdguardFilters.sanitizeFilterIds([18, 2, 2, 999], catalog), [2, 18]);
  assert.deepEqual(AdguardFilters.defaultFilterIds(catalog), [2, 3, 17, 105]);
  assert.deepEqual(AdguardFilters.filterIdsForPreset('minimal'), [2]);
  assert.deepEqual(AdguardFilters.filterIdsForPreset('recommended'), [2, 3, 17, 105]);
  assert.deepEqual(AdguardFilters.filterIdsForPreset('strict'), [2, 3, 17, 18, 19, 20, 21, 22, 105]);
  assert.equal(AdguardFilters.presetForFilterIds([2]), 'minimal');
  assert.equal(AdguardFilters.presetForFilterIds([105, 17, 3, 2]), 'recommended');
  assert.equal(AdguardFilters.presetForFilterIds([2, 18]), 'custom');
  assert.equal(AdguardFilters.presetForFilterIds([]), 'custom');
  assert.deepEqual(Object.keys(AdguardFilters.groupCatalog(catalog)), ['Ad blocking', 'Privacy', 'Annoyances', 'Language-specific']);
});
