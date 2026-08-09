(function initSettings(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.SegmentSettings = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createSettings() {
  const MODES = Object.freeze(['auto', 'button', 'ignore']);
  const THEMES = Object.freeze(['system', 'dark', 'light']);
  const AD_BLOCK_SCOPES = Object.freeze(['global', 'youtube']);
  const RECOMMENDED_FILTER_IDS = Object.freeze([2, 3, 17]);

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
    adguard: Object.freeze({
      enabled: true,
      scope: 'global',
      filterIds: RECOMMENDED_FILTER_IDS,
      allowlist: Object.freeze([]),
      rules: Object.freeze([])
    }),
    theme: 'system'
  });

  function sanitizeSettings(input) {
    const source = isObject(input) ? input : {};
    const youtubeSource = isObject(source.youtube) ? source.youtube : {};
    const adguardSource = isObject(source.adguard) ? source.adguard : {};
    const categoryInput = isObject(youtubeSource.categories)
      ? youtubeSource.categories
      : (isObject(source.categories) ? source.categories : {});
    const categories = {};

    for (const [name, definition] of Object.entries(CATEGORY_DEFINITIONS)) {
      const mode = categoryInput[name];
      categories[name] = MODES.includes(mode) ? mode : definition.defaultMode;
    }

    const filterIdsSource = Array.isArray(adguardSource.filterIds)
      ? adguardSource.filterIds
      : RECOMMENDED_FILTER_IDS;

    return {
      youtube: {
        enabled: booleanValue(youtubeSource.enabled, source.enabled, DEFAULT_SETTINGS.youtube.enabled),
        showMarkers: booleanValue(
          youtubeSource.showMarkers,
          source.showMarkers,
          DEFAULT_SETTINGS.youtube.showMarkers
        ),
        showToast: booleanValue(youtubeSource.showToast, source.showToast, DEFAULT_SETTINGS.youtube.showToast),
        categories
      },
      adguard: {
        enabled: booleanValue(adguardSource.enabled, source.adBlockEnabled, DEFAULT_SETTINGS.adguard.enabled),
        scope: AD_BLOCK_SCOPES.includes(adguardSource.scope)
          ? adguardSource.scope
          : (AD_BLOCK_SCOPES.includes(source.adBlockScope) ? source.adBlockScope : DEFAULT_SETTINGS.adguard.scope),
        filterIds: sanitizeIntegerArray(filterIdsSource),
        allowlist: sanitizeStringArray(adguardSource.allowlist),
        rules: sanitizeStringArray(adguardSource.rules)
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

  function booleanValue(primary, legacy, fallback) {
    if (typeof primary === 'boolean') {
      return primary;
    }
    if (typeof legacy === 'boolean') {
      return legacy;
    }
    return fallback;
  }

  function sanitizeIntegerArray(value) {
    if (!Array.isArray(value)) {
      return [...RECOMMENDED_FILTER_IDS];
    }
    return [...new Set(value.filter((item) => Number.isInteger(item) && item > 0))].sort((a, b) => a - b);
  }

  function sanitizeStringArray(value) {
    if (!Array.isArray(value)) {
      return [];
    }

    const items = value
      .filter((item) => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean);

    return [...new Set(items)];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  return {
    MODES,
    THEMES,
    AD_BLOCK_SCOPES,
    RECOMMENDED_FILTER_IDS,
    CATEGORY_DEFINITIONS,
    DEFAULT_SETTINGS,
    sanitizeSettings,
    activeCategories
  };
});
