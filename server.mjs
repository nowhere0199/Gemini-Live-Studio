import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const execFileAsync = promisify(execFile);
const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT || 8765);
const ALLOWED_MODELS = new Set(['gemini-3.8-live', 'gemini-3.8-live-extended-thinking']);
const ALLOWED_HOSTS = new Set([HOST + ':' + PORT, 'localhost:' + PORT]);
const staticFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/icons.js', ['icons.js', 'text/javascript; charset=utf-8']],
  ['/enhancements.js', ['enhancements.js', 'text/javascript; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
]);
const rate = new Map();

function send(res, status, body, type = 'application/json; charset=utf-8') {
  const data = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': type,
    'Content-Length': Buffer.byteLength(data),
    'Cache-Control': 'no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(self), microphone=(self), autoplay=(self)',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self' https://generativelanguage.googleapis.com wss://generativelanguage.googleapis.com; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
  });
  res.end(data);
}

function isLocalRequest(req) {
  const host = String(req.headers.host || '').toLowerCase();
  if (!ALLOWED_HOSTS.has(host)) return false;
  const origin = req.headers.origin;
  if (!origin) return true;
  return origin === 'http://' + host;
}

function rateAllowed(req) {
  const key = req.socket.remoteAddress || 'loopback';
  const now = Date.now();
  const item = rate.get(key);
  if (!item || now - item.start > 60_000) {
    rate.set(key, { start: now, count: 1 });
    return true;
  }
  item.count++;
  return item.count <= 15;
}

async function bodyJson(req, maxBytes = 16_384) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw Object.assign(new Error('Request body too large.'), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('Expected a JSON request body.'), { status: 400 }); }
}

function redactMessage(value, apiKey) {
  let text = String(value || 'Gemini token provisioning failed.');
  if (apiKey) text = text.split(apiKey).join('[redacted API key]');
  text = text.replace(/AIza[0-9A-Za-z_-]{20,}/g, '[redacted API key]');
  text = text.replace(/Bearer\s+\S+/gi, 'Bearer [redacted]');
  return text.slice(0, 800);
}

async function issueEphemeralToken(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'Use POST.' });
  }
  if (!isLocalRequest(req)) return send(res, 403, { error: 'LOCAL_ONLY', message: 'Requests must originate from the local app.' });
  if (!rateAllowed(req)) return send(res, 429, { error: 'RATE_LIMITED', message: 'Too many token requests. Wait a minute and retry.' });

  let data;
  try { data = await bodyJson(req); }
  catch (e) { return send(res, e.status || 400, { error: 'INVALID_BODY', message: e.message }); }

  const apiKey = typeof data.apiKey === 'string' ? data.apiKey.trim() : '';
  const model = typeof data.model === 'string' ? data.model : '';
  if (apiKey.length < 20 || apiKey.length > 300) {
    return send(res, 400, { error: 'INVALID_API_KEY', message: 'Paste a valid Gemini API key.' });
  }
  if (!ALLOWED_MODELS.has(model)) {
    return send(res, 400, { error: 'MODEL_NOT_ALLOWED', message: 'This local app only issues tokens for the two Gemini Live models.' });
  }

  // The long-lived key remains in this local process and is never logged or returned.
  // The browser receives a single-use, short-lived token constrained to this model and AUDIO output.
  const now = Date.now();
  const payload = {
    uses: 1,
    expireTime: new Date(now + 30 * 60_000).toISOString(),
    newSessionExpireTime: new Date(now + 55_000).toISOString(),
    fieldMask: 'model,generationConfig.responseModalities',
    bidiGenerateContentSetup: {
      model: 'models/' + model,
      generationConfig: { responseModalities: ['AUDIO'] }
    }
  };

  try {
    const upstream = await fetch('https://generativelanguage.googleapis.com/v1beta/auth_tokens', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000)
    });
    const reply = await upstream.json().catch(() => ({}));
    if (!upstream.ok || typeof reply.name !== 'string' || !reply.name) {
      const upstreamReason = reply?.error?.message || reply?.message || 'No error detail returned.';
      let hint = '';
      if (upstream.status === 401) hint = ' Check that the key is active and allowed to call the Gemini API. Unrestricted legacy standard keys may be rejected; restrict the key to Gemini API or create a fresh key in Google AI Studio.';
      else if (upstream.status === 403) hint = ' Check Gemini API access, key/API restrictions, project permissions, and quota.';
      else if (upstream.status === 400) hint = ' Check that this project can use the selected Live model and that the key has access to Live API token creation.';
      const reason = 'Gemini API HTTP ' + upstream.status + ': ' + upstreamReason + hint;
      return send(res, upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502, {
        error: 'TOKEN_REQUEST_FAILED',
        message: redactMessage(reason, apiKey)
      });
    }
    return send(res, 200, {
      token: reply.name,
      expiresAt: payload.expireTime,
      newSessionExpiresAt: payload.newSessionExpireTime,
      model
    });
  } catch (e) {
    const timeout = e?.name === 'TimeoutError' || e?.name === 'AbortError';
    return send(res, 502, {
      error: timeout ? 'TOKEN_REQUEST_TIMEOUT' : 'TOKEN_REQUEST_NETWORK_ERROR',
      message: timeout ? 'Gemini token provisioning timed out after 15 seconds.' : 'Could not reach Gemini token provisioning. Check network access.'
    });
  }
}

