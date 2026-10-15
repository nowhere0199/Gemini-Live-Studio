(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const KEY_STORE = 'geminiLiveStudio.keyProfiles.v1';
  const ACTIVE_KEY = 'geminiLiveStudio.activeKeyId.v1';
  const REMEMBER_PREF = 'geminiLiveStudio.rememberKey.v1';
  const THEME_STORE = 'geminiLiveStudio.theme.v1';
  const DEFAULT_THEME = { preset: 'midnight', background: '#0c0d10', surface: '#15171c', accent: '#d7c19b' };
  const PRESETS = {
    midnight: { background: '#0c0d10', surface: '#15171c', accent: '#d7c19b' },
    slate:    { background: '#0c141b', surface: '#15232d', accent: '#83c5e8' },
    forest:   { background: '#0c1511', surface: '#14231c', accent: '#8bd2a5' },
    plum:     { background: '#160f1b', surface: '#24192d', accent: '#d2a5ee' },
    light:    { background: '#f1f3f6', surface: '#ffffff', accent: '#525ee8' }
  };
  let profiles = [];
  let editingKeyId = null;
  let activeTab = 'connection';
  let themeState = { ...DEFAULT_THEME };

  function safeRead(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch { return fallback; }
  }
  function safeWrite(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { return false; }
  }
  function readProfiles() {
    const value = safeRead(KEY_STORE, []);
    return Array.isArray(value) ? value.filter(p => p && typeof p.id === 'string' && typeof p.label === 'string' && typeof p.key === 'string' && p.key.length >= 20).slice(0, 30) : [];
  }
  function persistProfiles() { return safeWrite(KEY_STORE, profiles); }
  function newId() {
    try { return crypto.randomUUID(); }
    catch { return 'key-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9); }
  }
  function rememberEnabled() { return $('rememberKeyToggle')?.checked !== false; }
  function profileById(id) { return profiles.find(p => p.id === id); }

  function renderProfileSelect(activeId = '') {
    const select = $('savedKeySelect');
    if (!select) return;
    select.replaceChildren();
    const fresh = document.createElement('option');
    fresh.value = '';
    fresh.textContent = profiles.length ? 'New / unsaved key' : 'No saved keys · paste below';
    select.appendChild(fresh);
    profiles.forEach(profile => {
      const option = document.createElement('option');
      option.value = profile.id;
      option.textContent = profile.label;
      select.appendChild(option);
    });
    select.value = profileById(activeId) ? activeId : '';
    $('manageKeysBtn').setAttribute('aria-label', 'Manage ' + profiles.length + ' saved API key profiles');
  }
  function showSelectedProfile(id) {
    const profile = profileById(id);
    if (profile) {
      $('apiKey').value = profile.key;
      try { localStorage.setItem(ACTIVE_KEY, profile.id); } catch {}
    } else {
      $('apiKey').value = '';
      try { localStorage.removeItem(ACTIVE_KEY); } catch {}
    }
    $('apiKey').type = 'password';
    $('revealKeyBtn').innerHTML = '';
    $('revealKeyBtn').appendChild(window.LocalIcons.create('eye', 15));
    $('revealKeyBtn').setAttribute('aria-label', 'Show API key');
  }

  function renderKeyManager() {
    const list = $('savedKeyList');
    if (!list) return;
    list.replaceChildren();
    if (!profiles.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-keys';
      const ico = document.createElement('span'); ico.appendChild(window.LocalIcons.create('key-round', 22));
      const title = document.createElement('strong'); title.textContent = 'No saved profiles yet';
      const note = document.createElement('p'); note.textContent = 'Save a named key here, or connect with Remember this key enabled to create a default profile automatically.';
      empty.append(ico, title, note); list.appendChild(empty); return;
    }
    const activeId = $('savedKeySelect').value;
    profiles.forEach(profile => {
      const row = document.createElement('article'); row.className = 'saved-key-row';
      const mark = document.createElement('span'); mark.className = 'saved-key-mark'; mark.appendChild(window.LocalIcons.create('key-round', 17));
      const details = document.createElement('div'); details.className = 'saved-key-details';
      const name = document.createElement('strong'); name.textContent = profile.label;
      const meta = document.createElement('small'); meta.textContent = (profile.id === activeId ? 'Selected in connection panel' : 'Saved in this browser') + (profile.updatedAt ? ' · updated ' + new Date(profile.updatedAt).toLocaleDateString() : '');
      details.append(name, meta);
      const actions = document.createElement('div'); actions.className = 'saved-key-actions';
      const use = document.createElement('button'); use.type = 'button'; use.className = 'mini-btn icon-mini-btn'; use.title = 'Use this profile'; use.setAttribute('aria-label', 'Use ' + profile.label); use.appendChild(window.LocalIcons.create('check', 15));
      use.addEventListener('click', () => { renderProfileSelect(profile.id); showSelectedProfile(profile.id); renderKeyManager(); keyStatus('Selected “' + profile.label + '” in the connection panel.', 'success'); });
      const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'mini-btn icon-mini-btn'; edit.title = 'Edit this profile'; edit.setAttribute('aria-label', 'Edit ' + profile.label); edit.appendChild(window.LocalIcons.create('pencil', 15));
      edit.addEventListener('click', () => {
        editingKeyId = profile.id;
        $('keyProfileLabel').value = profile.label;
        $('managedKeyValue').value = profile.key;
        $('managedKeyValue').type = 'password';
        $('keyEditorTitle').textContent = 'Edit key profile';
        $('saveManagedKeyBtn').lastChild.textContent = 'Update profile';
        $('cancelEditKeyBtn').hidden = false;
        $('keyManagerStatus').textContent = 'Editing “' + profile.label + '”. The full key is only shown in this password field.';
        $('keyProfileLabel').focus();
      });
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'mini-btn icon-mini-btn danger-icon-btn'; remove.title = 'Remove saved key'; remove.setAttribute('aria-label', 'Remove ' + profile.label); remove.appendChild(window.LocalIcons.create('trash-2', 15));
      remove.addEventListener('click', () => {
        if (!confirm('Remove the saved key profile “' + profile.label + '” from this browser? This does not revoke the key at Google.')) return;
        profiles = profiles.filter(p => p.id !== profile.id); persistProfiles();
        const wasSelected = $('savedKeySelect').value === profile.id;
        renderProfileSelect(wasSelected ? '' : $('savedKeySelect').value);
        if (wasSelected) { $('apiKey').value = ''; try { localStorage.removeItem(ACTIVE_KEY); } catch {} }
        if (editingKeyId === profile.id) resetKeyEditor();
        renderKeyManager(); keyStatus('Saved profile removed. The key itself has not been revoked.', 'success');
      });
      actions.append(use, edit, remove);
      row.append(mark, details, actions); list.appendChild(row);
    });
  }
  function keyStatus(message, type = '') {
    const target = $('keyManagerStatus');
    if (!target) return;
    target.textContent = message;
    target.classList.toggle('status-success', type === 'success');
    target.classList.toggle('status-error', type === 'error');
  }
  function preferenceStatus(message, iconName = 'circle-check') {
    const target = $('settingsPreferenceStatus');
    if (!target) return;
    const icon = window.LocalIcons ? window.LocalIcons.create(iconName, 14) : document.createElement('span');
    target.replaceChildren(icon, document.createTextNode(message));
  }
  function resetKeyEditor() {
    editingKeyId = null;
    $('keyProfileLabel').value = '';
    $('managedKeyValue').value = '';
    $('managedKeyValue').type = 'password';
    $('keyEditorTitle').textContent = 'Add a key profile';
    $('saveManagedKeyBtn').lastChild.textContent = 'Save profile';
    $('cancelEditKeyBtn').hidden = true;
    $('selectManagedKeyToggle').checked = true;
    keyStatus('Remembering keys is enabled by default.');
  }
  function saveManagedProfile() {
    const label = $('keyProfileLabel').value.trim();
    const key = $('managedKeyValue').value.trim();
    if (!label) { keyStatus('Enter a profile name first.', 'error'); $('keyProfileLabel').focus(); return; }
    if (key.length < 20 || key.length > 300) { keyStatus('Paste a valid Gemini API key (20–300 characters).', 'error'); $('managedKeyValue').focus(); return; }
    const conflict = profiles.find(p => p.label.toLocaleLowerCase() === label.toLocaleLowerCase() && p.id !== editingKeyId);
    if (conflict) { keyStatus('A profile with that name already exists. Choose a different name.', 'error'); return; }
    let profile = editingKeyId ? profileById(editingKeyId) : null;
    if (!profile) { profile = { id: newId(), label, key, updatedAt: new Date().toISOString() }; profiles.push(profile); }
    else { profile.label = label; profile.key = key; profile.updatedAt = new Date().toISOString(); }
    profiles = profiles.slice(-30);
    if (!persistProfiles()) { keyStatus('Browser storage is unavailable. The key was not saved.', 'error'); return; }
    if ($('selectManagedKeyToggle').checked) { renderProfileSelect(profile.id); showSelectedProfile(profile.id); }
    else renderProfileSelect($('savedKeySelect').value);
    renderKeyManager(); resetKeyEditor();
    keyStatus('Profile “' + label + '” saved in this browser.', 'success');
  }
  function saveKeyBeforeConnect() {
    const key = $('apiKey')?.value.trim() || '';
    if (!rememberEnabled() || key.length < 20 || key.length > 300) return;
    const selected = $('savedKeySelect').value;
    let existing = profileById(selected);
    if (!existing) existing = profiles.find(p => p.key === key);
    if (existing) {
      existing.key = key;
      existing.updatedAt = new Date().toISOString();
    } else {
      const label = profiles.length === 0 ? 'Default key' : 'Key ' + (profiles.length + 1);
      profiles.push({ id: newId(), label, key, updatedAt: new Date().toISOString() });
      existing = profiles[profiles.length - 1];
    }
    profiles = profiles.slice(-30);
    if (persistProfiles()) {
      renderProfileSelect(existing.id);
      try { localStorage.setItem(ACTIVE_KEY, existing.id); } catch {}
    } else {
      keyStatus('Browser storage is unavailable. This connection will use the key only for this session.', 'error');
    }
  }

  function setupMainLayout() {
    const layout = document.querySelector('.layout');
    const sidebar = document.querySelector('.sidebar');
    const workspace = document.querySelector('.workspace');
    const events = document.querySelector('.event-sidebar');
    if (!layout || !sidebar || !workspace || !events) return;
    const column = document.createElement('div');
    column.className = 'conversation-column';
    layout.insertBefore(column, sidebar);
    column.append(sidebar, workspace);
    const stage = document.createElement('section');
    stage.className = 'thinking-stage';
    stage.id = 'thinkingStage';
    stage.setAttribute('aria-label', 'Live audio activity');
    stage.innerHTML =
      '<div class="thinking-stage-top"><span class="eyebrow">LIVE PRESENCE</span><span class="orb-live-indicator"><i></i><span id="orbLiveLabel">STANDING BY</span></span></div>' +
      '<div class="orb-center">' +
        '<div class="thinking-orb" id="thinkingOrb">' +
          '<canvas class="orb-particle-canvas" id="orbParticleCanvas" role="button" tabindex="0" aria-label="Thinking Orb. Click or press Enter to send a ripple across its surface." title="Click to send a ripple across the Thinking Orb"></canvas>' +
        '</div>' +
      '</div>' +
      '<div class="thinking-caption"><p class="eyebrow">THINKING ORB</p><h2 id="orbTitle">A signal, taking shape.</h2><p id="orbStatus">Ready when you are</p></div>' +
      '<div class="orb-spectrum" id="orbSpectrum" aria-hidden="true">' +
        '<i class="spectrum-dot"></i><i class="spectrum-dot"></i><i class="spectrum-dot"></i><i class="spectrum-dot"></i><i class="spectrum-dot"></i><i class="spectrum-dot"></i><i class="spectrum-dot"></i><i class="spectrum-dot"></i><i class="spectrum-dot"></i><i class="spectrum-dot"></i><i class="spectrum-dot"></i><i class="spectrum-dot"></i><i class="spectrum-dot"></i><i class="spectrum-dot"></i><i class="spectrum-dot"></i><i class="spectrum-dot"></i><i class="spectrum-dot"></i>' +
      '</div>' +
      '<div class="orb-stage-foot"><span><i class="summary-dot accent"></i> AUDIO-REACTIVE</span><span id="orbModeLabel">AWAITING SIGNAL</span></div>';
    layout.appendChild(stage);
    events.classList.add('events-collapsed');
    const header = events.querySelector('.event-head');
    const clear = document.getElementById('clearEventsBtn');
    const count = document.getElementById('eventCount');
    if (header && clear && !document.getElementById('toggleEventsBtn')) {
      const titleWrap = header.querySelector('div');
      if (titleWrap && count) { count.classList.add('event-count-pill'); titleWrap.appendChild(count); }
      const toggle = document.createElement('button');
      toggle.id = 'toggleEventsBtn';
      toggle.type = 'button';
      toggle.className = 'icon-btn event-toggle-btn';
      toggle.setAttribute('aria-label', 'Expand session events');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.title = 'Expand session events';
      toggle.appendChild(window.LocalIcons ? window.LocalIcons.create('chevron-down', 14) : document.createTextNode('⌄'));
      header.insertBefore(toggle, clear);
      toggle.addEventListener('click', () => {
        const expanded = events.classList.toggle('events-open');
        events.classList.toggle('events-collapsed', !expanded);
        toggle.setAttribute('aria-expanded', String(expanded));
        toggle.setAttribute('aria-label', expanded ? 'Collapse session events' : 'Expand session events');
        toggle.title = expanded ? 'Collapse session events' : 'Expand session events';
        toggle.replaceChildren(window.LocalIcons ? window.LocalIcons.create(expanded ? 'chevron-up' : 'chevron-down', 14) : document.createTextNode(expanded ? '⌃' : '⌄'));
      });
    }
    const eventStackHost = document.getElementById('eventStackHost');
    if (eventStackHost && events.parentElement !== eventStackHost) eventStackHost.appendChild(events);
    const eventDialog = document.getElementById('sessionEventsDialog');
    const eventTrigger = document.getElementById('sessionEventsBtn');
    const closeEventDialog = document.getElementById('closeSessionEventsBtn');
    const openEventDialog = () => {
      if (!eventDialog || eventDialog.open) return;
      eventDialog.showModal();
      document.body.classList.add('event-stack-open');
      eventTrigger?.setAttribute('aria-expanded', 'true');
    };
    const closeEvents = () => {
      if (eventDialog?.open) eventDialog.close();
      document.body.classList.remove('event-stack-open');
      eventTrigger?.setAttribute('aria-expanded', 'false');
    };
    eventTrigger?.addEventListener('click', openEventDialog);
    closeEventDialog?.addEventListener('click', closeEvents);
    eventDialog?.addEventListener('close', () => {
      document.body.classList.remove('event-stack-open');
      eventTrigger?.setAttribute('aria-expanded', 'false');
    });
    eventDialog?.addEventListener('click', event => {
      if (event.target === eventDialog) closeEvents();
    });
  }
  function moveSettingsPanels() {
    const connectionPanel = document.querySelector('.api-panel');
    const connectionDestination = $('settingsPaneConnection');
    if (connectionPanel && connectionDestination) connectionDestination.appendChild(connectionPanel);
    const moves = [
      ['.setup-panel', 'settingsPaneVoice'],
      ['.advanced-panel', 'settingsPaneAudio'],
      ['.tools-panel', 'settingsPaneTools'],
      ['.raw-panel', 'settingsPaneExpert']
    ];
    moves.forEach(([selector, destinationId]) => {
      const element = document.querySelector(selector);
      const destination = $(destinationId);
      if (element && destination) destination.appendChild(element);
    });
    const footer = document.querySelector('.sidebar-footer');
    const connectionPane = $('settingsPaneConnection');
    if (footer && connectionPane) connectionPane.appendChild(footer);
  }
  function activateSettingsTab(tab) {
    if (!document.querySelector('[data-settings-tab="' + tab + '"]')) tab = 'connection';
    activeTab = tab;
    document.querySelectorAll('[data-settings-tab]').forEach(button => {
      const active = button.dataset.settingsTab === tab;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
      button.tabIndex = active ? 0 : -1;
    });
    document.querySelectorAll('[data-settings-pane]').forEach(pane => {
      const active = pane.dataset.settingsPane === tab;
      pane.hidden = !active;
      pane.classList.toggle('active', active);
    });
    if (tab === 'keys') renderKeyManager();
    const activeButton = document.querySelector('[data-settings-tab="' + tab + '"]');
    activeButton?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  function openSettings(tab = activeTab) {
    const dialog = $('settingsDialog');
    if (!dialog.open) dialog.showModal();
    activateSettingsTab(tab);
  }
  function closeSettings() { if ($('settingsDialog').open) $('settingsDialog').close(); }

  function isAcceptableApiKey(value) {
    const key = String(value || '').trim();
    return key.length >= 20 && key.length <= 300;
  }
  function syncRequiredKeyGate() {
    const input = $('requiredApiKey');
    const button = $('submitRequiredKey');
    const feedback = $('requiredKeyFeedback');
    if (!input || !button || !feedback) return;
    const key = input.value.trim();
    const valid = isAcceptableApiKey(key);
    button.disabled = !valid;
    input.setAttribute('aria-invalid', key && !valid ? 'true' : 'false');
    if (!key) {
      feedback.textContent = 'Enter your API key to unlock the studio.';
      feedback.classList.remove('is-ready', 'is-error');
    } else if (key.length < 20) {
      feedback.textContent = 'This key looks too short. Paste the complete API key.';
      feedback.classList.add('is-error');
      feedback.classList.remove('is-ready');
    } else if (key.length > 300) {
      feedback.textContent = 'This key is too long. Check that you copied only the API key.';
      feedback.classList.add('is-error');
      feedback.classList.remove('is-ready');
    } else {
      feedback.textContent = 'Key provided. Continue to configure your Live connection.';
      feedback.classList.add('is-ready');
      feedback.classList.remove('is-error');
    }
  }
  function showRequiredKeyGate() {
    const dialog = $('apiKeyGateDialog');
    if (!dialog) return;
    const select = $('requiredKeyProfileSelect');
    const wrap = $('requiredKeyProfileWrap');
    const currentKey = $('apiKey')?.value.trim() || '';
    select.replaceChildren();
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Select a saved key profile';
    select.appendChild(placeholder);
    profiles.forEach(profile => {
      const option = document.createElement('option');
      option.value = profile.id;
      option.textContent = profile.label;
      select.appendChild(option);
    });
    wrap.hidden = profiles.length === 0;
    const match = profiles.find(profile => profile.key === currentKey);
    select.value = match ? match.id : '';
    $('requiredApiKey').value = currentKey;
    $('requiredRememberKey').checked = rememberEnabled();
    syncRequiredKeyGate();
    if (!dialog.open) dialog.showModal();
    window.setTimeout(() => $('requiredApiKey').focus(), 50);
  }
  function continueWithRequiredKey() {
    const key = $('requiredApiKey').value.trim();
    if (!isAcceptableApiKey(key)) {
      syncRequiredKeyGate();
      $('requiredApiKey').focus();
      return;
    }
    const dialog = $('apiKeyGateDialog');
    const matchingProfile = profiles.find(profile => profile.key === key);
    $('apiKey').value = key;
    $('rememberKeyToggle').checked = $('requiredRememberKey').checked;
    try { localStorage.setItem(REMEMBER_PREF, String($('requiredRememberKey').checked)); } catch {}
    renderProfileSelect(matchingProfile ? matchingProfile.id : '');
    if ($('requiredRememberKey').checked) {
      saveKeyBeforeConnect();
    } else if (!matchingProfile) {
      try { localStorage.removeItem(ACTIVE_KEY); } catch {}
    }
    $('tokenState').textContent = 'Key ready · token requested on connect';
    $('apiKey').dispatchEvent(new Event('input', { bubbles: true }));
    if (dialog.open) dialog.close();
    openSettings('connection');
  }
  function initRequiredKeyGate() {
    const dialog = $('apiKeyGateDialog');
    const input = $('requiredApiKey');
    if (!dialog || !input) return;
    input.addEventListener('input', () => {
      const selected = profileById($('requiredKeyProfileSelect').value);
      if (selected && selected.key !== input.value.trim()) $('requiredKeyProfileSelect').value = '';
      syncRequiredKeyGate();
    });
    $('requiredKeyProfileSelect').addEventListener('change', () => {
      const profile = profileById($('requiredKeyProfileSelect').value);
      if (profile) input.value = profile.key;
      syncRequiredKeyGate();
    });
    $('toggleRequiredApiKey').addEventListener('click', () => {
      input.type = input.type === 'password' ? 'text' : 'password';
      $('toggleRequiredApiKey').replaceChildren(window.LocalIcons.create(input.type === 'password' ? 'eye' : 'eye-off', 16));
      $('toggleRequiredApiKey').setAttribute('aria-label', input.type === 'password' ? 'Show API key' : 'Hide API key');
    });
    $('submitRequiredKey').addEventListener('click', continueWithRequiredKey);
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        if (!$('submitRequiredKey').disabled) continueWithRequiredKey();
      }
    });
    dialog.addEventListener('cancel', event => event.preventDefault());
    dialog.addEventListener('click', event => {
      if (event.target === dialog) event.preventDefault();
    });
    if (!isAcceptableApiKey($('apiKey')?.value || '')) showRequiredKeyGate();
  }

  function hexRgb(hex) {
    const clean = String(hex || '#000000').replace('#', '');
    return { r: parseInt(clean.slice(0, 2), 16) || 0, g: parseInt(clean.slice(2, 4), 16) || 0, b: parseInt(clean.slice(4, 6), 16) || 0 };
  }
  function rgbHex(r, g, b) {
    return '#' + [r,g,b].map(v => Math.max(0, Math.min(255, Math.round(Number(v) || 0))).toString(16).padStart(2, '0')).join('');
  }
  function mixHex(a, b, amount) {
    const aa = hexRgb(a), bb = hexRgb(b);
    return rgbHex(aa.r * (1 - amount) + bb.r * amount, aa.g * (1 - amount) + bb.g * amount, aa.b * (1 - amount) + bb.b * amount);
  }
  function luminance(hex) {
    const c = hexRgb(hex);
    const linear = [c.r, c.g, c.b].map(v => { v /= 255; return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
    return .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2];
  }
  function syncRgbFields(prefix, hex) {
    const color = hex.toLowerCase();
    const rgb = hexRgb(color);
    $(prefix + 'Color').value = color;
    $(prefix + 'R').value = rgb.r; $(prefix + 'G').value = rgb.g; $(prefix + 'B').value = rgb.b;
    $(prefix + 'Hex').textContent = color.toUpperCase();
  }
  function readThemeControls() {
    return {
      preset: $('themePreset').value,
      background: $('themeBackgroundColor').value,
      surface: $('themeSurfaceColor').value,
      accent: $('themeAccentColor').value
    };
  }
  function applyTheme(theme, save = true) {
    const next = {
      preset: PRESETS[theme.preset] ? theme.preset : 'custom',
      background: /^#[0-9a-f]{6}$/i.test(theme.background || '') ? theme.background : DEFAULT_THEME.background,
      surface: /^#[0-9a-f]{6}$/i.test(theme.surface || '') ? theme.surface : DEFAULT_THEME.surface,
      accent: /^#[0-9a-f]{6}$/i.test(theme.accent || '') ? theme.accent : DEFAULT_THEME.accent
    };
    themeState = next;
    const root = document.documentElement;
    const light = luminance(next.background) > .48;
    const text = light ? '#202631' : '#f0f1f4';
    const muted = light ? '#68707d' : '#8d929d';
    root.style.setProperty('--bg', next.background);
    root.style.setProperty('--panel', next.surface);
    root.style.setProperty('--panel2', mixHex(next.surface, next.background, light ? .48 : .25));
    root.style.setProperty('--panel3', mixHex(next.surface, next.accent, light ? .07 : .05));
    root.style.setProperty('--border', mixHex(next.surface, text, light ? .16 : .14));
    root.style.setProperty('--border2', mixHex(next.surface, text, light ? .27 : .25));
    root.style.setProperty('--text', text);
    root.style.setProperty('--muted', muted);
    root.style.setProperty('--subtle', light ? '#838a96' : '#626975');
    root.style.setProperty('--accent', mixHex(next.accent, next.background, .15));
    root.style.setProperty('--accent2', next.accent);
    root.style.setProperty('--theme-color-scheme', light ? 'light' : 'dark');
    root.style.setProperty('--button-ink', luminance(next.accent) > .48 ? '#20232b' : '#f7f8fa');
    document.body.classList.add('theme-active');
    $('themePreview')?.style.setProperty('--preview-bg', next.background);
    $('themePreview')?.style.setProperty('--preview-surface', next.surface);
    $('themePreview')?.style.setProperty('--preview-accent', next.accent);
    if (save) {
      const ok = safeWrite(THEME_STORE, next);
      if ($('themeStatus')) $('themeStatus').textContent = ok ? 'Saved automatically on this browser.' : 'Browser storage unavailable; theme applies until reload.';
    }
  }
  function updateThemeUi(theme) {
    $('themePreset').value = PRESETS[theme.preset] ? theme.preset : 'custom';
    syncRgbFields('themeBackground', theme.background);
    syncRgbFields('themeSurface', theme.surface);
    syncRgbFields('themeAccent', theme.accent);
    applyTheme(theme, true);
  }
  function usePreset(name) {
    const preset = PRESETS[name];
    if (!preset) return;
    updateThemeUi({ preset: name, ...preset });
  }
  function wireColorGroup(prefix, property) {
    $(prefix + 'Color').addEventListener('input', () => {
      const state = readThemeControls();
      syncRgbFields(prefix, $(prefix + 'Color').value);
      $('themePreset').value = 'custom';
      state.preset = 'custom'; state[property] = $(prefix + 'Color').value;
      applyTheme(state);
    });
    ['R','G','B'].forEach(() => {});
    [prefix + 'R', prefix + 'G', prefix + 'B'].forEach(id => $(id).addEventListener('input', () => {
      const channel = id.endsWith('R') ? 0 : id.endsWith('G') ? 1 : 2;
      const vals = [Number($(prefix + 'R').value), Number($(prefix + 'G').value), Number($(prefix + 'B').value)].map(v => Math.max(0, Math.min(255, Number.isFinite(v) ? Math.round(v) : 0)));
      const hex = rgbHex(vals[0], vals[1], vals[2]);
      syncRgbFields(prefix, hex);
      $('themePreset').value = 'custom';
      const state = readThemeControls(); state.preset = 'custom'; state[property] = hex;
      applyTheme(state);
      $(id).focus({ preventScroll: true });
    }));
  }
  function initTheme() {
    wireColorGroup('themeBackground', 'background');
    wireColorGroup('themeSurface', 'surface');
    wireColorGroup('themeAccent', 'accent');
    $('themePreset').addEventListener('change', () => {
      if ($('themePreset').value === 'custom') {
        const current = readThemeControls(); current.preset = 'custom'; applyTheme(current);
      } else usePreset($('themePreset').value);
    });
    $('resetThemeBtn').addEventListener('click', () => usePreset('midnight'));
    const saved = safeRead(THEME_STORE, DEFAULT_THEME);
    const chosen = { ...DEFAULT_THEME, ...(saved && typeof saved === 'object' ? saved : {}) };
    const seed = PRESETS[chosen.preset] ? { ...PRESETS[chosen.preset], preset: chosen.preset } : chosen;
    updateThemeUi(seed);
  }

  function initKeys() {
    profiles = readProfiles();
    const rememberStored = (() => { try { return localStorage.getItem(REMEMBER_PREF); } catch { return null; } })();
    $('rememberKeyToggle').checked = rememberStored === null ? true : rememberStored !== 'false';
    $('rememberKeyToggle').addEventListener('change', () => {
      try { localStorage.setItem(REMEMBER_PREF, String($('rememberKeyToggle').checked)); } catch {}
    });
    let selectedId = '';
    try { selectedId = localStorage.getItem(ACTIVE_KEY) || ''; } catch {}
    if (!profileById(selectedId)) selectedId = profiles[0]?.id || '';
    renderProfileSelect(selectedId && $('rememberKeyToggle').checked ? selectedId : '');
    if (selectedId && $('rememberKeyToggle').checked) showSelectedProfile(selectedId);
    else { $('apiKey').value = ''; }
    $('savedKeySelect').addEventListener('change', () => {
      if ($('savedKeySelect').value) showSelectedProfile($('savedKeySelect').value);
      else { $('apiKey').value = ''; try { localStorage.removeItem(ACTIVE_KEY); } catch {} }
      renderKeyManager();
    });
    $('apiKey').addEventListener('input', () => {
      if ($('savedKeySelect').value && profileById($('savedKeySelect').value)?.key !== $('apiKey').value.trim()) {
        $('savedKeySelect').value = '';
      }
    });
    $('manageKeysBtn').addEventListener('click', () => openSettings('keys'));
    $('saveManagedKeyBtn').addEventListener('click', saveManagedProfile);
    $('cancelEditKeyBtn').addEventListener('click', resetKeyEditor);
    $('revealManagedKeyBtn').addEventListener('click', () => {
      const input = $('managedKeyValue'); input.type = input.type === 'password' ? 'text' : 'password';
      $('revealManagedKeyBtn').replaceChildren(window.LocalIcons.create(input.type === 'password' ? 'eye' : 'eye-off', 15));
      $('revealManagedKeyBtn').setAttribute('aria-label', input.type === 'password' ? 'Show API key' : 'Hide API key');
    });
    document.addEventListener('click', event => {
      if (!event.target.closest('#connectBtn')) return;
      if (!isAcceptableApiKey($('apiKey')?.value || '')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showRequiredKeyGate();
        return;
      }
      saveKeyBeforeConnect();
    }, true);
  }

  function wireSettings() {
    document.querySelectorAll('[data-settings-tab]').forEach(button => button.addEventListener('click', () => activateSettingsTab(button.dataset.settingsTab)));
    $('settingsBtn').addEventListener('click', () => openSettings('connection'));
    $('closeSettingsBtn').addEventListener('click', closeSettings);
    $('doneSettingsBtn').addEventListener('click', closeSettings);
    $('resetAllSettingsBtn').addEventListener('click', resetAllSettings);
    $('settingsDialog').addEventListener('click', event => { if (event.target === $('settingsDialog')) closeSettings(); });
    $('settingsDialog').addEventListener('keydown', event => {
      if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key) || !event.target.closest('.settings-tabs')) return;
      event.preventDefault();
      const tabs = [...document.querySelectorAll('[data-settings-tab]')];
      const current = tabs.findIndex(t => t.dataset.settingsTab === activeTab);
      const direction = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
      const next = tabs[(current + direction + tabs.length) % tabs.length];
      activateSettingsTab(next.dataset.settingsTab); next.focus();
    });
  }


  const SETTINGS_STORE = 'geminiLiveStudio.preferences.v1';
  let preferencesSaveHandle = 0;
  const NEVER_REMEMBER_IDS = new Set([
    'apiKey', 'managedKeyValue', 'keyProfileLabel', 'savedKeySelect',
    'rememberKeyToggle', 'localToolsToggle', 'localSkillSource', 'themePreset', 'themeBackgroundColor', 'themeSurfaceColor', 'themeAccentColor',
    'themeBackgroundR', 'themeBackgroundG', 'themeBackgroundB',
    'themeSurfaceR', 'themeSurfaceG', 'themeSurfaceB',
    'themeAccentR', 'themeAccentG', 'themeAccentB'
  ]);

  function preferenceElements() {
    return [...document.querySelectorAll(
      '.api-panel input, .api-panel select, .api-panel textarea, .settings-content input, .settings-content select, .settings-content textarea'
    )].filter(element =>
      element.id &&
      !NEVER_REMEMBER_IDS.has(element.id) &&
      !element.id.startsWith('theme') &&
      element.type !== 'password' &&
      element.type !== 'file' &&
      !['button','submit','reset'].includes(element.type)
    );
  }
  function saveAppSettings() {
    window.clearTimeout(preferencesSaveHandle);
    const values = {};
    preferenceElements().forEach(element => {
      values[element.id] = element.type === 'checkbox' ? element.checked : element.value;
    });
    const ok = safeWrite(SETTINGS_STORE, values);
    return ok;
  }
  function scheduleSaveAppSettings() {
    window.clearTimeout(preferencesSaveHandle);
    preferencesSaveHandle = window.setTimeout(() => {
      saveAppSettings();
    }, 160);
  }
  function initPreferences() {
    const values = safeRead(SETTINGS_STORE, {});
    if (values && typeof values === 'object' && !Array.isArray(values)) {
      preferenceElements().forEach(element => {
        if (!Object.prototype.hasOwnProperty.call(values, element.id)) return;
        const value = values[element.id];
        if (element.type === 'checkbox') element.checked = Boolean(value);
        else if (typeof value === 'string' && value.length < 30000) {
          if (element.tagName !== 'SELECT' || [...element.options].some(option => option.value === value)) element.value = value;
        }
      });
    }
    preferenceElements().forEach(element => {
      element.addEventListener('input', scheduleSaveAppSettings);
      element.addEventListener('change', saveAppSettings);
    });
    window.addEventListener('pagehide', saveAppSettings);
  }

  function resetAllSettings() {
    if (!$('disconnectBtn').disabled || $('connectBtn').disabled) {
      preferenceStatus('End the active or connecting Live session first.', 'circle-alert');
      return;
    }
    if (!confirm('Restore all studio settings to their original defaults? Saved API key profiles and this conversation will be kept.')) return;
    const currentKeyId = $('savedKeySelect').value;
    const currentKey = $('apiKey').value;
    preferenceElements().forEach(element => {
      if (element.type === 'checkbox') element.checked = element.defaultChecked;
      else if (element.tagName === 'SELECT') {
        const defaultIndex = [...element.options].findIndex(option => option.defaultSelected);
        element.selectedIndex = defaultIndex >= 0 ? defaultIndex : 0;
      } else element.value = element.defaultValue;
    });
    $('rememberKeyToggle').checked = true;
    try { localStorage.setItem(REMEMBER_PREF, 'true'); } catch {}
    renderProfileSelect(profileById(currentKeyId) ? currentKeyId : '');
    $('apiKey').value = currentKey;
    usePreset('midnight');
    preferenceElements().forEach(element => {
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    });
    saveAppSettings();
    resetKeyEditor();
    $('themeStatus').textContent = 'Default appearance restored.';
    activateSettingsTab('connection');
    preferenceStatus('Defaults restored · saved keys and transcript kept.', 'rotate-ccw');
    keyStatus('All studio settings restored to defaults. Saved API key profiles and the conversation were kept.', 'success');
  }


  setupMainLayout();
  moveSettingsPanels();
  initPreferences();
  initKeys();
  initRequiredKeyGate();
  initTheme();
  wireSettings();
  activateSettingsTab('connection');
  if (window.LocalIcons) window.LocalIcons.hydrate(document);
})();