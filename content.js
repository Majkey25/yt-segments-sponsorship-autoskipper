const state = {
  settings: SegmentSettings.sanitizeSettings(),
  videoID: null,
  video: null,
  segments: [],
  requestVersion: 0,
  skipButton: null,
  skipButtonText: null,
  toast: null,
  markerLayer: null,
  markerHost: null,
  lastAutoKey: null
};

start();

async function start() {
  const stored = await chrome.storage.sync.get('settings');
  state.settings = SegmentSettings.sanitizeSettings(stored.settings);

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync' || !changes.settings) {
      return;
    }
    state.settings = SegmentSettings.sanitizeSettings(changes.settings.newValue);
    reloadCurrentVideo();
  });

  document.addEventListener('yt-navigate-finish', () => checkContext(true));
  window.addEventListener('popstate', () => checkContext(true));

  checkContext(true);
  setInterval(() => checkContext(false), 750);
}

function checkContext(forceReload) {
  const nextVideoID = SegmentUtils.extractVideoId(location.href);
  const nextVideo = document.querySelector('video.html5-main-video, video');

  if (nextVideo !== state.video) {
    detachVideo();
    state.video = nextVideo || null;
    attachVideo();
  }

  if (forceReload || nextVideoID !== state.videoID) {
    state.videoID = nextVideoID;
    reloadCurrentVideo();
  } else if (state.settings.youtube.showMarkers && state.segments.length > 0 && !state.markerLayer?.isConnected) {
    renderMarkers();
  }
}

function attachVideo() {
  if (!state.video) {
    return;
  }
  state.video.addEventListener('timeupdate', handlePlaybackPosition);
  state.video.addEventListener('seeking', handlePlaybackPosition);
  state.video.addEventListener('loadedmetadata', renderMarkers);
  state.video.addEventListener('durationchange', renderMarkers);
}

function detachVideo() {
  if (!state.video) {
    return;
  }
  state.video.removeEventListener('timeupdate', handlePlaybackPosition);
  state.video.removeEventListener('seeking', handlePlaybackPosition);
  state.video.removeEventListener('loadedmetadata', renderMarkers);
  state.video.removeEventListener('durationchange', renderMarkers);
}

async function reloadCurrentVideo() {
  const requestVersion = ++state.requestVersion;
  state.segments = [];
  state.lastAutoKey = null;
  hideSkipButton();
  clearMarkers();

  if (!state.settings.youtube.enabled || !state.videoID) {
    return;
  }

  const categories = SegmentSettings.activeCategories(state.settings);
  if (categories.length === 0) {
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_SEGMENTS',
      videoID: state.videoID,
      categories
    });

    if (requestVersion !== state.requestVersion) {
      return;
    }

    if (!response?.ok) {
      throw new Error(response?.error || 'Failed to load segment data');
    }

    state.segments = SegmentUtils.normalizeSegments(response.segments)
      .filter((segment) => state.settings.youtube.categories[segment.category] !== 'ignore');

    renderMarkers();
    handlePlaybackPosition();
  } catch (error) {
    if (requestVersion !== state.requestVersion) {
      return;
    }
    console.warn('[Segment Skip]', error);
  }
}

function handlePlaybackPosition() {
  const video = state.video;
  if (!video || !state.settings.youtube.enabled || state.segments.length === 0) {
    hideSkipButton();
    return;
  }

  const currentTime = video.currentTime;
  const active = state.segments.filter(
    (segment) => currentTime >= segment.start && currentTime < segment.end
  );

  if (active.length === 0) {
    state.lastAutoKey = null;
    hideSkipButton();
    return;
  }

  const autoSegment = active.find(
    (segment) => state.settings.youtube.categories[segment.category] === 'auto'
  );

  if (autoSegment) {
    const key = `${autoSegment.UUID}:${Math.floor(currentTime * 10)}`;
    if (state.lastAutoKey !== key) {
      state.lastAutoKey = key;
      skipSegment(autoSegment, true);
    }
    return;
  }

  const buttonSegment = active.find(
    (segment) => state.settings.youtube.categories[segment.category] === 'button'
  );

  if (buttonSegment) {
    showSkipButton(buttonSegment);
  } else {
    hideSkipButton();
  }
}