const LOCAL_TOOL_ORIGINS = new Set([
  'http://' + HOST + ':' + PORT,
  'http://localhost:' + PORT
]);
const LOCAL_TOOL_RATE = new Map();
const LOCAL_SKILL_ROOTS = {
  project: path.join(ROOT, '.gemini', 'skills'),
  'gemini-user': path.join(process.env.USERPROFILE || '', '.gemini', 'skills'),
  'agents-user': path.join(process.env.USERPROFILE || '', '.agents', 'skills')
};
// Optional user-configured skill library; do not hard-code a maintainer's private path.
if (process.env.GEMINI_LIVE_MARKETING_SKILLS_DIR) {
  LOCAL_SKILL_ROOTS.marketing = path.resolve(process.env.GEMINI_LIVE_MARKETING_SKILLS_DIR);
}
const LOCAL_CLI_NAMES = [
  { id: 'node', command: 'node.exe', description: 'Node.js runtime used by this studio' },
  { id: 'npm', command: 'npm.cmd', description: 'Node package manager' },
  { id: 'git', command: 'git.exe', description: 'Version control and read-only repository inspection' },
  { id: 'python', command: 'python.exe', description: 'Python runtime' },
  { id: 'gemini', command: 'gemini.cmd', description: 'Gemini CLI agent and skill runner' },
  { id: 'hermes', command: 'hermes.cmd', description: 'Hermes local agent CLI' },
  { id: 'claude', command: 'claude.cmd', description: 'Claude Code CLI' },
  { id: 'powershell', command: 'powershell.exe', description: 'Windows PowerShell' },
  { id: 'cmd', command: 'cmd.exe', description: 'Windows Command Prompt' }
];

function localToolOriginAllowed(req) {
  const host = String(req.headers.host || '').toLowerCase();
  const origin = String(req.headers.origin || '').toLowerCase();
  return ALLOWED_HOSTS.has(host) && LOCAL_TOOL_ORIGINS.has(origin) && origin === 'http://' + host;
}

function localToolRateAllowed(req) {
  const key = req.socket.remoteAddress || 'loopback';
  const now = Date.now();
  const item = LOCAL_TOOL_RATE.get(key);
  if (!item || now - item.start > 60_000) {
    LOCAL_TOOL_RATE.set(key, { start: now, count: 1 });
    return true;
  }
  item.count++;
  return item.count <= 60;
}

function safeToolOutput(value, max = 6500) {
  return String(value || '').replace(/AIza[0-9A-Za-z_-]{20,}/g, '[redacted API key]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]').slice(0, max);
}

async function findCommand(command) {
  try {
    const result = await execFileAsync('where.exe', [command], {
      windowsHide: true, timeout: 2200, maxBuffer: 16 * 1024
    });
    return String(result.stdout || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean)[0] || '';
  } catch {
    return '';
  }
}

async function runFixedCommand(command, args, options = {}) {
  const result = await execFileAsync(command, args, {
    cwd: options.cwd || ROOT,
    windowsHide: true,
    timeout: options.timeout || 4500,
    maxBuffer: 256 * 1024,
    encoding: 'utf8'
  });
  return safeToolOutput((result.stdout || '') + (result.stderr ? '\n' + result.stderr : ''));
}

