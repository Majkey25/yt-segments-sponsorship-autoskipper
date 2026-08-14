(function initSettings(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.SegmentSettings = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createSettings() {
  const MODES = Object.freeze(['auto', 'button', 'ignore']);
  const THEMES = Object.freeze(['system', 'dark', 'light']);

  const CATEGORY_DEFINITIONS = Object.freeze({
    sponsor: { label: 'Sponsor', color: '#00d400', defaultMode: 'auto' },
    selfpromo: { label: 'Self promotion', color: '#ffff00', defaultMode: 'auto' },
    interaction: { label: 'Interaction reminder', color: '#cc00ff', defaultMode: 'button' },
    intro: { label: 'Intro', color: '#00ffff', defaultMode: 'button' },
    outro: { label: 'Outro / credits', color: '#0202ed', defaultMode: 'button' },
    preview: { label: 'Preview / recap', color: '#008fd6', defaultMode: 'button' },
    hook: { label: 'Hook', color: '#395699', defaultMode: 'button' },
    music_offtopic: { label: 'Non music', color: '#ff9900', defaultMode: 'button' },
    filler: { label: 'Filler', color: '#7300ff', defaultMode: 'ignore' }
  });

  const DEFAULT_CATEGORIES = Object.freeze(
    Object.fromEntries(
      Object.entries(CATEGORY_DEFINITIONS).map(([name, definition]) => [name, definition.defaultMode])
    )
  );

  const DEFAULT_SETTINGS = Object.freeze({
    youtube: Object.freeze({
      enabled: true,
      showMarkers: true,
      showToast: true,
      categories: DEFAULT_CATEGORIES
    }),
    theme: 'system'
  });

  function sanitizeSettings(input) {
    const source = isObject(input) ? input : {};
    const youtubeSource = isObject(source.youtube) ? source.youtube : source;
    const categoryInput = isObject(youtubeSource.categories) ? youtubeSource.categories : {};
    const categories = {};

    for (const [name, definition] of Object.entries(CATEGORY_DEFINITIONS)) {
      const mode = categoryInput[name];
      categories[name] = MODES.includes(mode) ? mode : definition.defaultMode;
    }

    return {
      youtube: {
        enabled: booleanValue(youtubeSource.enabled, DEFAULT_SETTINGS.youtube.enabled),
        showMarkers: booleanValue(youtubeSource.showMarkers, DEFAULT_SETTINGS.youtube.showMarkers),
        showToast: booleanValue(youtubeSource.showToast, DEFAULT_SETTINGS.youtube.showToast),
        categories
      },
      theme: THEMES.includes(source.theme) ? source.theme : DEFAULT_SETTINGS.theme
    };
  }

  function activeCategories(settings) {
    const safe = sanitizeSettings(settings);
    return Object.entries(safe.youtube.categories)
      .filter(([, mode]) => mode !== 'ignore')
      .map(([name]) => name);
  }

  function booleanValue(value, fallback) {
    return typeof value === 'boolean' ? value : fallback;
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  return {
    MODES,
    THEMES,
    CATEGORY_DEFINITIONS,
    DEFAULT_SETTINGS,
    sanitizeSettings,
    activeCategories
  };
});
