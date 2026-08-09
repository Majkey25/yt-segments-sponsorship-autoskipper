(function initAdblockConfig(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.AdblockConfig = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createAdblockConfig() {
  const FILTER_IDS = Object.freeze([2]);
  const YOUTUBE_BLOCKLIST = Object.freeze([
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'music.youtube.com',
    'youtube-nocookie.com',
    'www.youtube-nocookie.com'
  ]);

  function createAdguardConfiguration(enabled) {
    return {
      filters: [...FILTER_IDS],
      filteringEnabled: Boolean(enabled),
      assetsPath: 'filters',
      blocklist: [...YOUTUBE_BLOCKLIST]
    };
  }

  return {
    FILTER_IDS,
    YOUTUBE_BLOCKLIST,
    createAdguardConfiguration
  };
});