const enabledInput = document.getElementById('enabled');
const adBlockInput = document.getElementById('adBlockEnabled');
const adBlockScopeInput = document.getElementById('adBlockScope');
const adBlockScopeStatus = document.getElementById('adBlockScopeStatus');
const adBlockScopeCopy = document.getElementById('adBlockScopeCopy');
const markersInput = document.getElementById('showMarkers');
const toastInput = document.getElementById('showToast');
const themeInput = document.getElementById('theme');
const categoriesContainer = document.getElementById('categories');
const resetButton = document.getElementById('reset');
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');

let settings;

init();

async function init() {
  const stored = await chrome.storage.sync.get('settings');
  settings = SegmentSettings.sanitizeSettings(stored.settings);
  render();

  enabledInput.addEventListener('change', saveFromControls);
  adBlockInput.addEventListener('change', saveFromControls);
  adBlockScopeInput.addEventListener('change', saveFromControls);
  markersInput.addEventListener('change', saveFromControls);
  toastInput.addEventListener('change', saveFromControls);
  themeInput.addEventListener('change', saveFromControls);
  resetButton.addEventListener('click', resetDefaults);
  systemTheme.addEventListener('change', () => {
    if (settings.theme === 'system') {
      applyTheme('system');
    }
  });
}

function render() {
  enabledInput.checked = settings.enabled;
  adBlockInput.checked = settings.adBlockEnabled;
  adBlockScopeInput.value = settings.adBlockScope;
  markersInput.checked = settings.showMarkers;
  toastInput.checked = settings.showToast;
  themeInput.value = settings.theme;
  applyTheme(settings.theme);
  renderAdBlockScope();
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
    select.value = settings.categories[name];
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
  const categories = { ...settings.categories };
  for (const select of categoriesContainer.querySelectorAll('select[data-category]')) {
    categories[select.dataset.category] = select.value;
  }

  settings = SegmentSettings.sanitizeSettings({
    enabled: enabledInput.checked,
    adBlockEnabled: adBlockInput.checked,
    adBlockScope: adBlockScopeInput.value,
    showMarkers: markersInput.checked,
    showToast: toastInput.checked,
    theme: themeInput.value,
    categories
  });

  applyTheme(settings.theme);
  renderAdBlockScope();
  await chrome.storage.sync.set({ settings });
}

async function resetDefaults() {
  settings = SegmentSettings.sanitizeSettings(SegmentSettings.DEFAULT_SETTINGS);
  await chrome.storage.sync.set({ settings });
  render();
}

function renderAdBlockScope() {
  const globalScope = settings.adBlockScope === 'global';
  adBlockScopeStatus.textContent = globalScope ? 'Global' : 'YouTube only';
  adBlockScopeCopy.textContent = globalScope
    ? 'Blocks ads across all websites using AdGuard filters'
    : 'AdGuard filtering is restricted to YouTube';
}

function applyTheme(theme) {
  const resolved = theme === 'system'
    ? (systemTheme.matches ? 'dark' : 'light')
    : theme;
  document.documentElement.dataset.theme = resolved;
}