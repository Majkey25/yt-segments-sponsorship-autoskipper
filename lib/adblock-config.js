(function initAdblockConfig(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.AdblockConfig = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createAdblockConfig() {
  const YOUTUBE_BLOCKLIST = Object.freeze([
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'music.youtube.com',
    'youtube-nocookie.com',
    'www.youtube-nocookie.com'
  ]);

  function createAdguardConfiguration(adguardSettings, options = {}) {
    const settings = adguardSettings && typeof adguardSettings === 'object' ? adguardSettings : {};
    const configuration = {
      filters: Array.isArray(settings.filterIds) ? [...settings.filterIds] : [],
      filteringEnabled: Boolean(settings.enabled),
      assetsPath: 'filters',
      rules: Array.isArray(settings.rules) ? [...settings.rules] : []
    };

    if (typeof options.documentBlockingPageUrl === 'string' && options.documentBlockingPageUrl) {
      configuration.documentBlockingPageUrl = options.documentBlockingPageUrl;
    }

    if (settings.scope === 'youtube') {
      configuration.blocklist = [...YOUTUBE_BLOCKLIST];
    } else {
      configuration.allowlist = Array.isArray(settings.allowlist) ? [...settings.allowlist] : [];
    }

    return configuration;
  }

  return {
    YOUTUBE_BLOCKLIST,
    createAdguardConfiguration
  };
});
