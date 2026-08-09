(function initSettings(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.SegmentSettings = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createSettings() {
  const MODES = ['auto', 'button', 'ignore'];
  const THEMES = ['system', 'dark', 'light'];
  const AD_BLOCK_SCOPES = ['global', 'youtube'];

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

  const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    adBlockEnabled: true,
    adBlockScope: 'global',
    showMarkers: true,
    showToast: true,
    theme: 'system',
    categories: Object.freeze(
      Object.fromEntries(
        Object.entries(CATEGORY_DEFINITIONS).map(([name, definition]) => [name, definition.defaultMode])
      )
    )
  });

  function sanitizeSettings(input) {
    const source = input && typeof input === 'object' ? input : {};
    const categoryInput = source.categories && typeof source.categories === 'object' ? source.categories : {};
    const categories = {};

    for (const [name, definition] of Object.entries(CATEGORY_DEFINITIONS)) {
      const mode = categoryInput[name];
      categories[name] = MODES.includes(mode) ? mode : definition.defaultMode;
    }

    return {
      enabled: typeof source.enabled === 'boolean' ? source.enabled : DEFAULT_SETTINGS.enabled,
      adBlockEnabled: typeof source.adBlockEnabled === 'boolean'
        ? source.adBlockEnabled
        : DEFAULT_SETTINGS.adBlockEnabled,
      adBlockScope: AD_BLOCK_SCOPES.includes(source.adBlockScope)
        ? source.adBlockScope
        : DEFAULT_SETTINGS.adBlockScope,
      showMarkers: typeof source.showMarkers === 'boolean' ? source.showMarkers : DEFAULT_SETTINGS.showMarkers,
      showToast: typeof source.showToast === 'boolean' ? source.showToast : DEFAULT_SETTINGS.showToast,
      theme: THEMES.includes(source.theme) ? source.theme : DEFAULT_SETTINGS.theme,
      categories
    };
  }

  function activeCategories(settings) {
    const safe = sanitizeSettings(settings);
    return Object.entries(safe.categories)
      .filter(([, mode]) => mode !== 'ignore')
      .map(([name]) => name);
  }

  return {
    MODES,
    THEMES,
    AD_BLOCK_SCOPES,
    CATEGORY_DEFINITIONS,
    DEFAULT_SETTINGS,
    sanitizeSettings,
    activeCategories
  };
});
