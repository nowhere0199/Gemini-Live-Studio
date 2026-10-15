(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const state = {
    ws: null, apiKey: '', accessToken: '', model: 'gemini-3.8-live', setup: null,
    sessionResumeHandle: '', manualClose: false, reconnecting: false, connectedAt: 0,
    eventCount: 0, lastSetupText: '', transcript: [], nextMessageId: 1,
    activeInputTranscript: null, activeOutputTranscript: null, activeThought: null,
    audioContext: null, outputAnalyser: null, micAnalyser: null, micMonitorMute: null, outputSpectrum: null, micSpectrum: null, nextPlaybackTime: 0, playingSources: new Set(),
    currentOutputPcmChunks: [], currentOutputPcmBytes: 0, currentAudioCaptureTruncated: false, lastOutputPcmChunks: [], lastOutputPcmBytes: 0, lastAudioDiagnostics: null,
    audioPlaybackStats: { chunks: 0, schedulingGaps: 0, maxLateMs: 0, peak: 0, sampleCount: 0, nearClippedSamples: 0, seamJumps: 0 }, previousOutputTail: null, audioSchedulingQueue: Promise.resolve(), audioPlaybackGeneration: 0,
    micStream: null, micSource: null, micProcessor: null, micActive: false,
    cameraStream: null, cameraInterval: null, videoPlayback: null, videoInterval: null,
    audioFileAbort: null, activeModelTurn: false, currentTurnParts: 0,
    pendingTools: new Map(), lastInteractionStatus: 'IDLE', keepaliveTimer: null
  };

  const MODEL_LIVE = 'gemini-3.8-live';
  const MODEL_THINK = 'gemini-3.8-live-extended-thinking';
  const LOCAL_TOOL_NAMES = new Set(['list_local_cli_capabilities', 'list_available_skills', 'read_local_skill', 'run_approved_cli_check']);
  const VOICES = new Set(['Puck','Kore','Aoede','Charon','Fenrir','Leda','Orus','Zephyr','Achernar','Achird','Algenib','Algieba','Alnilam','Autonoe','Callirrhoe','Despina','Enceladus','Erinome','Gacrux','Iapetus','Laomedeia','Rasalgethi','Sadachbia','Sadaltager','Schedar','Sulafat','Umbriel','Vindemiatrix','Zubenelgenubi','Pulcherrima']);

  function stamp() {
    return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date());
  }
  function logEvent(title, detail = '', kind = 'info') {
    state.eventCount++;
    const row = document.createElement('div');
    row.className = 'event ' + kind;
    const marker = document.createElement('span'); marker.className = 'event-marker';
    const body = document.createElement('div'); body.className = 'event-content';
    const line = document.createElement('div'); line.className = 'event-topline';
    const name = document.createElement('span'); name.className = 'event-title'; name.textContent = title;
    const time = document.createElement('time'); time.className = 'event-time'; time.textContent = stamp();
    line.append(name, time); body.appendChild(line);
    if (detail) {
      const d = document.createElement('div'); d.className = 'event-detail'; d.textContent = detail; body.appendChild(d);
    }
    row.append(marker, body); $('eventLog').prepend(row);
    while ($('eventLog').children.length > 180) $('eventLog').lastElementChild.remove();
    $('eventCount').textContent = state.eventCount + ' events';
    const latest = $('headerLatestEvent');
    const headerCount = $('headerEventCount');
    if (latest) latest.textContent = String(title || 'Session event');
    if (headerCount) headerCount.textContent = String(state.eventCount);
    if (latest) latest.title = String(title || 'Session event') + (detail ? ' · ' + String(detail).replace(/\s+/g, ' ').slice(0, 200) : '');
  }
  function toast(message, kind = '') {
    const el = document.createElement('div'); el.className = 'toast ' + kind; el.textContent = message;
    $('toastRegion').appendChild(el); setTimeout(() => el.remove(), 5200);
  }
  function status(text, mode = 'off') {
    $('statusText').textContent = text;
    $('statusDot').className = 'status-dot' + (mode === 'online' ? ' online' : mode === 'busy' ? ' busy' : '');
  }
  function setInteractionStatus(v) {
    if (!v) return;
    state.lastInteractionStatus = v;
    const badge = $('interactionBadge');
    badge.textContent = String(v).replaceAll('_', ' ');
    badge.className = 'interaction-badge' + (v === 'IN_PROGRESS' ? ' thinking' : v === 'IDLE' ? ' active' : '');
    if (v === 'IN_PROGRESS') {
      $('bannerTitle').textContent = 'Gemini is reasoning in the background';
      $('bannerText').textContent = 'The model may still speak, call tools, or send additional output.';
      status('Thinking', 'busy');
    } else if (v === 'IDLE') {
      $('bannerTitle').textContent = 'Ready for the next turn';
      $('bannerText').textContent = 'The Live session remains open. Speak or send another message.';
      if (isConnected()) status('Connected', 'online');
    }
  }
  function isConnected() { return !!state.ws && state.ws.readyState === WebSocket.OPEN && state.setup !== null; }
  function sendWire(payload, label = 'message') {
    if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
      toast('Connect to a Live session first.', 'error'); return false;
    }
    try {
      state.ws.send(JSON.stringify(payload));
      if (label) logEvent('Sent ' + label, Object.keys(payload).join(', '), 'setup');
      return true;
    } catch (e) {
      logEvent('Send failed', String(e.message || e), 'error'); return false;
    }
  }
  function addMessage(role, text = '', options = {}) {
    const id = state.nextMessageId++;
    const node = document.createElement('article');
    node.className = 'message ' + role + (options.kind ? ' ' + options.kind : '');
    node.dataset.messageId = String(id);
    const meta = document.createElement('div'); meta.className = 'message-meta';
    const who = document.createElement('strong'); who.textContent = options.label || (role === 'user' ? 'You' : role === 'assistant' ? 'Gemini' : 'System');
    const time = document.createElement('time'); time.textContent = stamp();
    meta.append(who, time);
    const bubble = document.createElement('div'); bubble.className = 'message-bubble'; bubble.textContent = text;
    node.append(meta, bubble); $('conversation').appendChild(node);
    $('welcomeCard').hidden = true;
    $('conversation').scrollTop = $('conversation').scrollHeight;
    if (options.record !== false && text) state.transcript.push({ role, text, time: new Date().toISOString(), kind: options.kind || '' });
    return { id, node, bubble };
  }
  function updateMessage(id, text, append = true, recordRole = null, kind = '') {
    const node = $('conversation').querySelector('[data-message-id="' + id + '"]');
    if (!node) return;
    const bubble = node.querySelector('.message-bubble');
    bubble.textContent = append ? bubble.textContent + text : text;
    if (recordRole) {
      const key = id;
      let entry = state.transcript.find(x => x.id === key);
      if (!entry) { entry = { id: key, role: recordRole, text: '', time: new Date().toISOString(), kind }; state.transcript.push(entry); }
      entry.text = bubble.textContent;
    }
    $('conversation').scrollTop = $('conversation').scrollHeight;
  }
  function transcriptMessage(kind, text) {
    if (!text) return;
    const prop = kind === 'input' ? 'activeInputTranscript' : 'activeOutputTranscript';
    let currentId = state[prop];
    if (!currentId || !$('conversation').querySelector('[data-message-id="' + currentId + '"]')) {
      const m = addMessage(kind === 'input' ? 'user' : 'assistant', '', { kind: 'transcript', label: kind === 'input' ? 'Microphone transcription' : 'Gemini · speech transcript', record: false });
      currentId = m.id; state[prop] = currentId;
    }
    const node = $('conversation').querySelector('[data-message-id="' + currentId + '"]');
    const previous = node?.querySelector('.message-bubble')?.textContent || '';
    let chunk = String(text);
    // Live transcription arrives in small deltas; add a boundary when the API omits whitespace.
    if (previous && chunk && !/\\s$/.test(previous) && !/^\\s/.test(chunk) && !/^[,.;:!?…]/.test(chunk)) chunk = ' ' + chunk;
    updateMessage(currentId, chunk, true, kind === 'input' ? 'user' : 'assistant', 'transcript');
  }
  function endTranscript(kind) {
    const prop = kind === 'input' ? 'activeInputTranscript' : 'activeOutputTranscript';
    state[prop] = null;
  }
  function updateUsage(usage) {
    if (!usage) return;
    const input = usage.promptTokenCount ?? usage.totalInputTokenCount ?? null;
    const output = usage.responseTokenCount ?? usage.totalOutputTokenCount ?? null;
    const thoughts = usage.thoughtsTokenCount ?? null;
    const bits = [];
    if (input != null) bits.push('in ' + Number(input).toLocaleString());
    if (output != null) bits.push('out ' + Number(output).toLocaleString());
    if (thoughts != null) bits.push('thoughts ' + Number(thoughts).toLocaleString());
    if (bits.length) $('usageText').textContent = bits.join(' · ') + ' tokens';
  }
  function safeJson(text, label) {
    try {
      const parsed = JSON.parse(text || '{}');
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('Expected a JSON object.');
      return parsed;
    } catch (e) { throw new Error(label + ': ' + e.message); }
  }
  function getFunctionDeclarations() {
    const customEnabled = $('toolsToggle').checked;
    const localEnabled = Boolean($('localToolsToggle')?.checked);
    if (!customEnabled && !localEnabled) return [];
    const raw = customEnabled ? JSON.parse($('toolsJson').value || '[]') : [];
    if (!Array.isArray(raw)) throw new Error('Function declarations must be a JSON array.');
    if (raw.some(x => !x || typeof x.name !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(x.name) || typeof x.description !== 'string' || !x.parameters)) {
      throw new Error('Each function needs name, description, and parameters.');
    }
    const declarations = raw.map(x => structuredClone(x));
    if ($('localToolsToggle')?.checked) {
      declarations.push(
        {
          name: 'list_local_cli_capabilities',
          description: 'List locally installed CLI tools (Node.js, npm, Git, Python, Gemini CLI, Hermes, Claude Code, PowerShell and CMD). Read-only. Run only after user approval.',
          parameters: { type: 'OBJECT', properties: {}, required: [] }
        },
        {
          name: 'list_available_skills',
          description: 'List available local Agent Skills from one approved skill source. Read-only. Use source project, marketing, gemini-user or agents-user.',
          parameters: {
            type: 'OBJECT',
            properties: { source: { type: 'STRING', enum: ['project', 'marketing', 'gemini-user', 'agents-user'], description: 'Approved local skill source ID' } },
            required: ['source']
          }
        },
        {
          name: 'read_local_skill',
          description: 'Read one SKILL.md from an approved local skill source. The user must approve reading it and must review its contents before returning the result to the model.',
          parameters: {
            type: 'OBJECT',
            properties: {
              source: { type: 'STRING', enum: ['project', 'marketing', 'gemini-user', 'agents-user'], description: 'Approved local skill source ID' },
              name: { type: 'STRING', description: 'Skill folder slug from list_available_skills' }
            },
            required: ['source', 'name']
          }
        },
        {
          name: 'run_approved_cli_check',
          description: 'Run one explicitly allowlisted, read-only CLI/CMD check. Never use this to modify files, install packages or execute arbitrary shell commands.',
          parameters: {
            type: 'OBJECT',
            properties: {
              check: { type: 'STRING', enum: ['node-version', 'npm-version', 'git-version', 'python-version', 'cmd-version', 'powershell-version', 'gemini-version', 'gemini-skills-list', 'hermes-version', 'claude-version', 'project-js-syntax', 'project-git-status'], description: 'A fixed read-only check from the local allowlist' }
            },
            required: ['check']
          }
        }
      );
    }
    return declarations;
  }
  function buildSetup(resumeHandle = '') {
    const model = $('modelSelect').value;
    const voice = $('voiceSelect').value;
    if (!VOICES.has(voice)) throw new Error('Unknown voice selection.');
    const generationConfig = {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      temperature: Number($('temperature').value),
      topP: Number($('topP').value),
    };
    const topK = Number($('topK').value);
    const maxTokens = Number($('maxTokens').value);
    if (Number.isInteger(topK) && topK > 0) generationConfig.topK = topK;
    if (Number.isInteger(maxTokens) && maxTokens > 0) generationConfig.maxOutputTokens = maxTokens;

    const setup = {
      model: 'models/' + model,
      generationConfig,
      realtimeInputConfig: {
        automaticActivityDetection: {
          disabled: !$('vadToggle').checked,
          startOfSpeechSensitivity: $('startSensitivity').value,
          endOfSpeechSensitivity: $('endSensitivity').value,
          prefixPaddingMs: clamp(Number($('prefixPadding').value), 0, 1000, 40),
          silenceDurationMs: clamp(Number($('silenceDuration').value), 100, 5000, 650)
        }
      }
    };
    const systemText = $('systemInstruction').value.trim();
    if (systemText) setup.systemInstruction = { parts: [{ text: systemText }] };
    if ($('inputTranscriptToggle').checked) setup.inputAudioTranscription = {};
    if ($('outputTranscriptToggle').checked) setup.outputAudioTranscription = {};
    if ($('resumeToggle').checked) setup.sessionResumption = resumeHandle ? { handle: resumeHandle } : {};
    if ($('compressionToggle').checked) setup.contextWindowCompression = { slidingWindow: {} };

    if (model === MODEL_THINK) {
      setup.generationConfig.thinkingConfig = { thinkingLevel: $('thinkingLevel').value.toUpperCase(), includeThoughts: $('thoughtToggle').checked };
    }
    const resolution = $('mediaResolution').value;
    if (resolution) setup.generationConfig.mediaResolution = resolution;
    const declarations = getFunctionDeclarations();
    const tools = [];
    if ($('googleSearchToggle').checked) tools.push({ googleSearch: {} });
    if (declarations.length) tools.push({ functionDeclarations: declarations });
    if (tools.length) setup.tools = tools;

    const extra = safeJson($('extraConfig').value, 'Extra setup JSON');
    // Allow advanced model-specific fields but keep model, modality and UI-managed session controls coherent.
    Object.entries(extra).forEach(([key, value]) => {
      if (['model', 'sessionResumption', 'responseModalities', 'generationConfig'].includes(key)) return;
      if (key === 'thinkingConfig') {
        if (model === MODEL_LIVE) { logEvent('Ignored extra thinkingConfig', 'Thinking level is not supported by gemini-3.8-live.', 'warn'); return; }
        setup.generationConfig.thinkingConfig = value; return;
      }
      if (key === 'mediaResolution') { setup.generationConfig.mediaResolution = value; return; }
      setup[key] = value;
    });
    if (extra.generationConfig && typeof extra.generationConfig === 'object' && !Array.isArray(extra.generationConfig)) {
      Object.assign(setup.generationConfig, extra.generationConfig);
      setup.generationConfig.responseModalities = ['AUDIO'];
    }
    if (model === MODEL_LIVE) delete setup.generationConfig.thinkingConfig; else setup.generationConfig.thinkingConfig = { ...(setup.generationConfig.thinkingConfig || {}), thinkingLevel: $('thinkingLevel').value.toUpperCase(), includeThoughts: $('thoughtToggle').checked };
    if ($('resumeToggle').checked) setup.sessionResumption = resumeHandle ? { handle: resumeHandle } : {};
    else delete setup.sessionResumption;
    setup.model = 'models/' + model;
    setup.generationConfig.responseModalities = ['AUDIO'];
    return setup;
  }
  function clamp(v, min, max, fallback) { return Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback; }

  async function issueEphemeralToken(model) {
    const apiKey = $('apiKey').value.trim();
    if (!apiKey) throw new Error('Enter your Gemini API key first.');
    $('tokenState').textContent = 'Requesting one-use token…';
    const r = await fetch('/api/ephemeral-token', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ apiKey, model })
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.token) {
      const detail = data.message || data.error || ('HTTP ' + r.status);
      throw new Error('Could not issue a Live token: ' + detail);
    }
    state.apiKey = apiKey;
    state.accessToken = data.token;
    $('tokenState').textContent = 'One-use token · expires in ~30 min';
    logEvent('Ephemeral token issued', 'Model constrained; permanent API key stayed on localhost.', 'setup');
    return data.token;
  }
  async function ensureAudioContext() {
    if (!state.audioContext || state.audioContext.state === 'closed') {
      state.audioContext = new AudioContext();
      state.nextPlaybackTime = state.audioContext.currentTime + 0.075;
      state.outputAnalyser = null;
    }
    if (state.audioContext.state === 'suspended') await state.audioContext.resume();
    if (!state.outputAnalyser || state.outputAnalyser.context !== state.audioContext) {
      state.outputAnalyser = state.audioContext.createAnalyser();
      state.outputAnalyser.fftSize = 256;
      state.outputAnalyser.smoothingTimeConstant = 0.78;
      state.outputSpectrum = new Uint8Array(state.outputAnalyser.frequencyBinCount);
      state.outputAnalyser.connect(state.audioContext.destination);
    }
    return state.audioContext;
  }

  const ORB_PARTICLE_COUNT = 900;
  const orbPointCloud = {
    points: Array.from({ length: ORB_PARTICLE_COUNT }, (_, index) => {
      // Fibonacci-sphere sampling keeps particles evenly spread across the entire 3D surface.
      const y = 1 - 2 * ((index + 0.5) / ORB_PARTICLE_COUNT);
      const ring = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = index * Math.PI * (3 - Math.sqrt(5));
      return {
        x: Math.cos(theta) * ring,
        y,
        z: Math.sin(theta) * ring,
        phase: (index * 0.61803398875) % 1,
        band: Math.max(0, Math.min(1, 0.08 + Math.abs(y) * 0.58 + (Math.cos(theta) + 1) * 0.16))
      };
    }),
    canvas: null,
    context: null,
    width: 0,
    height: 0,
    dpr: 0,
    ripples: []
  };

  function orbHexRgb(value) {
    const match = String(value || '').trim().match(/^#?([0-9a-f]{6})$/i);
    if (!match) return { r: 215, g: 193, b: 155 };
    const hex = match[1];
    return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16) };
  }

  function createOrbRipple(canvas, clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    const radius = Math.min(rect.width, rect.height) * 0.455;
    const screenX = (clientX - rect.left - rect.width * 0.5) / radius;
    const screenY = (clientY - rect.top - rect.height * 0.5) / radius;
    const radialSquared = screenX * screenX + screenY * screenY;
    if (radialSquared > 1.12) return;
    const z2 = Math.sqrt(Math.max(0, 1 - Math.min(1, radialSquared)));
    const now = performance.now() * 0.001;
    const reducedMotion = Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const rotation = reducedMotion ? 0.18 : now * 0.48;
    const tilt = reducedMotion ? -0.28 : 0.10 + Math.sin(now * 0.47) * 0.42;
    const cosY = Math.cos(rotation);
    const sinY = Math.sin(rotation);
    const cosX = Math.cos(tilt);
    const sinX = Math.sin(tilt);
    // Invert the same Y rotation and X tilt used by drawParticleSphere so the source point stays on the rotating sphere.
    const y2 = screenY;
    const z1 = -y2 * sinX + z2 * cosX;
    const localY = y2 * cosX + z2 * sinX;
    const localX = screenX * cosY - z1 * sinY;
    const localZ = screenX * sinY + z1 * cosY;
    orbPointCloud.ripples.push({
      x: localX, y: localY, z: localZ,
      startedAt: performance.now(),
      id: (Math.random() * 0xFFFFFFF).toString(36)
    });
    if (orbPointCloud.ripples.length > 6) orbPointCloud.ripples.shift();
  }

  function drawParticleSphere(canvas, spectrum, energy, listening) {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(0, rect.width);
    const height = Math.max(0, rect.height);
    if (width < 2 || height < 2) return;

    if (!canvas.dataset.rippleReady) {
      canvas.dataset.rippleReady = 'true';
      canvas.addEventListener('pointerdown', event => {
        if (event.button !== 0 || !event.isPrimary) return;
        createOrbRipple(canvas, event.clientX, event.clientY);
      });
      canvas.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        const bounds = canvas.getBoundingClientRect();
        createOrbRipple(canvas, bounds.left + bounds.width * 0.5, bounds.top + bounds.height * 0.5);
      });
    }
    const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    if (orbPointCloud.canvas !== canvas) {
      orbPointCloud.canvas = canvas;
      orbPointCloud.context = canvas.getContext('2d', { alpha: true });
    }
    const ctx = orbPointCloud.context;
    if (!ctx) return;
    if (orbPointCloud.width !== width || orbPointCloud.height !== height || orbPointCloud.dpr !== dpr) {
      orbPointCloud.width = width;
      orbPointCloud.height = height;
      orbPointCloud.dpr = dpr;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const rootStyle = getComputedStyle(document.documentElement);
    const color = orbHexRgb(rootStyle.getPropertyValue(listening ? '--green' : '--accent2'));
    const now = performance.now() * 0.001;
    const reducedMotion = Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const rotation = reducedMotion ? 0.18 : now * 0.48;
    const tilt = reducedMotion ? -0.28 : 0.10 + Math.sin(now * 0.47) * 0.42;
    const cosY = Math.cos(rotation);
    const sinY = Math.sin(rotation);
    const cosX = Math.cos(tilt);
    const sinX = Math.sin(tilt);
    const cx = width * 0.5;
    const cy = height * 0.5;
    const radius = Math.min(width, height) * 0.455;
    const maxBin = spectrum ? Math.max(1, spectrum.length - 1) : 1;

    // Diffuse light makes the particle cloud read as a volume, not a flat filled disk.
    const glow = ctx.createRadialGradient(cx - radius * 0.23, cy - radius * 0.30, radius * 0.02, cx, cy, radius * 1.08);
    glow.addColorStop(0, `rgba(${color.r},${color.g},${color.b},${0.16 + energy * 0.14})`);
    glow.addColorStop(0.52, `rgba(${color.r},${color.g},${color.b},${0.075 + energy * 0.065})`);
    glow.addColorStop(1, `rgba(${color.r},${color.g},${color.b},0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.08, 0, Math.PI * 2);
    ctx.fill();

    const rippleTime = performance.now();
    orbPointCloud.ripples = orbPointCloud.ripples.filter(ripple => rippleTime - ripple.startedAt < 1450);
    const activeRipples = orbPointCloud.ripples;
    const projected = [];
    for (const point of orbPointCloud.points) {
      const x1 = point.x * cosY + point.z * sinY;
      const z1 = -point.x * sinY + point.z * cosY;
      const y2 = point.y * cosX - z1 * sinX;
      const z2 = point.y * sinX + z1 * cosX;
      const bin = Math.min(maxBin, Math.floor(point.band * maxBin));
      const localEnergy = spectrum ? (spectrum[bin] || 0) / 255 : 0;
      const subtleBreath = Math.sin(now * 1.35 + point.phase * Math.PI * 2) * 0.006;
      const radialPulse = 1 + energy * 0.052 + localEnergy * 0.032 + subtleBreath;
      const perspective = 1 / (1 - z2 * 0.21);
      const depth = (z2 + 1) * 0.5;
      let light = Math.max(0, -x1 * 0.28 - y2 * 0.50 + z2 * 0.86);
      let ripple = 0;
      for (const wave of activeRipples) {
        const age = (rippleTime - wave.startedAt) / 1000;
        const angle = Math.acos(Math.max(-1, Math.min(1, point.x * wave.x + point.y * wave.y + point.z * wave.z)));
        const front = age * 2.75;
        const band = Math.exp(-Math.pow((angle - front) / 0.115, 2));
        const echoFront = front - 0.34;
        const echo = echoFront > 0 ? 0.34 * Math.exp(-Math.pow((angle - echoFront) / 0.09, 2)) : 0;
        const envelope = Math.max(0, 1 - age / 1.45);
        ripple = Math.max(ripple, Math.min(1, (band + echo) * envelope));
      }
      projected.push({
        x: cx + x1 * radius * radialPulse * perspective,
        y: cy + y2 * radius * radialPulse * perspective,
        z: z2,
        depth,
        light: Math.min(1, light + ripple * 0.65),
        energy: Math.min(1, localEnergy + ripple * 0.9),
        ripple
      });
    }

    // Draw far-side particles first so nearer points naturally sit in front.
    projected.sort((a, b) => a.z - b.z);
    for (const dot of projected) {
      const depthLight = Math.pow(dot.depth, 1.9);
      const alpha = Math.min(1, 0.14 + depthLight * 0.43 + dot.light * 0.43 + dot.energy * 0.20 + energy * 0.08 + dot.ripple * 0.34);
      const size = 0.88 + dot.depth * 1.02 + dot.light * 1.00 + dot.energy * 0.96 + energy * 0.44 + dot.ripple * 1.55;
      const lift = Math.min(0.9, 0.10 + dot.light * 0.37 + dot.energy * 0.15 + dot.ripple * 0.58);
      const red = Math.min(255, Math.round(color.r + (255 - color.r) * lift));
      const green = Math.min(255, Math.round(color.g + (255 - color.g) * lift));
      const blue = Math.min(255, Math.round(color.b + (255 - color.b) * lift));
      ctx.fillStyle = `rgba(${red},${green},${blue},${alpha})`;
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, size * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function animateThinkingOrb() {
    const stage = $('thinkingStage');
    const orb = $('thinkingOrb');
    if (!stage || !orb) return;
    const dots = stage.querySelectorAll('.spectrum-dot');
    let outputEnergy = 0;
    let inputEnergy = 0;
    if (state.outputAnalyser && state.outputSpectrum) {
      state.outputAnalyser.getByteFrequencyData(state.outputSpectrum);
      const count = Math.min(42, state.outputSpectrum.length);
      for (let i = 0; i < count; i++) outputEnergy += state.outputSpectrum[i];
      outputEnergy = count ? outputEnergy / (count * 255) : 0;
    }
    if (state.micAnalyser && state.micSpectrum && state.micActive) {
      state.micAnalyser.getByteFrequencyData(state.micSpectrum);
      const count = Math.min(42, state.micSpectrum.length);
      for (let i = 0; i < count; i++) inputEnergy += state.micSpectrum[i];
      inputEnergy = count ? inputEnergy / (count * 255) : 0;
    }
    const energy = Math.min(1, Math.max(outputEnergy * 2.8, inputEnergy * 2.2));
    const listening = state.micActive;
    const speaking = state.activeModelTurn && outputEnergy > 0.012;
    orb.style.setProperty('--orb-scale', (1 + energy * 0.14).toFixed(3));
    orb.style.setProperty('--orb-energy', energy.toFixed(3));
    stage.style.setProperty('--orb-energy', energy.toFixed(3));
    stage.classList.toggle('is-listening', listening);
    stage.classList.toggle('is-speaking', speaking);
    const spectrum = (state.micActive && inputEnergy > outputEnergy) ? state.micSpectrum : state.outputSpectrum;
    const max = spectrum ? Math.max(1, spectrum.length - 1) : 1;
    dots.forEach((dot, index) => {
      const point = Math.min(max, Math.round(Math.pow((index + 1) / dots.length, 1.65) * max));
      const value = spectrum ? (spectrum[point] || 0) / 255 : 0;
      const idle = 0.65 + (Math.sin(performance.now() / 390 + index * 0.58) + 1) * 0.15;
      const scale = Math.min(1.85, idle + value * 1.25);
      dot.style.transform = 'scale(' + scale.toFixed(3) + ')';
      dot.style.opacity = String(Math.min(1, 0.36 + value * 1.8));
    });
    drawParticleSphere($('orbParticleCanvas'), spectrum, energy, listening);
    const live = isConnected();
    $('orbLiveLabel').textContent = listening ? 'LISTENING' : speaking ? 'RESPONDING' : live ? 'LIVE SESSION' : 'STANDING BY';
    $('orbStatus').textContent = listening ? 'Listening to your voice' : speaking ? 'Audio energy · live spectrum' : state.activeModelTurn ? 'Thinking through the response' : live ? 'Connected, ready for your next turn' : 'Ready when you are';
    $('orbTitle').textContent = listening ? 'I am listening.' : speaking ? 'A signal, taking shape.' : state.activeModelTurn ? 'Working through a thought.' : 'A signal, taking shape.';
    $('orbModeLabel').textContent = listening ? 'MIC INPUT' : speaking ? 'OUTPUT SPECTRUM' : live ? 'LIVE / READY' : 'AWAITING SIGNAL';
    window.requestAnimationFrame(animateThinkingOrb);
  }
  async function connectSession(isResume = false) {
    if (state.ws && (state.ws.readyState === WebSocket.OPEN || state.ws.readyState === WebSocket.CONNECTING)) {
      toast('A Live session is already open or connecting.'); return;
    }
    let model = $('modelSelect').value;
    try {
      state.model = model;
      const setupConfig = buildSetup(isResume ? state.sessionResumeHandle : '');
      await ensureAudioContext();
      status(isResume ? 'Resuming…' : 'Authorizing…', 'busy');
      $('connectBtn').disabled = true;
      $('disconnectBtn').disabled = true;
      $('micBtn').disabled = true;
      $('bannerTitle').textContent = isResume ? 'Resuming your Live session' : 'Preparing a secure Live session';
      $('bannerText').textContent = 'The local server is requesting a short-lived token from Gemini.';
      await issueEphemeralToken(model);
      state.manualClose = false;
      state.setup = setupConfig;
      state.activeModelTurn = false;
      state.lastInteractionStatus = 'IDLE';
      state.lastSetupText = JSON.stringify({ setup: setupConfig }, null, 2);
      logEvent('Setup payload ready', state.lastSetupText, 'setup');
      const token = state.accessToken;
      const url = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=' + encodeURIComponent(token);
      const ws = new WebSocket(url);
      state.ws = ws;
      $('latencyText').textContent = isResume ? 'Restoring context' : 'Opening WebSocket';
      ws.onopen = () => {
        if (state.ws !== ws) return;
        ws.send(JSON.stringify({ setup: setupConfig }));
        status('Awaiting setup…', 'busy');
        logEvent('WebSocket open', 'BidiGenerateContent v1beta · setup sent.', 'setup');
      };
      ws.onmessage = async (event) => {
        if (state.ws !== ws) return;
        let raw;
        try {
          if (typeof event.data === 'string') raw = event.data;
          else if (event.data instanceof Blob) raw = await event.data.text();
          else if (event.data instanceof ArrayBuffer) raw = new TextDecoder().decode(event.data);
          else throw new TypeError('Unsupported WebSocket message type: ' + Object.prototype.toString.call(event.data));
          if (state.ws !== ws) return;
          handleServerMessage(JSON.parse(raw));
        } catch (e) {
          const detail = (e && e.message ? e.message : String(e)) + (typeof raw === 'string' ? ': ' + raw.slice(0, 180) : '');
          logEvent('Invalid server message', detail, 'error');
        }
      };
      ws.onerror = () => {
        if (state.ws === ws) logEvent('WebSocket error', 'The connection failed. Check API key, model access, and network policy.', 'error');
      };
      ws.onclose = (event) => {
        if (state.ws !== ws) return;
        state.ws = null;
        stopMicrophone(false); stopCamera(false); stopVideoFrames(); stopAudioFile();
        $('connectBtn').disabled = false; $('disconnectBtn').disabled = true; $('micBtn').disabled = true;
        $('stopResponseBtn').disabled = true;
        if (!state.manualClose && $('resumeToggle').checked && state.sessionResumeHandle && !state.reconnecting) {
          logEvent('Connection closed', 'Code ' + event.code + (event.reason ? ' · ' + event.reason : '') + ' · attempting session resume.', 'warn');
          state.reconnecting = true;
          setTimeout(() => {
            state.reconnecting = false;
            if (!state.manualClose && !isConnected()) connectSession(true).catch(handleConnectError);
          }, 900);
        } else {
          status('Disconnected');
          $('latencyText').textContent = 'Session closed';
          $('bannerTitle').textContent = 'Session disconnected';
          $('bannerText').textContent = event.reason || 'Connect again to start a new Live session.';
          logEvent('WebSocket closed', 'Code ' + event.code + (event.reason ? ' · ' + event.reason : ''), event.code === 1000 ? 'info' : 'warn');
        }
      };
    } catch (e) {
      $('connectBtn').disabled = false; $('disconnectBtn').disabled = true; $('micBtn').disabled = true;
      status('Connection failed');
      $('bannerTitle').textContent = 'Could not start the session';
      $('bannerText').textContent = e.message || String(e);
      logEvent('Connection failed', e.message || String(e), 'error');
      toast(e.message || String(e), 'error');
    }
  }
  function handleConnectError(e) {
    state.reconnecting = false;
    $('connectBtn').disabled = false; $('disconnectBtn').disabled = true; $('micBtn').disabled = true;
    status('Connection failed'); logEvent('Reconnect failed', e.message || String(e), 'error'); toast(e.message || String(e), 'error');
  }
  function disconnectSession() {
    state.manualClose = true;
    state.reconnecting = false;
    stopMicrophone(true); stopCamera(true); stopVideoFrames(); stopAudioFile();
    stopPlayback();
    if (state.ws) {
      try { state.ws.close(1000, 'User ended session'); } catch {}
    }
    state.ws = null; state.setup = null; state.accessToken = '';
    $('connectBtn').disabled = false; $('disconnectBtn').disabled = true; $('micBtn').disabled = true;
    $('stopResponseBtn').disabled = true;
    status('Disconnected'); $('latencyText').textContent = 'Ready when you are'; $('tokenState').textContent = 'No active token';
    $('bannerTitle').textContent = 'Session ended'; $('bannerText').textContent = 'Your visible transcript remains here until cleared or exported.';
    logEvent('Session ended', 'Closed by operator.', 'info');
  }
  function handleServerMessage(msg) {
    if (msg.setupComplete) {
      status('Connected', 'online');
      $('latencyText').textContent = 'Live · ' + stamp();
      $('connectBtn').disabled = true; $('disconnectBtn').disabled = false; $('micBtn').disabled = false;
      $('bannerTitle').textContent = 'Live session connected';
      $('bannerText').textContent = 'Microphone audio streams to Gemini in real time. You can also send text, images, or video frames.';
      $('activeModelLabel').textContent = state.model === MODEL_THINK ? 'Gemini 3.8 · Extended Thinking' : 'Gemini 3.8 Live';
      $('sessionTimer').textContent = 'Session active';
      $('usageText').textContent = 'Audio stream ready';
      setInteractionStatus('IDLE');
      logEvent('Setup complete', 'The server accepted the session configuration.', 'ok');
      toast('Live session connected.', 'success');
      return;
    }
    if (msg.setupError) {
      const detail = msg.setupError.message || JSON.stringify(msg.setupError);
      logEvent('Setup rejected', detail, 'error');
      toast('Gemini rejected the setup: ' + detail, 'error');
      status('Setup rejected');
      if (state.ws) { state.manualClose = true; state.ws.close(1000, 'Setup rejected'); }
      return;
    }
    if (msg.sessionResumptionUpdate) {
      const u = msg.sessionResumptionUpdate;
      if (u.resumable && u.newHandle) {
        state.sessionResumeHandle = u.newHandle;
        logEvent('Session resumable', 'Latest resume handle received and held in memory.', 'ok');
      }
    }
    if (msg.goAway) {
      logEvent('Server GoAway', 'Connection will close soon. Time left: ' + String(msg.goAway.timeLeft || 'unknown'), 'warn');
      $('bannerTitle').textContent = 'Preparing session resumption';
      $('bannerText').textContent = 'Gemini is rotating the connection; the app will attempt to resume the same session.';
    }
    if (msg.toolCall) handleToolCalls(msg.toolCall);
    if (msg.toolCallCancellation) {
      const ids = msg.toolCallCancellation.ids || [];
      ids.forEach(id => {
        const card = $('toolCallList').querySelector('[data-call-id="' + CSS.escape(id) + '"]');
        if (card) { card.classList.add('cancelled'); const label = card.querySelector('.tool-call-state'); if (label) label.textContent = 'Cancelled by model'; }
        state.pendingTools.delete(id);
      });
      logEvent('Tool calls cancelled', ids.join(', '), 'warn');
    }
    if (msg.usageMetadata) updateUsage(msg.usageMetadata);
    const c = msg.serverContent;
    if (!c) {
      const statusValue = msg.interactionStatus || msg.interaction_status;
      if (statusValue) setInteractionStatus(statusValue);
      if (msg.error) logEvent('API error', msg.error.message || JSON.stringify(msg.error), 'error');
      return;
    }
    if (c.interrupted) {
      state.audioSchedulingQueue.then(() => finishAudioCapture('interrupted')).catch(() => {});
      stopPlayback();
      logEvent('Output interrupted', 'Cleared queued audio so a new user turn can take over.', 'warn');
      $('bannerTitle').textContent = 'Gemini was interrupted';
      $('bannerText').textContent = 'You can continue speaking or send another message.';
    }
    if (c.inputTranscription && c.inputTranscription.text) {
      transcriptMessage('input', c.inputTranscription.text);
      if (c.inputTranscription.finished) endTranscript('input');
    }
    if (c.outputTranscription && c.outputTranscription.text) {
      transcriptMessage('output', c.outputTranscription.text);
      if (c.outputTranscription.finished) endTranscript('output');
    }
    const parts = c.modelTurn && c.modelTurn.parts ? c.modelTurn.parts : [];
    parts.forEach(part => {
      if (part.inlineData && /^audio\/pcm/i.test(part.inlineData.mimeType || '')) playPcmChunk(part.inlineData.data);
      if (part.inlineData && /^image\//i.test(part.inlineData.mimeType || '')) logEvent('Model image part', part.inlineData.mimeType, 'info');
      if (part.text && !part.inlineData) {
        if (part.thought) showThoughtSummary(part.text);
        else appendModelText(part.text);
      }
    });
    if (c.turnComplete) state.audioSchedulingQueue.then(() => finishAudioCapture('turn complete')).catch(() => {});
    if (c.generationComplete) {
      state.audioSchedulingQueue.then(() => finishAudioCapture('generation complete')).catch(() => {});
      state.activeModelTurn = false;
      logEvent('Generation complete', 'Generation has ended for this output.', 'ok');
    }
    if (c.turnComplete) {
      // Close the user's active transcript utterance before the next speech turn begins.
      endTranscript('input');
      if (state.model === MODEL_LIVE) {
        state.activeModelTurn = false; endTranscript('output');
        $('stopResponseBtn').disabled = true; $('bannerTitle').textContent = 'Turn complete';
        $('bannerText').textContent = 'Ready for the next message or voice input.';
      } else if ((msg.interactionStatus || msg.interaction_status || c.interactionStatus || c.interaction_status) === 'IDLE') {
        state.activeModelTurn = false; endTranscript('output'); $('stopResponseBtn').disabled = true;
      }
    }
    const interaction = msg.interactionStatus || msg.interaction_status || c.interactionStatus || c.interaction_status;
    if (interaction) setInteractionStatus(interaction);
    if (c.turnComplete && !interaction && state.model === MODEL_LIVE) setInteractionStatus('IDLE');
  }
  function appendModelText(text) {
    if (!text) return;
    if (!state.activeOutputTranscript) {
      const m = addMessage('assistant', '', { label: 'Gemini', record: false });
      state.activeOutputTranscript = m.id;
    }
    updateMessage(state.activeOutputTranscript, text, true, 'assistant');
  }
  function showThoughtSummary(text) {
    if (!text) return;
    if (!state.activeThought) {
      const m = addMessage('assistant', '', { label: 'Thought summary', kind: 'thought', record: false });
      state.activeThought = m.id;
    }
    updateMessage(state.activeThought, text, true, 'assistant', 'thought');
    logEvent('Thought summary', text.slice(0, 120), 'warn');
  }

  function handleToolCalls(payload) {
    const calls = payload.functionCalls || [];
    if (!calls.length) return;
    $('toolCalls').hidden = false;
    calls.forEach(call => {
      if (!call.id || !call.name) return;
      state.pendingTools.set(call.id, call);
      const local = LOCAL_TOOL_NAMES.has(call.name);
      const card = document.createElement('div');
      card.className = 'tool-call-card' + (local ? ' local-tool-pending' : '');
      card.dataset.callId = call.id;
      const head = document.createElement('h3'); head.textContent = call.name + ' · ' + call.id;
      const pre = document.createElement('pre'); pre.textContent = JSON.stringify(call.args || {}, null, 2);
      const area = document.createElement('textarea'); area.rows = 4; area.setAttribute('aria-label', 'Tool response JSON');
      area.value = JSON.stringify({ output: { result: local ? 'Run the read-only tool, review its output, then choose Return result.' : 'Add the tool result here.' } }, null, 2);
      const actions = document.createElement('div'); actions.className = 'tool-call-actions';
      const stateLabel = document.createElement('span'); stateLabel.className = 'field-note tool-call-state';
      stateLabel.textContent = local ? 'Local execution requires opt-in · not run yet' : 'Waiting for manual response';
      const send = document.createElement('button'); send.className = 'btn btn-primary'; send.textContent = 'Return result';
      send.addEventListener('click', () => {
        try {
          const response = safeJson(area.value, 'Tool response');
          const ok = sendWire({ toolResponse: { functionResponses: [{ id: call.id, name: call.name, response }] } }, 'tool response');
          if (ok) {
            state.pendingTools.delete(call.id); send.disabled = true; area.disabled = true;
            stateLabel.textContent = 'Response sent'; logEvent('Tool response sent', call.name, 'ok');
          }
        } catch (e) { toast(e.message, 'error'); }
      });
      if (local) {
        const runLocal = document.createElement('button');
        runLocal.type = 'button'; runLocal.className = 'btn btn-secondary run-local-tool';
        runLocal.textContent = 'Run approved local tool';
        runLocal.disabled = !$('localToolsToggle')?.checked;
        runLocal.title = 'Read-only allowlisted action. Its result will not be returned to Gemini until you review it.';
        runLocal.addEventListener('click', async () => {
          if (!$('localToolsToggle')?.checked) {
            toast('Enable approved local tools in Settings → Tools first.', 'error');
            return;
          }
          runLocal.disabled = true;
          stateLabel.textContent = 'Running approved read-only operation…';
          try {
            const args = call.args || {};
            const request = { name: call.name };
            if (call.name === 'list_available_skills') request.source = args.source;
            if (call.name === 'read_local_skill') { request.source = args.source; request.nameArg = args.name; }
            if (call.name === 'run_approved_cli_check') request.check = args.check;
            const response = await fetch('/api/local-tool', {
              method: 'POST',
              credentials: 'same-origin',
              cache: 'no-store',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(request)
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.ok) throw new Error(data.message || data.error || ('Local tool HTTP ' + response.status));
            area.value = JSON.stringify(data.result, null, 2).slice(0, 48000);
            area.disabled = false; send.disabled = false;
            stateLabel.textContent = 'Local result ready for review · not sent yet';
            card.classList.remove('local-tool-pending'); card.classList.add('local-tool-ready');
            logEvent('Local tool completed', call.name + ' · awaiting operator review', 'ok');
          } catch (error) {
            stateLabel.textContent = 'Local operation failed · manual result still available';
            toast(error.message || String(error), 'error');
            logEvent('Local tool failed', call.name + ' · ' + String(error.message || error), 'error');
          } finally {
            runLocal.disabled = false;
          }
        });
        actions.appendChild(runLocal);
      }
      actions.append(stateLabel, send); card.append(head, pre, area, actions); $('toolCallList').prepend(card);
      logEvent('Function call requested', call.name + '\n' + JSON.stringify(call.args || {}), 'warn');
    });
  }

  function finishAudioCapture(reason = 'turn complete') {
    if (!state.currentOutputPcmChunks.length || !state.currentOutputPcmBytes) return;
    const stats = { ...state.audioPlaybackStats };
    state.lastOutputPcmChunks = state.currentOutputPcmChunks.slice();
    state.lastOutputPcmBytes = state.currentOutputPcmBytes;
    state.lastAudioDiagnostics = {
      ...stats,
      bytes: state.currentOutputPcmBytes,
      capturedChunks: state.currentOutputPcmChunks.length,
      truncated: state.currentAudioCaptureTruncated,
      durationSeconds: Number((stats.sampleCount / 24000).toFixed(2)),
      reason
    };
    const nearClipPct = stats.sampleCount ? (100 * stats.nearClippedSamples / stats.sampleCount).toFixed(3) : '0';
    const detail = [
      'Received PCM: mono · signed 16-bit little-endian · 24 kHz · ' + state.lastAudioDiagnostics.durationSeconds + ' s',
      'chunks ' + stats.chunks + ' · scheduling gaps ' + stats.schedulingGaps + ' · max late ' + stats.maxLateMs.toFixed(1) + ' ms · seam jumps >0.75 ' + (stats.seamJumps || 0),
      'peak ' + stats.peak.toFixed(4) + ' · near-clipped samples ' + nearClipPct + '%' + (state.currentAudioCaptureTruncated ? ' · capture truncated at 16 MB' : ''),
      'Source: raw PCM received from Gemini; no filtering/normalization'
    ].join('\n');
    logEvent('Audio output diagnostics', detail, stats.schedulingGaps || stats.seamJumps ? 'warn' : 'info');
    if ($('audioDiagnosticsStatus')) $('audioDiagnosticsStatus').textContent = detail.replace(/\n/g, ' · ');
    if ($('exportLastAudioBtn')) $('exportLastAudioBtn').disabled = false;
    state.currentOutputPcmChunks = [];
    state.currentOutputPcmBytes = 0;
    state.currentAudioCaptureTruncated = false;
    state.audioPlaybackStats = { chunks: 0, schedulingGaps: 0, maxLateMs: 0, peak: 0, sampleCount: 0, nearClippedSamples: 0, seamJumps: 0 };
    state.previousOutputTail = null;
  }

  function exportLastAudioCapture() {
    if (!state.lastOutputPcmChunks.length || !state.lastOutputPcmBytes) {
      toast('No model audio has been captured yet.', 'error');
      return;
    }
    const dataBytes = state.lastOutputPcmBytes;
    const header = new ArrayBuffer(44);
    const view = new DataView(header);
    const writeText = (offset, value) => {
      for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
    };
    writeText(0, 'RIFF');
    view.setUint32(4, 36 + dataBytes, true);
    writeText(8, 'WAVE');
    writeText(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, 24000, true);
    view.setUint32(28, 48000, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeText(36, 'data');
    view.setUint32(40, dataBytes, true);
    const blob = new Blob([header, ...state.lastOutputPcmChunks], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'gemini-live-output-24khz-' + new Date().toISOString().replace(/[:.]/g, '-') + '.wav';
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast('Exported the exact PCM received from Gemini as WAV. No filtering or normalization was applied.', 'success');
  }

  function playPcmChunk(base64) {
    if (!base64) return;
    try {
      const bytes = base64ToBytes(base64);
      const usable = bytes.length - (bytes.length % 2);
      if (usable < 2) return;
      const raw = bytes.slice(0, usable);
      if (!state.currentOutputPcmChunks.length) {
        state.audioPlaybackStats = { chunks: 0, schedulingGaps: 0, maxLateMs: 0, peak: 0, sampleCount: 0, nearClippedSamples: 0, seamJumps: 0 };
        state.previousOutputTail = null;
      }
      const captureLimit = 16 * 1024 * 1024;
      if (state.currentOutputPcmBytes < captureLimit) {
        const allowed = Math.min(raw.byteLength, captureLimit - state.currentOutputPcmBytes);
        if (allowed > 0) {
          state.currentOutputPcmChunks.push(raw.slice(0, allowed));
          state.currentOutputPcmBytes += allowed;
        }
        if (allowed < raw.byteLength) state.currentAudioCaptureTruncated = true;
      } else {
        state.currentAudioCaptureTruncated = true;
      }

      const data = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
      const floats = new Float32Array(raw.byteLength / 2);
      const stats = state.audioPlaybackStats;
      let peak = 0;
      let clipped = 0;
      for (let i = 0; i < floats.length; i++) {
        const sample = data.getInt16(i * 2, true) / 32768;
        floats[i] = sample;
        const magnitude = Math.abs(sample);
        if (magnitude > peak) peak = magnitude;
        if (magnitude >= 0.995) clipped++;
      }
      stats.chunks++;
      stats.sampleCount += floats.length;
      stats.nearClippedSamples += clipped;
      stats.peak = Math.max(stats.peak, peak);

      if (state.previousOutputTail !== null && Math.abs(floats[0] - state.previousOutputTail) > 0.75) stats.seamJumps++;
      state.previousOutputTail = floats[floats.length - 1];

      const playbackGeneration = state.audioPlaybackGeneration;
      state.audioSchedulingQueue = state.audioSchedulingQueue.catch(() => {}).then(async () => {
        const ctx = await ensureAudioContext();
        if (playbackGeneration !== state.audioPlaybackGeneration || !floats.length) return;
        const buffer = ctx.createBuffer(1, floats.length, 24000);
        const now = ctx.currentTime;
        let startAt = state.nextPlaybackTime;
        const latenessMs = Math.max(0, (now - startAt) * 1000);
        if (latenessMs > 2) {
          stats.schedulingGaps++;
          stats.maxLateMs = Math.max(stats.maxLateMs, latenessMs);
          // Place the next chunk slightly ahead and soften its first 2 ms to suppress a click.
          startAt = now + 0.004;
          const rampSamples = Math.min(48, floats.length);
          for (let i = 0; i < rampSamples; i++) {
            floats[i] *= (i + 1) / rampSamples;
          }
        } else if (startAt < now + 0.004) {
          startAt = now + 0.004;
        }
        buffer.copyToChannel(floats, 0);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(state.outputAnalyser || ctx.destination);
        source.start(startAt);
        state.nextPlaybackTime = startAt + buffer.duration;
        state.playingSources.add(source);
        source.onended = () => state.playingSources.delete(source);
        state.activeModelTurn = true;
        $('stopResponseBtn').disabled = false;
      }).catch(error => logEvent('Audio playback failed', String(error.message || error), 'error'));
    } catch (error) {
      logEvent('Audio decode failed', String(error.message || error), 'error');
    }
  }
  function stopPlayback() {
    state.audioPlaybackGeneration++;
    for (const source of state.playingSources) { try { source.stop(); } catch {} }
    state.playingSources.clear();
    if (state.audioContext) state.nextPlaybackTime = state.audioContext.currentTime + 0.03;
  }
  function sendText() {
    const text = $('messageInput').value.trim();
    if (!text || !isConnected()) { if (!isConnected()) toast('Connect a Live session first.', 'error'); return; }
    stopPlayback();
    state.activeModelTurn = true; $('stopResponseBtn').disabled = false;
    addMessage('user', text);
    const sent = sendWire({ clientContent: { turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true } }, 'text turn');
    if (sent) { $('messageInput').value = ''; autoResizeComposer(); state.activeOutputTranscript = null; }
  }

  function base64ToBytes(base64) {
    const bin = atob(base64); const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  function bytesToBase64(bytes) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    return btoa(binary);
  }
  function floatToPcm16(float32) {
    const out = new Uint8Array(float32.length * 2);
    const view = new DataView(out.buffer);
    for (let i = 0; i < float32.length; i++) {
      let s = Math.max(-1, Math.min(1, float32[i]));
      view.setInt16(i * 2, s < 0 ? s * 32768 : s * 32767, true);
    }
    return out;
  }
  function downsampleMono(channels, inputRate, targetRate = 16000) {
    if (!channels.length || !channels[0].length) return new Float32Array(0);
    const length = channels[0].length;
    const mono = new Float32Array(length);
    for (let ch = 0; ch < channels.length; ch++) {
      const samples = channels[ch];
      for (let i = 0; i < length; i++) mono[i] += samples[i] / channels.length;
    }
    if (inputRate === targetRate) return mono;
    const outLength = Math.max(1, Math.floor(mono.length * targetRate / inputRate));
    const out = new Float32Array(outLength);
    const ratio = inputRate / targetRate;
    for (let i = 0; i < outLength; i++) {
      const index = i * ratio, left = Math.floor(index), right = Math.min(left + 1, mono.length - 1);
      out[i] = mono[left] + (mono[right] - mono[left]) * (index - left);
    }
    return out;
  }
  async function startMicrophone() {
    if (!isConnected() || state.micActive) return;
    try {
      await ensureAudioContext();
      state.micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      state.micSource = state.audioContext.createMediaStreamSource(state.micStream);
      state.micAnalyser = state.audioContext.createAnalyser();
      state.micAnalyser.fftSize = 256;
      state.micAnalyser.smoothingTimeConstant = 0.72;
      state.micSpectrum = new Uint8Array(state.micAnalyser.frequencyBinCount);
      state.micSource.connect(state.micAnalyser);
      state.micMonitorMute = state.audioContext.createGain();
      state.micMonitorMute.gain.value = 0;
      state.micAnalyser.connect(state.micMonitorMute);
      state.micMonitorMute.connect(state.audioContext.destination);
      state.micProcessor = state.audioContext.createScriptProcessor(4096, 1, 1);
      state.micProcessor.onaudioprocess = e => {
        if (!state.micActive || !isConnected()) return;
        const ch = [];
        for (let i = 0; i < e.inputBuffer.numberOfChannels; i++) ch.push(e.inputBuffer.getChannelData(i));
        const mono = downsampleMono(ch, e.inputBuffer.sampleRate, 16000);
        if (mono.length) sendWire({ realtimeInput: { audio: { data: bytesToBase64(floatToPcm16(mono)), mimeType: 'audio/pcm;rate=16000' } } }, '');
        const out = e.outputBuffer.getChannelData(0); out.fill(0);
      };
      state.micActive = true;
      if (!$('vadToggle').checked) sendWire({ realtimeInput: { activityStart: {} } }, 'activity start');
      state.micSource.connect(state.micProcessor); state.micProcessor.connect(state.audioContext.destination);
      $('micBtn').classList.add('recording'); $('micBtnText').textContent = 'Stop microphone'; $('micHint').textContent = 'Microphone live'; $('micHint').style.color = 'var(--red)';
      $('bannerTitle').textContent = 'Listening to your microphone';
      $('bannerText').textContent = 'Speak naturally. Voice activity detection is ' + ($('vadToggle').checked ? 'managed by Gemini.' : 'manual; stopping the mic closes the turn.');
      logEvent('Microphone started', 'Echo cancellation and noise suppression enabled; input is converted to mono PCM 16 kHz.', 'ok');
    } catch (e) {
      stopMicrophone(false); toast('Could not start microphone: ' + (e.message || e), 'error'); logEvent('Microphone failed', String(e.message || e), 'error');
    }
  }
  function stopMicrophone(sendEnd = true) {
    if (state.micActive && sendEnd && isConnected()) {
      if ($('vadToggle').checked) sendWire({ realtimeInput: { audioStreamEnd: true } }, 'audio stream end');
      else sendWire({ realtimeInput: { activityEnd: {} } }, 'activity end');
    }
    state.micActive = false;
    if (state.micProcessor) { state.micProcessor.onaudioprocess = null; try { state.micProcessor.disconnect(); } catch {} state.micProcessor = null; }
    if (state.micSource) { try { state.micSource.disconnect(); } catch {} state.micSource = null; }
    if (state.micAnalyser) { try { state.micAnalyser.disconnect(); } catch {} state.micAnalyser = null; state.micSpectrum = null; }
    if (state.micMonitorMute) { try { state.micMonitorMute.disconnect(); } catch {} state.micMonitorMute = null; }
    if (state.micStream) { state.micStream.getTracks().forEach(t => t.stop()); state.micStream = null; }
    $('micBtn').classList.remove('recording'); $('micBtnText').textContent = 'Start microphone'; $('micHint').textContent = 'Mic off'; $('micHint').style.color = '';
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read file.'));
      reader.onload = () => resolve(bytesToBase64(new Uint8Array(reader.result)));
      reader.readAsArrayBuffer(file);
    });
  }
  function addAttachment(label, previewUrl = '') {
    const row = document.createElement('div'); row.className = 'attachment';
    if (previewUrl) { const img = document.createElement('img'); img.src = previewUrl; img.alt = ''; row.appendChild(img); }
    const text = document.createElement('span'); text.textContent = label; row.appendChild(text);
    $('attachmentTray').hidden = false; $('attachmentTray').appendChild(row);
  }
  async function sendImageFile(file) {
    if (!isConnected()) throw new Error('Connect a Live session first.');
    if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');
    if (file.size > 15 * 1024 * 1024) throw new Error('Image is larger than 15 MB.');
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1536 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d', { alpha: false }).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.86));
    if (!blob) throw new Error('Could not encode the image as JPEG.');
    const data = await fileToBase64(blob);
    if (!sendWire({ realtimeInput: { video: { data, mimeType: 'image/jpeg' } } }, 'image frame')) return;
    addMessage('user', 'Sent image: ' + file.name + ' (' + canvas.width + ' × ' + canvas.height + ' JPEG)');
    addAttachment(file.name, URL.createObjectURL(file));
    sendWire({ realtimeInput: { text: 'Please inspect the image I just sent. Describe the relevant details and ask a clarifying question if needed.' } }, 'image prompt');
    logEvent('Image sent', file.name + ' · normalized to JPEG for Live API.', 'ok');
  }
  async function startCamera() {
    if (!isConnected()) { toast('Connect a session first.', 'error'); return; }
    if (state.cameraStream) return;
    try {
      state.cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      $('cameraPreview').srcObject = state.cameraStream;
      await $('cameraPreview').play();
      $('cameraDrawer').hidden = false; $('cameraStartBtn').disabled = true; $('cameraStopBtn').disabled = false;
      $('cameraStatus').textContent = 'Sharing at up to 1 frame per second';
      state.cameraInterval = setInterval(() => {
        if (!isConnected() || !$('cameraPreview').videoWidth) return;
        const canvas = document.createElement('canvas');
        canvas.width = $('cameraPreview').videoWidth; canvas.height = $('cameraPreview').videoHeight;
        const ctx = canvas.getContext('2d', { alpha: false }); ctx.drawImage($('cameraPreview'), 0, 0, canvas.width, canvas.height);
        canvas.toBlob(async blob => {
          if (!blob || !isConnected()) return;
          try {
            const data = await fileToBase64(blob);
            sendWire({ realtimeInput: { video: { data, mimeType: 'image/jpeg' } } }, '');
          } catch (e) { logEvent('Camera frame failed', String(e.message || e), 'error'); }
        }, 'image/jpeg', 0.78);
      }, 1000);
      addMessage('user', 'Camera stream started. Gemini will receive visual frames about once per second.');
      logEvent('Camera sharing started', 'Video-only stream · max 1 frame/sec.', 'ok');
      $('cameraStartBtn').textContent = 'Sharing…';
    } catch (e) {
      stopCamera(false); toast('Camera could not start: ' + (e.message || e), 'error');
    }
  }
  function stopCamera(sendEnd = true) {
    if (state.cameraInterval) clearInterval(state.cameraInterval);
    state.cameraInterval = null;
    if (state.cameraStream) state.cameraStream.getTracks().forEach(t => t.stop());
    state.cameraStream = null;
    $('cameraPreview').srcObject = null;
    $('cameraStartBtn').disabled = false; $('cameraStartBtn').textContent = 'Start sharing'; $('cameraStopBtn').disabled = true;
    $('cameraStatus').textContent = 'Stopped';
    if (sendEnd && isConnected()) sendWire({ realtimeInput: { text: 'I have stopped sharing the camera. Please continue using the frames already received.' } }, 'camera stopped');
    if (!state.videoPlayback) $('cameraDrawer').hidden = true;
    logEvent('Camera sharing stopped', '', 'info');
  }
  async function streamVideoFile(file) {
    if (!isConnected()) throw new Error('Connect a Live session first.');
    if (!file.type.startsWith('video/')) throw new Error('Choose a video file.');
    stopVideoFrames();
    const video = document.createElement('video');
    video.muted = true; video.playsInline = true; video.preload = 'auto'; video.src = URL.createObjectURL(file);
    state.videoPlayback = { video, objectUrl: video.src };
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve; video.onerror = () => reject(new Error('Could not decode this video file.'));
    });
    if (video.duration > 120) {
      URL.revokeObjectURL(video.src); state.videoPlayback = null;
      throw new Error('Live audio+video sessions are limited to about 2 minutes. Choose a clip of 120 seconds or less.');
    }
    addMessage('user', 'Video stream started: ' + file.name + ' (' + Math.round(video.duration) + ' s). Sampling frames at 1 fps.');
    addAttachment(file.name);
    await video.play();
    const capture = async () => {
      if (!state.videoPlayback || !isConnected() || video.ended || video.paused && video.currentTime > 0) { stopVideoFrames(); return; }
      if (!video.videoWidth) return;
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(960, video.videoWidth);
      canvas.height = Math.round(canvas.width * video.videoHeight / video.videoWidth);
      canvas.getContext('2d', { alpha: false }).drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.75));
      if (!blob || !isConnected()) return;
      const data = await fileToBase64(blob);
      sendWire({ realtimeInput: { video: { data, mimeType: 'image/jpeg' } } }, '');
    };
    await capture();
    state.videoInterval = setInterval(() => capture().catch(e => logEvent('Video frame failed', String(e.message || e), 'error')), 1000);
    video.onended = () => { stopVideoFrames(); logEvent('Video stream complete', file.name, 'ok'); };
    logEvent('Video stream started', file.name + ' · sampled at 1 frame/sec', 'ok');
  }
  function stopVideoFrames() {
    if (state.videoInterval) clearInterval(state.videoInterval);
    state.videoInterval = null;
    if (state.videoPlayback) {
      try { state.videoPlayback.video.pause(); state.videoPlayback.video.removeAttribute('src'); state.videoPlayback.video.load(); URL.revokeObjectURL(state.videoPlayback.objectUrl); } catch {}
    }
    state.videoPlayback = null;
  }
  async function streamAudioFile(file) {
    if (!isConnected()) throw new Error('Connect a Live session first.');
    if (!file.type.startsWith('audio/')) throw new Error('Choose an audio file.');
    if (file.size > 30 * 1024 * 1024) throw new Error('Audio file is larger than 30 MB.');
    stopAudioFile();
    const abort = new AbortController(); state.audioFileAbort = abort;
    const ctx = await ensureAudioContext();
    const array = await file.arrayBuffer();
    const decoded = await ctx.decodeAudioData(array.slice(0));
    const channels = [];
    for (let ch = 0; ch < decoded.numberOfChannels; ch++) channels.push(decoded.getChannelData(ch));
    const mono = downsampleMono(channels, decoded.sampleRate, 16000);
    const chunkSamples = 1600;
    addMessage('user', 'Audio file stream started: ' + file.name + ' (' + Math.round(decoded.duration) + ' s).');
    addAttachment(file.name);
    logEvent('Audio file streaming', file.name + ' · resampled to mono PCM 16 kHz in 100 ms chunks.', 'ok');
    for (let offset = 0; offset < mono.length && !abort.signal.aborted; offset += chunkSamples) {
      if (!isConnected()) throw new Error('Session disconnected while streaming the audio file.');
      const chunk = mono.subarray(offset, Math.min(offset + chunkSamples, mono.length));
      sendWire({ realtimeInput: { audio: { data: bytesToBase64(floatToPcm16(chunk)), mimeType: 'audio/pcm;rate=16000' } } }, '');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!abort.signal.aborted && isConnected()) {
      sendWire({ realtimeInput: $('vadToggle').checked ? { audioStreamEnd: true } : { activityEnd: {} } }, 'audio file end');
      logEvent('Audio file complete', file.name, 'ok');
    }
    if (state.audioFileAbort === abort) state.audioFileAbort = null;
  }
  function stopAudioFile() {
    if (state.audioFileAbort) { state.audioFileAbort.abort(); state.audioFileAbort = null; }
  }

  function interruptResponse() {
    stopPlayback();
    if (isConnected()) sendWire({ clientContent: { turns: [], turnComplete: true } }, 'interrupt');
    state.activeModelTurn = false; $('stopResponseBtn').disabled = true;
    $('bannerTitle').textContent = 'Interruption requested';
    $('bannerText').textContent = 'Queued playback was stopped. The server may send one final status event.';
    logEvent('Interrupt requested', 'Sent clientContent with turnComplete=true.', 'warn');
  }
  function exportTranscript() {
    const messages = [...$('conversation').querySelectorAll('.message')].map(n => ({
      role: n.querySelector('.message-meta strong')?.textContent || 'Message',
      time: n.querySelector('.message-meta time')?.textContent || '',
      text: n.querySelector('.message-bubble')?.textContent || ''
    })).filter(m => m.text);
    const payload = { exportedAt: new Date().toISOString(), model: state.model, messages, events: [...$('eventLog').children].map(n => ({
      time: n.querySelector('time')?.textContent || '', title: n.querySelector('.event-title')?.textContent || '',
      detail: n.querySelector('.event-detail')?.textContent || ''
    })).reverse() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'gemini-live-session-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json'; a.click(); URL.revokeObjectURL(url);
    toast('Exported the visible transcript and event log.', 'success');
  }
  function clearTranscript() {
    $('conversation').querySelectorAll('.message').forEach(n => n.remove());
    $('welcomeCard').hidden = false;
    $('attachmentTray').replaceChildren(); $('attachmentTray').hidden = true;
    state.transcript = []; state.activeInputTranscript = null; state.activeOutputTranscript = null; state.activeThought = null;
    toast('Visible transcript cleared. The server-side Live session context was not reset.');
    logEvent('Visible transcript cleared', 'Session context remains active on the model.', 'info');
  }
  function autoResizeComposer() {
    const el = $('messageInput'); el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 170) + 'px';
  }
  function updateModelUi() {
    const model = $('modelSelect').value;
    state.model = model;
    const ext = model === MODEL_THINK;
    $('thinkingLevel').disabled = !ext; $('thoughtToggle').disabled = !ext;
    $('thinkingHelp').textContent = ext ? 'Extended Thinking supports LOW, MEDIUM, or HIGH; MINIMAL is not supported. Background status can continue after a spoken utterance.' : 'Gemini 3.8 Live uses a fixed interleaved reasoning profile. thinkingLevel is intentionally omitted.';
    $('modelNote').textContent = ext ? 'Background reasoning · asynchronous tool calls · keep listening until interactionStatus = IDLE.' : 'Interleaved reasoning · best for fast, natural turn-taking.';
    $('activeModelLabel').textContent = ext ? 'Gemini 3.8 · Extended Thinking' : 'Gemini 3.8 Live';
    $('proactiveToggle').checked = true; $('proactiveToggle').disabled = true;
    if (ext) $('thinkingLevel').value = $('thinkingLevel').value || 'medium';
  }
  function validateTools() {
    try { const arr = JSON.parse($('toolsJson').value || '[]'); if (!Array.isArray(arr)) throw new Error('Must be a JSON array.'); const declarations = getFunctionDeclarations(); $('toolsStatus').textContent = declarations.length + ' declaration(s) available (' + arr.length + ' custom).'; $('toolsStatus').style.color = 'var(--green)'; }
    catch (e) { $('toolsStatus').textContent = e.message; $('toolsStatus').style.color = 'var(--red)'; }
  }
  function validateExtra() {
    try { const cfg = safeJson($('extraConfig').value, 'Extra setup JSON'); $('extraStatus').textContent = Object.keys(cfg).length + ' top-level field(s) valid.'; $('extraStatus').style.color = 'var(--green)'; }
    catch (e) { $('extraStatus').textContent = e.message; $('extraStatus').style.color = 'var(--red)'; }
  }
  async function localToolRequest(payload) {
    const response = await fetch('/api/local-tool', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.message || data.error || ('Local tool HTTP ' + response.status));
    return data.result;
  }
  async function scanLocalCapabilities() {
    const button = $('scanLocalCapabilitiesBtn');
    const target = $('localCapabilitiesList');
    const statusNode = $('localCapabilitiesStatus');
    if (button) button.disabled = true;
    if (statusNode) statusNode.textContent = 'Discovering installed CLI tools…';
    if (target) target.replaceChildren();
    try {
      const result = await localToolRequest({ name: 'list_local_cli_capabilities' });
      const tools = Array.isArray(result.tools) ? result.tools : [];
      tools.forEach(tool => {
        const row = document.createElement('div'); row.className = 'local-capability-row';
        const name = document.createElement('span'); name.className = 'local-capability-name';
        name.textContent = tool.id;
        const detail = document.createElement('span'); detail.className = 'local-capability-detail';
        detail.textContent = tool.available ? (tool.version || 'Available on PATH') : 'Not found on PATH';
        detail.title = tool.description || '';
        row.append(name, detail);
        target.appendChild(row);
      });
      const sourceCount = Object.values(result.skillSources || {}).filter(Boolean).length;
      if (statusNode) statusNode.textContent = tools.filter(tool => tool.available).length + '/' + tools.length + ' CLI tools found · ' + sourceCount + ' skill sources available.';
      logEvent('Local capabilities discovered', tools.filter(tool => tool.available).map(tool => tool.id).join(', ') + ' · ' + sourceCount + ' skill roots', 'info');
    } catch (error) {
      if (statusNode) statusNode.textContent = 'Discovery failed: ' + String(error.message || error);
      toast(String(error.message || error), 'error');
      logEvent('Local capability discovery failed', String(error.message || error), 'error');
    } finally {
      if (button) button.disabled = false;
    }
  }
  async function listLocalSkillsFromUi() {
    const button = $('listLocalSkillsBtn');
    const list = $('localSkillsList');
    const preview = $('localSkillPreview');
    const source = $('localSkillSource').value;
    button.disabled = true;
    list.replaceChildren();
    preview.hidden = true;
    preview.textContent = '';
    $('localCapabilitiesStatus').textContent = 'Reading skill index…';
    try {
      const result = await localToolRequest({ name: 'list_available_skills', source });
      if (!Array.isArray(result.skills) || !result.skills.length) {
        const empty = document.createElement('p'); empty.className = 'field-note';
        empty.textContent = result.message || 'No SKILL.md files found in this source.';
        list.appendChild(empty);
      } else {
        result.skills.forEach(skill => {
          const row = document.createElement('div'); row.className = 'local-skill-row';
          const info = document.createElement('div'); info.className = 'local-skill-info';
          const title = document.createElement('strong'); title.textContent = skill.name || skill.id;
          const description = document.createElement('p'); description.textContent = skill.description || '';
          info.append(title, description);
          const read = document.createElement('button'); read.type = 'button'; read.className = 'btn btn-secondary'; read.textContent = 'Read';
          read.addEventListener('click', async () => {
            read.disabled = true;
            preview.hidden = false;
            preview.textContent = 'Reading approved local skill…';
            try {
              const content = await localToolRequest({ name: 'read_local_skill', source, nameArg: skill.id });
              preview.textContent = content.content || '(The skill file is empty.)';
              preview.dataset.source = source;
              preview.dataset.skillName = skill.name || skill.id;
              logEvent('Local skill inspected', (skill.name || skill.id) + ' · ' + source, 'info');
            } catch (error) {
              preview.textContent = 'Could not read skill: ' + String(error.message || error);
              logEvent('Local skill read failed', (skill.name || skill.id) + ' · ' + String(error.message || error), 'error');
            } finally { read.disabled = false; }
          });
          row.append(info, read);
          list.appendChild(row);
        });
      }
      $('localCapabilitiesStatus').textContent = (result.count ?? result.skills?.length ?? 0) + ' skill(s) found in ' + source + '. Skill contents remain local until explicitly returned as a tool result.';
    } catch (error) {
      $('localCapabilitiesStatus').textContent = 'Skill listing failed: ' + String(error.message || error);
      toast(String(error.message || error), 'error');
      logEvent('Local skill listing failed', String(error.message || error), 'error');
    } finally { button.disabled = false; }
  }

  function wire() {
    $('connectBtn').addEventListener('click', () => connectSession(false).catch(handleConnectError));
    $('scanLocalCapabilitiesBtn')?.addEventListener('click', scanLocalCapabilities);
    $('listLocalSkillsBtn')?.addEventListener('click', listLocalSkillsFromUi);
    $('disconnectBtn').addEventListener('click', disconnectSession);
    $('revealKeyBtn').addEventListener('click', () => {
      const input = $('apiKey'); input.type = input.type === 'password' ? 'text' : 'password';
      const hidden = input.type === 'password';
      $('revealKeyBtn').replaceChildren(window.LocalIcons ? window.LocalIcons.create(hidden ? 'eye' : 'eye-off', 15) : document.createTextNode(hidden ? 'Show' : 'Hide'));
      $('revealKeyBtn').setAttribute('aria-label', hidden ? 'Show API key' : 'Hide API key');
    });
    $('modelSelect').addEventListener('change', () => {
      if (isConnected()) { $('modelSelect').value = state.model; toast('End the current session to change model or setup settings.', 'error'); return; }
      updateModelUi();
    });
    $('micBtn').addEventListener('click', () => state.micActive ? stopMicrophone(true) : startMicrophone());
    $('sendBtn').addEventListener('click', sendText);
    $('messageInput').addEventListener('input', autoResizeComposer);
    $('messageInput').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(); } });
    $('stopResponseBtn').addEventListener('click', interruptResponse);
    $('exportBtn').addEventListener('click', exportTranscript);
    $('clearBtn').addEventListener('click', clearTranscript);
    $('clearEventsBtn').addEventListener('click', () => { $('eventLog').replaceChildren(); state.eventCount = 0; $('eventCount').textContent = '0 events'; $('headerEventCount').textContent = '0'; $('headerLatestEvent').textContent = 'No recent events'; $('headerLatestEvent').title = 'No recent events'; });
    $('exportLastAudioBtn')?.addEventListener('click', exportLastAudioCapture);
    $('copySetupBtn').addEventListener('click', async () => {
      if (!state.lastSetupText) { toast('Connect first to create a setup payload.'); return; }
      try { await navigator.clipboard.writeText(state.lastSetupText); toast('Setup JSON copied.'); } catch { toast('Clipboard permission was unavailable.', 'error'); }
    });
    $('imageBtn').addEventListener('click', () => $('imageInput').click());
    $('audioFileBtn').addEventListener('click', () => $('audioInput').click());
    $('videoFileBtn').addEventListener('click', () => $('videoInput').click());
    $('cameraBtn').addEventListener('click', () => { $('cameraDrawer').hidden = !$('cameraDrawer').hidden; if (!$('cameraDrawer').hidden) $('cameraDrawer').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); });
    $('imageInput').addEventListener('change', async e => { const f = e.target.files?.[0]; if (!f) return; try { await sendImageFile(f); } catch (err) { toast(err.message || String(err), 'error'); logEvent('Image upload failed', err.message || String(err), 'error'); } e.target.value = ''; });
    $('audioInput').addEventListener('change', async e => { const f = e.target.files?.[0]; if (!f) return; try { await streamAudioFile(f); } catch (err) { toast(err.message || String(err), 'error'); logEvent('Audio file failed', err.message || String(err), 'error'); } e.target.value = ''; });
    $('videoInput').addEventListener('change', async e => { const f = e.target.files?.[0]; if (!f) return; try { await streamVideoFile(f); } catch (err) { toast(err.message || String(err), 'error'); logEvent('Video file failed', err.message || String(err), 'error'); } e.target.value = ''; });
    $('cameraStartBtn').addEventListener('click', startCamera);
    $('cameraStopBtn').addEventListener('click', () => stopCamera(true));
    $('validateToolsBtn').addEventListener('click', validateTools);
    $('validateExtraBtn').addEventListener('click', validateExtra);
    $('temperature').addEventListener('input', () => $('temperatureOut').textContent = Number($('temperature').value).toFixed(2));
    $('topP').addEventListener('input', () => $('topPOut').textContent = Number($('topP').value).toFixed(2));
    window.addEventListener('beforeunload', () => { stopMicrophone(false); stopCamera(false); stopVideoFrames(); stopAudioFile(); if (state.ws) state.ws.close(1000, 'Page closed'); });
  }

  wire(); updateModelUi();
  animateThinkingOrb();
  logEvent('Studio ready', 'Local UI ready · saved key profiles stay in this browser only.', 'setup');
  $('tokenState').textContent = $('apiKey').value ? 'Remembered key selected' : 'Key required to issue token';
})();