async function listLocalCliCapabilities() {
  const installed = await Promise.all(LOCAL_CLI_NAMES.map(async item => {
    const found = item.id === 'node'
      ? process.execPath
      : item.id === 'cmd'
        ? (process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe')
        : await findCommand(item.command);
    let version = '';
    if (item.id === 'node') version = process.version;
    else if (found && ['git', 'python'].includes(item.id)) {
      try {
        const args = item.id === 'git' ? ['--version'] : ['--version'];
        version = (await runFixedCommand(found, args, { timeout: 2500 })).trim().split(/\r?\n/)[0].slice(0, 120);
      } catch {}
    }
    return { id: item.id, label: item.command, available: Boolean(found), description: item.description, version };
  }));
  const skills = {};
  for (const [source, root] of Object.entries(LOCAL_SKILL_ROOTS)) {
    try { skills[source] = (await fs.stat(root)).isDirectory(); }
    catch { skills[source] = false; }
  }
  return { tools: installed, skillSources: skills, policy: 'Read-only allowlist; no free-form shell execution.' };
}

function skillSourceRoot(source) {
  if (typeof source !== 'string' || !Object.prototype.hasOwnProperty.call(LOCAL_SKILL_ROOTS, source)) {
    throw Object.assign(new Error('Unknown skill source. Choose one of the listed local sources.'), { status: 400 });
  }
  return path.resolve(LOCAL_SKILL_ROOTS[source]);
}

async function listLocalSkills(source) {
  const root = skillSourceRoot(source);
  let entries;
  try { entries = await fs.readdir(root, { withFileTypes: true }); }
  catch (error) {
    if (error && error.code === 'ENOENT') return { source, skills: [], message: 'This skill source is not installed.' };
    throw error;
  }
  const skills = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^[a-z0-9][a-z0-9._-]{0,79}$/i.test(entry.name)) continue;
    try {
      const files = await fs.readdir(path.join(root, entry.name));
      const skillFile = files.find(name => name.toLowerCase() === 'skill.md');
      if (!skillFile) continue;
      const content = await fs.readFile(path.join(root, entry.name, skillFile), 'utf8');
      const descriptionMatch = content.match(/^description:\s*(.+)$/im);
      const titleMatch = content.match(/^name:\s*(.+)$/im);
      skills.push({
        id: entry.name,
        name: (titleMatch ? titleMatch[1].trim().replace(/^["']|["']$/g, '') : entry.name).slice(0, 100),
        description: descriptionMatch ? descriptionMatch[1].trim().replace(/^["']|["']$/g, '').slice(0, 220) : 'Local skill instructions'
      });
    } catch {}
  }
  skills.sort((a, b) => a.name.localeCompare(b.name));
  return { source, count: skills.length, skills: skills.slice(0, 200) };
}

async function readLocalSkill(source, name) {
  if (typeof name !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,79}$/i.test(name)) {
    throw Object.assign(new Error('Skill name must be a plain folder name.'), { status: 400 });
  }
  const root = skillSourceRoot(source);
  const realRoot = await fs.realpath(root);
  const folder = await fs.realpath(path.join(realRoot, name));
  if (!folder.startsWith(realRoot + path.sep)) {
    throw Object.assign(new Error('Skill path is outside the approved skill source.'), { status: 403 });
  }
  const files = await fs.readdir(folder);
  const skillFile = files.find(file => file.toLowerCase() === 'skill.md');
  if (!skillFile) throw Object.assign(new Error('The selected folder has no SKILL.md.'), { status: 404 });
  const filePath = await fs.realpath(path.join(folder, skillFile));
  if (!filePath.startsWith(realRoot + path.sep)) {
    throw Object.assign(new Error('Skill file resolves outside the approved skill source.'), { status: 403 });
  }
  const stat = await fs.stat(filePath);
  if (!stat.isFile() || stat.size > 50 * 1024) {
    throw Object.assign(new Error('Skill file must be a regular Markdown file under 50 KB.'), { status: 413 });
  }
  const content = await fs.readFile(filePath, 'utf8');
  return { source, name, path: path.relative(realRoot, filePath), content: safeToolOutput(content, 48_000) };
}

async function runApprovedCliCheck(check) {
  if (typeof check !== 'string') throw Object.assign(new Error('A named CLI check is required.'), { status: 400 });
  const nodePath = process.execPath;
  switch (check) {
    case 'node-version':
      return { check, ok: true, output: process.version };
    case 'git-version': {
      const command = await findCommand('git.exe');
      if (!command) return { check, ok: false, output: 'Git executable was not found on PATH.' };
      return { check, ok: true, output: await runFixedCommand(command, ['--version']) };
    }
    case 'python-version': {
      const command = await findCommand('python.exe');
      if (!command) return { check, ok: false, output: 'Python executable was not found on PATH.' };
      return { check, ok: true, output: await runFixedCommand(command, ['--version']) };
    }
    case 'cmd-version':
      return { check, ok: true, output: await runFixedCommand(process.env.ComSpec || 'cmd.exe', ['/d', '/c', 'ver']) };
    case 'powershell-version':
      return { check, ok: true, output: await runFixedCommand('powershell.exe', ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()']) };
    case 'npm-version':
      return { check, ok: true, output: await runFixedCommand(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm --version']) };
    case 'gemini-version':
      return { check, ok: true, output: await runFixedCommand(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'gemini --version']) };
    case 'gemini-skills-list': {
      try { return { check, ok: true, output: await runFixedCommand(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'gemini skills list']) }; }
      catch (error) { return { check, ok: false, output: safeToolOutput(error.stderr || error.message || 'Gemini CLI skills list failed.') }; }
    }
    case 'hermes-version':
      return { check, ok: true, output: await runFixedCommand(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'hermes --version']) };
    case 'claude-version':
      return { check, ok: true, output: await runFixedCommand(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'claude --version']) };
    case 'project-js-syntax': {
      const files = ['server.mjs', 'app.js', 'enhancements.js'];
      const results = [];
      for (const file of files) {
        try {
          const output = await runFixedCommand(nodePath, ['--check', path.join(ROOT, file)], { timeout: 3500 });
          results.push({ file, ok: true, output });
        } catch (error) {
          results.push({ file, ok: false, output: safeToolOutput(error.stderr || error.message || 'Syntax check failed.') });
        }
      }
      return { check, ok: results.every(result => result.ok), results };
    }
    case 'project-git-status': {
      const git = await findCommand('git.exe');
      if (!git) return { check, ok: false, output: 'Git executable was not found on PATH.' };
      try { return { check, ok: true, output: await runFixedCommand(git, ['-C', ROOT, 'status', '--short']) }; }
      catch (error) { return { check, ok: false, output: safeToolOutput(error.stderr || error.message || 'Git status failed.') }; }
    }
    default:
      throw Object.assign(new Error('This CLI check is not in the read-only allowlist.'), { status: 400 });
  }
}

async function localToolRequest(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'Use POST.' });
  }
  if (!localToolOriginAllowed(req)) {
    return send(res, 403, { error: 'LOCAL_TOOL_ORIGIN_REQUIRED', message: 'Use the local Gemini Live Studio page to approve local tools.' });
  }
  if (!localToolRateAllowed(req)) {
    return send(res, 429, { error: 'LOCAL_TOOL_RATE_LIMITED', message: 'Too many local tool requests; wait a minute.' });
  }
  let data;
  try { data = await bodyJson(req, 12_000); }
  catch (error) { return send(res, error.status || 400, { error: 'INVALID_BODY', message: error.message }); }
  try {
    let result;
    switch (data.name) {
      case 'list_local_cli_capabilities':
        result = await listLocalCliCapabilities();
        break;
      case 'list_available_skills':
        result = await listLocalSkills(data.source);
        break;
      case 'read_local_skill':
        result = await readLocalSkill(data.source, data.nameArg);
        break;
      case 'run_approved_cli_check':
        result = await runApprovedCliCheck(data.check);
        break;
      default:
        return send(res, 400, { error: 'LOCAL_TOOL_NOT_ALLOWED', message: 'This local tool is not in the read-only allowlist.' });
    }
    return send(res, 200, { ok: true, result });
  } catch (error) {
    const status = Number.isInteger(error.status) ? error.status : 500;
    return send(res, status, { ok: false, error: 'LOCAL_TOOL_FAILED', message: safeToolOutput(error.message || 'Local tool failed.', 500) });
  }
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url || '/', 'http://' + (req.headers.host || HOST + ':' + PORT));
  if (requestUrl.pathname === '/api/ephemeral-token') {
    await issueEphemeralToken(req, res);
    return;
  }
  if (requestUrl.pathname === '/api/local-tool') {
    await localToolRequest(req, res);
    return;
  }
  if (requestUrl.pathname === '/health') {
    return send(res, 200, { ok: true, app: 'gemini-live-studio', mode: 'local-only' });
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return send(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  }
  const file = staticFiles.get(requestUrl.pathname);
  if (!file) return send(res, 404, { error: 'NOT_FOUND', message: 'Route not found.' });
  try {
    const fullPath = path.join(ROOT, file[0]);
    const content = await fs.readFile(fullPath);
    res.writeHead(200, {
      'Content-Type': file[1],
      'Content-Length': content.byteLength,
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'X-Frame-Options': 'DENY',
      'Permissions-Policy': 'camera=(self), microphone=(self), autoplay=(self)',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self' https://generativelanguage.googleapis.com wss://generativelanguage.googleapis.com; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
    });
    if (req.method === 'HEAD') return res.end();
    res.end(content);
  } catch {
    send(res, 500, { error: 'FILE_READ_FAILED' });
  }
});

server.on('clientError', (_err, socket) => {
  if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
});

server.listen(PORT, HOST, () => {
  console.log('Gemini Live Studio listening only on http://' + HOST + ':' + PORT);
  console.log('No API key is loaded from disk; enter your own key in the UI.');
  console.log('Press Ctrl+C to stop.');
});
