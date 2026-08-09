(function initSegmentUtils(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.SegmentUtils = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createSegmentUtils() {
  function extractVideoId(input) {
    try {
      const url = new URL(input, 'https://www.youtube.com');
      const host = url.hostname.toLowerCase();

      if (host === 'youtu.be') {
        return validateId(url.pathname.split('/').filter(Boolean)[0]);
      }

      if (!host.endsWith('youtube.com')) {
        return null;
      }

      const watchId = url.searchParams.get('v');
      if (watchId) {
        return validateId(watchId);
      }

      const parts = url.pathname.split('/').filter(Boolean);
      if (['shorts', 'live', 'embed'].includes(parts[0])) {
        return validateId(parts[1]);
      }

      return null;
    } catch {
      return null;
    }
  }

  function validateId(value) {
    if (typeof value !== 'string') {
      return null;
    }
    return /^[A-Za-z0-9_-]{6,20}$/.test(value) ? value : null;
  }

  function normalizeSegments(rawSegments) {
    if (!Array.isArray(rawSegments)) {
      return [];
    }

    return rawSegments
      .filter((item) => item && item.actionType === 'skip' && Array.isArray(item.segment))
      .map((item) => {
        const start = Number(item.segment[0]);
        const end = Number(item.segment[1]);
        if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) {
          return null;
        }

        return {
          start,
          end,
          category: typeof item.category === 'string' ? item.category : 'unknown',
          UUID: typeof item.UUID === 'string' ? item.UUID : `${start}:${end}`
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.start - b.start || a.end - b.end);
  }

  function findActiveSegment(segments, currentTime) {
    if (!Array.isArray(segments) || !Number.isFinite(currentTime)) {
      return null;
    }

    return segments.find((segment) => currentTime >= segment.start && currentTime < segment.end) || null;
  }

  function secondsLabel(seconds) {
    const safeSeconds = Math.max(0, Math.round(Number(seconds) || 0));
    const minutes = Math.floor(safeSeconds / 60);
    const remaining = safeSeconds % 60;

    if (minutes === 0) {
      return `${remaining}s`;
    }
    return remaining === 0 ? `${minutes}m` : `${minutes}m ${remaining}s`;
  }

  return {
    extractVideoId,
    normalizeSegments,
    findActiveSegment,
    secondsLabel
  };
});
