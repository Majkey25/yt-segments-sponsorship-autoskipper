const adguardEnabledInput = document.getElementById('adguardEnabled');
const adguardScopeInput = document.getElementById('adguardScope');
const currentSiteProtectionInput = document.getElementById('currentSiteProtection');
const currentSiteLabel = document.getElementById('currentSiteLabel');
const engineStateLabel = document.getElementById('adguardEngineState');
const filterSearchInput = document.getElementById('filterSearch');
const filterList = document.getElementById('filterList');
const enabledFilterCount = document.getElementById('enabledFilterCount');
const rulesCount = document.getElementById('rulesCount');
const rulesetQuota = document.getElementById('rulesetQuota');
const allowlistEditor = document.getElementById('allowlistEditor');
const allowlistApplyButton = document.getElementById('allowlistApply');
const allowlistCurrentSiteButton = document.getElementById('allowlistCurrentSite');
const allowlistCopyButton = document.getElementById('allowlistCopy');
const userRulesEditor = document.getElementById('userRulesEditor');
const userRulesApplyButton = document.getElementById('userRulesApply');
const userRulesResetButton = document.getElementById('userRulesReset');
const userRulesCopyButton = document.getElementById('userRulesCopy');
const assistantOpenButton = document.getElementById('assistantOpen');
const assistantCloseButton = document.getElementById('assistantClose');
const requestLog = document.getElementById('requestLog');
const requestLogScope = document.getElementById('requestLogScope');
const requestLogClearButton = document.getElementById('requestLogClear');
const diagnostics = document.getElementById('adguardDiagnostics');
const copyDiagnosticsButton = document.getElementById('copyDiagnostics');
const adguardStartButton = document.getElementById('adguardStart');
const adguardStopButton = document.getElementById('adguardStop');

let dashboardState = null;
let catalog = [];
let blockedLog = [];
let refreshTimer = null;

window.PopupAdguard = {
  init,
  renderSettings
};

async function init() {
  wireEvents();
  await loadCatalog();
  await refreshDashboard();
  refreshTimer = setInterval(() => {
    if (!document.getElementById('adguardPanel').hidden) {
      void refreshRuntimeOnly();
    }
  }, 2000);
  window.addEventListener('unload', () => clearInterval(refreshTimer), { once: true });
}

function wireEvents() {
  adguardEnabledInput.addEventListener('change', applyControls);
  adguardScopeInput.addEventListener('change', applyControls);
  currentSiteProtectionInput.addEventListener('change', toggleCurrentSiteProtection);
  filterSearchInput.addEventListener('input', renderFilters);
  filterList.addEventListener('change', handleFilterChange);
  allowlistApplyButton.addEventListener('click', applyAllowlist);
  allowlistCurrentSiteButton.addEventListener('click', () => setCurrentSiteProtection(false));
  allowlistCopyButton.addEventListener('click', () => copyText(allowlistEditor.value, 'Allowlist copied'));
  userRulesApplyButton.addEventListener('click', applyUserRules);
  userRulesResetButton.addEventListener('click', resetUserRules);
  userRulesCopyButton.addEventListener('click', () => copyText(userRulesEditor.value, 'User rules copied'));
  assistantOpenButton.addEventListener('click', () => runCommand('OPEN_ADGUARD_ASSISTANT', 'Assistant opened'));
  assistantCloseButton.addEventListener('click', () => runCommand('CLOSE_ADGUARD_ASSISTANT', 'Assistant closed'));
  requestLogScope.addEventListener('change', renderRequestLog);
  requestLogClearButton.addEventListener('click', clearRequestLog);
  copyDiagnosticsButton.addEventListener('click', copyDiagnostics);
  adguardStartButton.addEventListener('click', () => runCommand('START_ADGUARD', 'AdGuard engine started'));
  adguardStopButton.addEventListener('click', () => runCommand('STOP_ADGUARD', 'AdGuard engine stopped'));
}

async function loadCatalog() {
  try {
    const response = await fetch(chrome.runtime.getURL('filters/catalog.json'));
    if (!response.ok) {
      throw new Error(`Filter catalog returned HTTP ${response.status}`);
    }
    const payload = await response.json();
    catalog = Array.isArray(payload.filters) ? payload.filters : [];
  } catch (error) {
    catalog = [];
    PopupApp.setStatus(error.message || 'Failed to load filter catalog', 'error');
  }
}

async function refreshDashboard() {
  await refreshRuntimeOnly();
  renderSettings();
}

async function refreshRuntimeOnly() {
  try {
    const state = await sendMessage({ type: 'GET_ADGUARD_STATE' });
    dashboardState = state;
    PopupApp.setSettings(state.settings);
    const logResponse = await sendMessage({ type: 'GET_ADGUARD_LOG' });
    blockedLog = Array.isArray(logResponse.log) ? logResponse.log : [];
    renderSettings();
    renderRequestLog();
  } catch (error) {
    PopupApp.setStatus(error.message || 'Failed to refresh AdGuard state', 'error');
  }
}

