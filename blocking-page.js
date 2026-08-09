const params = new URLSearchParams(location.search);
const blockedUrlElement = document.getElementById('blockedUrl');
const blockedRuleElement = document.getElementById('blockedRule');
const blockedFilterElement = document.getElementById('blockedFilter');
const goBackButton = document.getElementById('goBack');
const allowSiteButton = document.getElementById('allowSite');
const statusElement = document.getElementById('status');

const rawUrl = params.get('url') || '';
const rawRule = params.get('rule') || '';
const rawFilterId = params.get('filterId') || '';

blockedUrlElement.textContent = rawUrl || 'Unknown';
blockedRuleElement.textContent = rawRule || 'Unknown';
blockedFilterElement.textContent = rawFilterId || 'Unknown';

let destination = null;
let hostname = null;

try {
  const parsed = new URL(rawUrl);
  if (['http:', 'https:'].includes(parsed.protocol)) {
    destination = parsed.href;
    hostname = AdguardUtils.normalizeHostname(parsed.hostname);
  }
} catch {
  destination = null;
}

allowSiteButton.hidden = !hostname;

goBackButton.addEventListener('click', () => {
  if (history.length > 1) {
    history.back();
  } else {
    location.href = 'about:blank';
  }
});

allowSiteButton.addEventListener('click', async () => {
  if (!hostname || !destination) {
    return;
  }

  allowSiteButton.disabled = true;
  statusElement.textContent = 'Updating allowlist...';

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'SET_CURRENT_SITE_PROTECTION',
      hostname,
      protected: false
    });
    if (!response?.ok) {
      throw new Error(response?.error || 'Could not update the allowlist');
    }
    statusElement.textContent = 'Site allowed. Continuing...';
    location.href = destination;
  } catch (error) {
    statusElement.textContent = error?.message || 'Could not update the allowlist';
    allowSiteButton.disabled = false;
  }
});
