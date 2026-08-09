(function initAdguardUtils(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.AdguardUtils = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createAdguardUtils() {
  function normalizeHostname(value) {
    if (typeof value !== 'string') {
      return null;
    }

    const input = value.trim();
    if (!input) {
      return null;
    }

    let hostname = null;
    try {
      const candidate = /^[a-z][a-z0-9+.-]*:/i.test(input)
        ? new URL(input)
        : new URL(`https://${input}`);
      if (!['http:', 'https:'].includes(candidate.protocol)) {
        return null;
      }
      hostname = candidate.hostname.toLowerCase().replace(/\.$/, '');
    } catch {
      return null;
    }

    if (!hostname || hostname.length > 253 || /\s/.test(hostname)) {
      return null;
    }

    if (hostname === 'localhost' || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) {
      return hostname;
    }

    const labels = hostname.split('.');
    if (labels.some((label) => !label || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label))) {
      return null;
    }

    return hostname;
  }

  function parseDomainList(text) {
    if (typeof text !== 'string') {
      return [];
    }

    const domains = text
      .split(/\r?\n/)
      .map(normalizeHostname)
      .filter(Boolean);

    return [...new Set(domains)].sort();
  }

  function mergeBlockedRequest(log, event, limit = 200) {
    const current = Array.isArray(log) ? [...log] : [];
    if (!event || typeof event !== 'object') {
      return current.slice(-Math.max(1, limit));
    }

    const requestId = typeof event.requestId === 'string' && event.requestId
      ? event.requestId
      : `${event.tabId ?? -1}:${event.requestUrl ?? ''}:${Date.now()}`;
    const existingIndex = current.findIndex((item) => item.requestId === requestId);
    const timestamp = Date.now();
    const nextEntry = {
      ...(existingIndex >= 0 ? current[existingIndex] : {}),
      ...withoutUndefined(event),
      requestId,
      timestamp
    };

    if (existingIndex >= 0) {
      current[existingIndex] = nextEntry;
    } else {
      current.push(nextEntry);
    }

    const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 200;
    return current.slice(-safeLimit);
  }

  function withoutUndefined(value) {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
  }

  return {
    normalizeHostname,
    parseDomainList,
    mergeBlockedRequest
  };
});
