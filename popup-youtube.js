const youtubeEnabledInput = document.getElementById('youtubeEnabled');
const markersInput = document.getElementById('showMarkers');
const toastInput = document.getElementById('showToast');
const categoriesContainer = document.getElementById('categories');
const youtubeResetButton = document.getElementById('youtubeReset');

window.PopupYoutube = {
  init,
  render
};

async function init() {
  youtubeEnabledInput.addEventListener('change', saveFromControls);
  markersInput.addEventListener('change', saveFromControls);
  toastInput.addEventListener('change', saveFromControls);
  youtubeResetButton.addEventListener('click', resetDefaults);
  render();
}

function render() {
  const settings = PopupApp.getSettings();
  youtubeEnabledInput.checked = settings.youtube.enabled;
  markersInput.checked = settings.youtube.showMarkers;
  toastInput.checked = settings.youtube.showToast;
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

async function saveFromControls() {
  const current = PopupApp.getSettings();
  const categories = { ...current.youtube.categories };
  for (const select of categoriesContainer.querySelectorAll('select[data-category]')) {
    categories[select.dataset.category] = select.value;
  }

  await PopupApp.saveSettings({
    ...current,
    youtube: {
      enabled: youtubeEnabledInput.checked,
      showMarkers: markersInput.checked,
      showToast: toastInput.checked,
      categories
    }
  });
}

async function resetDefaults() {
  const current = PopupApp.getSettings();
  await PopupApp.saveSettings({
    ...current,
    youtube: SegmentSettings.DEFAULT_SETTINGS.youtube
  });
  render();
}

function option(value, label) {
  const item = document.createElement('option');
  item.value = value;
  item.textContent = label;
  return item;
}
