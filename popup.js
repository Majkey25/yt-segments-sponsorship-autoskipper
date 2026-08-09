const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
const tabButtons = [...document.querySelectorAll('[role="tab"]')];
const tabPanels = [...document.querySelectorAll('[role="tabpanel"]')];
const themeInput = document.getElementById('theme');

let settings = SegmentSettings.sanitizeSettings();

window.PopupApp = {
  getSettings: () => settings,
  setSettings(next) {
    settings = SegmentSettings.sanitizeSettings(next);
  },
  saveSettings,
  setStatus,
  applyTheme,
  activateTab
};

window.addEventListener('DOMContentLoaded', init);

async function init() {
  const stored = await chrome.storage.sync.get('settings');
  settings = SegmentSettings.sanitizeSettings(stored.settings);
  await chrome.storage.sync.set({ settings });

  themeInput.value = settings.theme;
  applyTheme(settings.theme);
  themeInput.addEventListener('change', saveTheme);
  systemTheme.addEventListener('change', () => {
    if (settings.theme === 'system') {
      applyTheme('system');
    }
  });

  for (const button of tabButtons) {
    button.addEventListener('click', () => activateTab(button.id));
    button.addEventListener('keydown', handleTabKeydown);
  }

  const local = await chrome.storage.local.get('popupTab');
  const initialTab = local.popupTab === 'adguardTab' ? 'adguardTab' : 'youtubeTab';
  activateTab(initialTab, false);

  await window.PopupYoutube?.init?.();
  await window.PopupAdguard?.init?.();

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync' || !changes.settings) {
      return;
    }
    settings = SegmentSettings.sanitizeSettings(changes.settings.newValue);
    themeInput.value = settings.theme;
    applyTheme(settings.theme);
    window.PopupYoutube?.render?.();
    window.PopupAdguard?.renderSettings?.();
  });
}

async function saveSettings(next) {
  settings = SegmentSettings.sanitizeSettings(next);
  await chrome.storage.sync.set({ settings });
  return settings;
}

async function saveTheme() {
  const next = SegmentSettings.sanitizeSettings({
    ...settings,
    theme: themeInput.value
  });
  await saveSettings(next);
  applyTheme(next.theme);
}

function activateTab(tabId, persist = true) {
  const active = tabButtons.find((button) => button.id === tabId) || tabButtons[0];

  for (const button of tabButtons) {
    const selected = button === active;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
  }

  for (const panel of tabPanels) {
    panel.hidden = panel.getAttribute('aria-labelledby') !== active.id;
  }

  if (persist) {
    void chrome.storage.local.set({ popupTab: active.id });
  }
}

function handleTabKeydown(event) {
  if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) {
    return;
  }
  event.preventDefault();
  const currentIndex = tabButtons.indexOf(event.currentTarget);
  const direction = event.key === 'ArrowRight' ? 1 : -1;
  const nextIndex = (currentIndex + direction + tabButtons.length) % tabButtons.length;
  tabButtons[nextIndex].focus();
  activateTab(tabButtons[nextIndex].id);
}

function setStatus(message, type = 'info') {
  const status = document.getElementById('adguardStatus');
  if (!status) {
    return;
  }
  status.textContent = message || '';
  status.dataset.type = type;
}

function applyTheme(theme) {
  const resolved = theme === 'system'
    ? (systemTheme.matches ? 'dark' : 'light')
    : theme;
  document.documentElement.dataset.theme = resolved;
}
