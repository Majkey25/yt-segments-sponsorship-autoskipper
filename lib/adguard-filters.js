(function initAdguardFilters(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.AdguardFilters = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createAdguardFilters() {
  const PRESET_FILTER_IDS = Object.freeze({
    minimal: Object.freeze([2]),
    recommended: Object.freeze([2, 3, 17, 105]),
    strict: Object.freeze([2, 3, 17, 18, 19, 20, 21, 22, 105])
  });
  const RECOMMENDED_FILTER_IDS = PRESET_FILTER_IDS.recommended;

  function sanitizeFilterIds(ids, catalog) {
    const allowed = new Set(
      Array.isArray(catalog)
        ? catalog.map((item) => item?.id).filter((id) => Number.isInteger(id) && id > 0)
        : []
    );

    if (!Array.isArray(ids)) {
      return [];
    }

    return [...new Set(ids.filter((id) => Number.isInteger(id) && allowed.has(id)))].sort((a, b) => a - b);
  }

  function defaultFilterIds(catalog) {
    const allowed = new Set(
      Array.isArray(catalog)
        ? catalog.map((item) => item?.id).filter((id) => Number.isInteger(id) && id > 0)
        : []
    );
    return RECOMMENDED_FILTER_IDS.filter((id) => allowed.has(id));
  }

  function filterIdsForPreset(name) {
    const ids = PRESET_FILTER_IDS[name];
    return ids ? [...ids] : [];
  }

  function presetForFilterIds(ids) {
    const normalized = normalizePresetIds(ids);

    for (const [name, presetIds] of Object.entries(PRESET_FILTER_IDS)) {
      if (sameIds(normalized, presetIds)) {
        return name;
      }
    }

    return 'custom';
  }

  function normalizePresetIds(ids) {
    if (!Array.isArray(ids)) {
      return [];
    }

    return [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))].sort((a, b) => a - b);
  }

  function sameIds(left, right) {
    return left.length === right.length && left.every((id, index) => id === right[index]);
  }

  function groupCatalog(catalog) {
    const groups = {};
    if (!Array.isArray(catalog)) {
      return groups;
    }

    for (const item of catalog) {
      if (!item || !Number.isInteger(item.id)) {
        continue;
      }
      const group = typeof item.group === 'string' && item.group.trim() ? item.group.trim() : 'Other';
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(item);
    }

    return groups;
  }

  return {
    PRESET_FILTER_IDS,
    RECOMMENDED_FILTER_IDS,
    sanitizeFilterIds,
    defaultFilterIds,
    filterIdsForPreset,
    presetForFilterIds,
    groupCatalog
  };
});