function renderSettings() {
  const settings = PopupApp.getSettings().adguard;
  adguardEnabledInput.checked = settings.enabled;
  adguardScopeInput.value = settings.scope;
  allowlistEditor.value = settings.allowlist.join('\n');
  userRulesEditor.value = settings.rules.join('\n');
  engineStateLabel.textContent = dashboardState?.engineRunning ? 'Engine running' : 'Engine stopped';
  currentSiteLabel.textContent = dashboardState?.currentHostname
    ? dashboardState.currentHostname
    : 'No supported page selected.';
  currentSiteProtectionInput.checked = Boolean(dashboardState?.currentSiteProtected);
  currentSiteProtectionInput.disabled = settings.scope !== 'global' || !dashboardState?.currentHostname;
  allowlistCurrentSiteButton.disabled = settings.scope !== 'global' || !dashboardState?.currentHostname;
  enabledFilterCount.textContent = String(settings.filterIds.length);
  rulesCount.textContent = String(dashboardState?.rulesCount ?? 0);
  const maxEnabled = dashboardState?.maxEnabledStaticRulesets;
  rulesetQuota.textContent = `${settings.filterIds.length} / ${Number.isInteger(maxEnabled) ? maxEnabled : '?'}`;
  renderFilters();
  renderDiagnostics();
}

function renderFilters() {
  const selected = new Set(PopupApp.getSettings().adguard.filterIds);
  const search = filterSearchInput.value.trim().toLowerCase();
  const visible = catalog.filter((filter) => {
    if (!search) {
      return true;
    }
    return `${filter.name || ''} ${filter.description || ''} ${filter.group || ''}`.toLowerCase().includes(search);
  });
  const groups = AdguardFilters.groupCatalog(visible);
  filterList.replaceChildren();

  if (visible.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'helper';
    empty.textContent = catalog.length === 0 ? 'No packaged filters are available.' : 'No filters match this search.';
    filterList.appendChild(empty);
    return;
  }

  for (const [groupName, filters] of Object.entries(groups)) {
    const group = document.createElement('section');
    group.className = 'filter-group';
    const heading = document.createElement('div');
    heading.className = 'filter-group-title';
    heading.textContent = groupName;
    group.appendChild(heading);

    for (const filter of filters) {
      const row = document.createElement('label');
      row.className = 'filter-row';
      const copy = document.createElement('span');
      copy.className = 'filter-copy';
      const name = document.createElement('strong');
      name.textContent = filter.name || `Filter ${filter.id}`;
      const description = document.createElement('small');
      description.textContent = filter.description || `AdGuard filter ${filter.id}`;
      copy.append(name, description);

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.dataset.filterId = String(filter.id);
      checkbox.checked = selected.has(filter.id);
      checkbox.setAttribute('aria-label', `Enable ${name.textContent}`);
      row.append(copy, checkbox);
      group.appendChild(row);
    }
    filterList.appendChild(group);
  }
}

async function handleFilterChange(event) {
  const checkbox = event.target.closest('input[data-filter-id]');
  if (!checkbox) {
    return;
  }

  const selectedIds = selectedFilterIds();
  const maxEnabled = dashboardState?.maxEnabledStaticRulesets;
  if (Number.isInteger(maxEnabled) && selectedIds.length > maxEnabled) {
    checkbox.checked = false;
    PopupApp.setStatus(`Chrome allows at most ${maxEnabled} enabled static rulesets`, 'error');
    return;
  }

  await applyControls();
}

async function applyControls() {
  const current = PopupApp.getSettings().adguard;
  const proposed = {
    ...current,
    enabled: adguardEnabledInput.checked,
    scope: adguardScopeInput.value,
    filterIds: selectedFilterIds()
  };
  await applyAdguard(proposed, 'AdGuard settings applied');
}

async function applyAllowlist() {
  const current = PopupApp.getSettings().adguard;
  await applyAdguard({
    ...current,
    allowlist: AdguardUtils.parseDomainList(allowlistEditor.value)
  }, 'Allowlist applied');
}

async function applyUserRules() {
  const current = PopupApp.getSettings().adguard;
  const rules = userRulesEditor.value
    .split(/\r?\n/)
    .map((rule) => rule.trim())
    .filter(Boolean);
  await applyAdguard({ ...current, rules: [...new Set(rules)] }, 'User rules applied');
}

async function resetUserRules() {
  userRulesEditor.value = '';
  await applyUserRules();
}

async function applyAdguard(adguard, successMessage) {
  try {
    PopupApp.setStatus('Applying...', 'info');
    const state = await sendMessage({ type: 'APPLY_ADGUARD_SETTINGS', adguard });
    dashboardState = state;
    PopupApp.setSettings(state.settings);
    renderSettings();
    PopupApp.setStatus(successMessage, 'success');
  } catch (error) {
    PopupApp.setStatus(error.message || 'AdGuard configuration failed', 'error');
    await refreshRuntimeOnly();
  }
}

