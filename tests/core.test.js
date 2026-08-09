const test = require('node:test');
const assert = require('node:assert/strict');

const SegmentUtils = require('../lib/segment-utils.js');
const Settings = require('../lib/settings.js');

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

test('sanitizeSettings keeps only known modes and categories', () => {
  const settings = Settings.sanitizeSettings({
    enabled: false,
    adBlockEnabled: false,
    theme: 'light',
    categories: {
      sponsor: 'button',
      intro: 'wat',
      unknown: 'auto'
    }
  });

  assert.equal(settings.enabled, false);
  assert.equal(settings.adBlockEnabled, false);
  assert.equal(settings.theme, 'light');
  assert.equal(settings.categories.sponsor, 'button');
  assert.equal(settings.categories.intro, Settings.DEFAULT_SETTINGS.categories.intro);
  assert.equal(settings.categories.unknown, undefined);
});

test('sanitizeSettings defaults ad blocking to enabled and invalid themes to system', () => {
  const settings = Settings.sanitizeSettings({
    adBlockEnabled: 'yes',
    theme: 'neon'
  });

  assert.equal(settings.adBlockEnabled, true);
  assert.equal(settings.theme, 'system');
  assert.deepEqual(Settings.THEMES, ['system', 'dark', 'light']);
});

test('activeCategories omits ignored categories', () => {
  const settings = Settings.sanitizeSettings({
    categories: {
      sponsor: 'auto',
      intro: 'button',
      filler: 'ignore'
    }
  });

  assert.ok(Settings.activeCategories(settings).includes('sponsor'));
  assert.ok(Settings.activeCategories(settings).includes('intro'));
  assert.ok(!Settings.activeCategories(settings).includes('filler'));
});

const SponsorBlock = require('../lib/sponsorblock.js');
const AdblockConfig = require('../lib/adblock-config.js');

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

test('AdGuard configuration is scoped to YouTube and uses the base ad filter', () => {
  const configuration = AdblockConfig.createAdguardConfiguration(true);

  assert.deepEqual(configuration.filters, [2]);
  assert.equal(configuration.filteringEnabled, true);
  assert.equal(configuration.assetsPath, 'filters');
  assert.ok(configuration.blocklist.includes('youtube.com'));
  assert.ok(configuration.blocklist.includes('www.youtube.com'));
  assert.ok(configuration.blocklist.includes('music.youtube.com'));
});

test('AdGuard configuration can disable filtering without changing its scope', () => {
  const configuration = AdblockConfig.createAdguardConfiguration(false);

  assert.equal(configuration.filteringEnabled, false);
  assert.deepEqual(configuration.filters, [2]);
  assert.deepEqual(configuration.blocklist, AdblockConfig.YOUTUBE_BLOCKLIST);
});
