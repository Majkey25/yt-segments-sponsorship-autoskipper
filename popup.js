const enabledInput = document.getElementById('youtubeEnabled');
const markersInput = document.getElementById('showMarkers');
const toastInput = document.getElementById('showToast');
const themeButtons = document.querySelectorAll('[data-theme-value]');
const categoriesContainer = document.getElementById('categories');
const resetButton = document.getElementById('youtubeReset');
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');

let settings = SegmentSettings.sanitizeSettings();

window.addEventListener('DOMContentLoaded', init);

async function init() {
  const stored = await chrome.storage.sync.get('settings');
  settings = SegmentSettings.sanitizeSettings(stored.settings);
  await chrome.storage.sync.set({ settings });
  render();

  enabledInput.addEventListener('change', saveFromControls);
  markersInput.addEventListener('change', saveFromControls);
  toastInput.addEventListener('change', saveFromControls);
  for (const button of themeButtons) {
    button.addEventListener('click', saveTheme);
  }
  resetButton.addEventListener('click', resetDefaults);
  systemTheme.addEventListener('change', () => {
    if (settings.theme === 'system') {
      applyTheme('system');
    }
  });
}

function render() {
  enabledInput.checked = settings.youtube.enabled;
  markersInput.checked = settings.youtube.showMarkers;
  toastInput.checked = settings.youtube.showToast;
  renderTheme();
  categoriesContainer.replaceChildren();

  for (const [name, definition] of Object.entries(SegmentSettings.CATEGORY_DEFINITIONS)) {
    const row = document.createElement('label');
    row.className = 'category-row';

    const identity = document.createElement('span');
    identity.className = 'category-identity';

    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = definition.color;

    const label = document.createElement('span');
    label.textContent = definition.label;
    identity.append(dot, label);

    const select = document.createElement('select');
    select.dataset.category = name;
    select.setAttribute('aria-label', `${definition.label} behavior`);
    select.append(
      option('auto', 'Auto skip'),
      option('button', 'Show button'),
      option('ignore', 'Ignore')
    );
    select.value = settings.youtube.categories[name];
    select.addEventListener('change', saveFromControls);

    row.append(identity, select);
    categoriesContainer.appendChild(row);
  }
}

function option(value, label) {
  const item = document.createElement('option');
  item.value = value;
  item.textContent = label;
  return item;
}

async function saveFromControls() {
  const categories = { ...settings.youtube.categories };
  for (const select of categoriesContainer.querySelectorAll('select[data-category]')) {
    categories[select.dataset.category] = select.value;
  }

  settings = SegmentSettings.sanitizeSettings({
    youtube: {
      enabled: enabledInput.checked,
      showMarkers: markersInput.checked,
      showToast: toastInput.checked,
      categories
    },
    theme: settings.theme
  });
  applyTheme(settings.theme);
  await chrome.storage.sync.set({ settings });
}

async function saveTheme(event) {
  settings = SegmentSettings.sanitizeSettings({
    ...settings,
    theme: event.currentTarget.dataset.themeValue
  });
  renderTheme();
  await chrome.storage.sync.set({ settings });
}

async function resetDefaults() {
  settings = SegmentSettings.sanitizeSettings(SegmentSettings.DEFAULT_SETTINGS);
  await chrome.storage.sync.set({ settings });
  render();
}

function applyTheme(theme) {
  const resolved = theme === 'system'
    ? (systemTheme.matches ? 'dark' : 'light')
    : theme;
  document.documentElement.dataset.theme = resolved;
}

function renderTheme() {
  for (const button of themeButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.themeValue === settings.theme));
  }
  applyTheme(settings.theme);
}