async function toggleCurrentSiteProtection() {
  await setCurrentSiteProtection(currentSiteProtectionInput.checked);
}

async function setCurrentSiteProtection(protectedState) {
  try {
    const state = await sendMessage({
      type: 'SET_CURRENT_SITE_PROTECTION',
      protected: protectedState
    });
    dashboardState = state;
    PopupApp.setSettings(state.settings);
    renderSettings();
    PopupApp.setStatus(protectedState ? 'Current site protected' : 'Current site allowlisted', 'success');
  } catch (error) {
    PopupApp.setStatus(error.message || 'Current-site protection could not be changed', 'error');
    await refreshRuntimeOnly();
  }
}

async function runCommand(type, successMessage) {
  try {
    const response = await sendMessage({ type });
    if (response.settings) {
      dashboardState = response;
      PopupApp.setSettings(response.settings);
      renderSettings();
    }
    PopupApp.setStatus(successMessage, 'success');
  } catch (error) {
    PopupApp.setStatus(error.message || 'AdGuard command failed', 'error');
  }
}

async function clearRequestLog() {
  try {
    await sendMessage({ type: 'CLEAR_ADGUARD_LOG' });
    blockedLog = [];
    renderRequestLog();
    if (dashboardState) {
      dashboardState.blockedRequestCount = 0;
      renderDiagnostics();
    }
    PopupApp.setStatus('Request log cleared', 'success');
  } catch (error) {
    PopupApp.setStatus(error.message || 'Failed to clear request log', 'error');
  }
}

function renderRequestLog() {
  requestLog.replaceChildren();
  const currentTabOnly = requestLogScope.value === 'current';
  const tabId = dashboardState?.currentTabId;
  const entries = blockedLog
    .filter((entry) => !currentTabOnly || entry.tabId === tabId)
    .slice(-200)
    .reverse();

  if (entries.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'helper';
    empty.textContent = 'No blocked requests in this view yet.';
    requestLog.appendChild(empty);
    return;
  }

  for (const entry of entries) {
    const row = document.createElement('div');
    row.className = 'request-row';
    const meta = document.createElement('div');
    meta.className = 'request-meta';
    const type = document.createElement('span');
    type.textContent = entry.requestType || 'OTHER';
    const time = document.createElement('span');
    time.textContent = new Date(entry.timestamp || Date.now()).toLocaleTimeString();
    meta.append(type, time);

    const url = document.createElement('div');
    url.className = 'request-url';
    url.textContent = entry.requestUrl || 'Unknown request';
    url.title = url.textContent;

    const source = document.createElement('small');
    const details = [];
    if (Number.isInteger(entry.assumedFilterId) && entry.assumedFilterId >= 0) {
      details.push(`Filter ${entry.assumedFilterId}`);
    }
    if (entry.companyCategoryName) {
      details.push(entry.companyCategoryName);
    }
    if (entry.referrerUrl) {
      details.push(`from ${entry.referrerUrl}`);
    }
    source.textContent = details.join(' · ');
    row.append(meta, url, source);
    requestLog.appendChild(row);
  }
}

function renderDiagnostics() {
  const settings = PopupApp.getSettings().adguard;
  const lines = [
    `Engine: ${dashboardState?.engineRunning ? 'running' : 'stopped'}`,
    `Filtering: ${settings.enabled ? 'enabled' : 'disabled'}`,
    `Scope: ${settings.scope}`,
    `Filters: ${settings.filterIds.length}`,
    `Filter IDs: ${settings.filterIds.join(', ') || 'none'}`,
    `Loaded rules: ${dashboardState?.rulesCount ?? 0}`,
    `Custom rules: ${settings.rules.length}`,
    `Allowlist entries: ${settings.allowlist.length}`,
    `Blocked this session: ${dashboardState?.blockedRequestCount ?? blockedLog.length}`,
    `Available static rules: ${dashboardState?.availableStaticRuleCount ?? 'unknown'}`,
    `Max enabled rulesets: ${dashboardState?.maxEnabledStaticRulesets ?? 'unknown'}`,
    `Last configured: ${dashboardState?.lastConfiguredAt || 'never'}`,
    `Last error: ${dashboardState?.lastConfigurationError || 'none'}`
  ];
  diagnostics.textContent = lines.join('\n');
}

async function copyDiagnostics() {
  await copyText(diagnostics.textContent, 'Diagnostics copied');
}

function selectedFilterIds() {
  return [...filterList.querySelectorAll('input[data-filter-id]:checked')]
    .map((input) => Number(input.dataset.filterId))
    .filter(Number.isInteger)
    .sort((a, b) => a - b);
}

async function copyText(text, successMessage) {
  try {
    await navigator.clipboard.writeText(text || '');
    PopupApp.setStatus(successMessage, 'success');
  } catch {
    PopupApp.setStatus('Clipboard access failed', 'error');
  }
}

async function sendMessage(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok) {
    throw new Error(response?.error || 'AdGuard operation failed');
  }
  return response;
}