function skipSegment(segment, automatic) {
  const video = state.video;
  if (!video || !Number.isFinite(segment.end) || segment.end <= video.currentTime) {
    return;
  }

  const skippedSeconds = Math.max(0, segment.end - video.currentTime);
  video.currentTime = segment.end;
  hideSkipButton();

  if (state.settings.youtube.showToast) {
    const prefix = automatic ? 'Skipped' : 'Skipped';
    showToast(`${prefix} ${labelForCategory(segment.category)} · ${SegmentUtils.secondsLabel(skippedSeconds)}`);
  }
}

function showSkipButton(segment) {
  const player = getPlayer();
  if (!player) {
    return;
  }

  if (!state.skipButton?.isConnected) {
    state.skipButton = document.createElement('button');
    state.skipButton.type = 'button';
    state.skipButton.className = 'majkey-segment-skip-button';

    state.skipButtonText = document.createElement('span');
    state.skipButtonText.className = 'majkey-segment-skip-text';

    const icon = document.createElement('span');
    icon.className = 'majkey-segment-skip-icon';
    icon.setAttribute('aria-hidden', 'true');

    state.skipButton.append(state.skipButtonText, icon);
    state.skipButton.addEventListener('click', () => {
      const target = state.skipButton?.segment;
      if (target) {
        skipSegment(target, false);
      }
    });
    player.appendChild(state.skipButton);
  }

  state.skipButton.segment = segment;
  state.skipButtonText.textContent = `Skip ${labelForCategory(segment.category)}`;
  state.skipButton.hidden = false;
}

function hideSkipButton() {
  if (state.skipButton) {
    state.skipButton.hidden = true;
    state.skipButton.segment = null;
  }
}

function showToast(text) {
  const player = getPlayer();
  if (!player) {
    return;
  }

  if (!state.toast?.isConnected) {
    state.toast = document.createElement('div');
    state.toast.className = 'majkey-segment-toast';
    player.appendChild(state.toast);
  }

  state.toast.textContent = text;
  state.toast.classList.remove('is-visible');
  void state.toast.offsetWidth;
  state.toast.classList.add('is-visible');
  clearTimeout(state.toast.hideTimer);
  state.toast.hideTimer = setTimeout(() => state.toast?.classList.remove('is-visible'), 1800);
}

function renderMarkers() {
  clearMarkers();

  const video = state.video;
  if (!state.settings.youtube.showMarkers || !video || !Number.isFinite(video.duration) || video.duration <= 0) {
    return;
  }

  const progressHost = document.querySelector('.ytp-progress-list');
  if (!progressHost) {
    return;
  }

  const layer = document.createElement('div');
  layer.className = 'majkey-segment-marker-layer';

  for (const segment of state.segments) {
    const left = Math.max(0, Math.min(100, (segment.start / video.duration) * 100));
    const right = Math.max(0, Math.min(100, (segment.end / video.duration) * 100));
    const width = Math.max(0.08, right - left);
    const definition = SegmentSettings.CATEGORY_DEFINITIONS[segment.category];

    const marker = document.createElement('span');
    marker.className = 'majkey-segment-marker';
    marker.style.left = `${left}%`;
    marker.style.width = `${width}%`;
    marker.style.background = definition?.color || '#ffffff';
    marker.title = labelForCategory(segment.category);
    layer.appendChild(marker);
  }

  progressHost.appendChild(layer);
  state.markerLayer = layer;
  state.markerHost = progressHost;
}

function clearMarkers() {
  state.markerLayer?.remove();
  state.markerLayer = null;
  state.markerHost = null;
}

function getPlayer() {
  return document.querySelector('.html5-video-player') || state.video?.parentElement || null;
}

function labelForCategory(category) {
  const label = SegmentSettings.CATEGORY_DEFINITIONS[category]?.label || category || 'segment';
  return label.toLowerCase();
}
