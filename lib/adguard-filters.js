(function initAdguardFilters(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.AdguardFilters = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createAdguardFilters() {
  const RECOMMENDED_FILTER_IDS = Object.freeze([2, 3, 17]);

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
    RECOMMENDED_FILTER_IDS,
    sanitizeFilterIds,
    defaultFilterIds,
    groupCatalog
  };
});
