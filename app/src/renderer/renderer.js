if (!window.wrs) {
  const post = async (url, payload = {}) => {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  };
  const listeners = { status: [], state: [], theme: [], media: [] };
  const es = new EventSource('/events');
  es.addEventListener('status:event', e => listeners.status.forEach(cb => cb(JSON.parse(e.data))));
  es.addEventListener('state:update', e => listeners.state.forEach(cb => cb(JSON.parse(e.data))));
  es.addEventListener('theme:set', e => listeners.theme.forEach(cb => cb(JSON.parse(e.data))));
  es.addEventListener('media:update', e => listeners.media.forEach(cb => cb(JSON.parse(e.data))));
  window.wrs = {
    getState: () => fetch('/api/state').then(r => r.json()),
    setTheme: theme => post('/api/theme', { theme }),
    addManualHost: host => post('/api/manualHost', { host }),
    search: brand => post('/api/search', { brand }),
    connect: device => post('/api/connect', { device }),
    connectLast: () => post('/api/connectLast'),
    command: (cmd, payload) => post('/api/command', { cmd, payload: payload || {} }),
    nowPlaying: () => post('/api/nowPlaying'),
    onStatus: cb => listeners.status.push(cb),
    onState: cb => listeners.state.push(cb),
    onTheme: cb => listeners.theme.push(cb),
    onMedia: cb => listeners.media.push(cb),
    onMenuSearch: cb => { window.__menuSearch = cb; },
    onMenuConnectLast: cb => { window.__menuConnectLast = cb; },
    onMenuCommand: cb => { window.__menuCommand = cb; },
    onMenuRefreshMedia: cb => { window.__menuRefreshMedia = cb; },
    onAbout: cb => { window.__menuAbout = cb; }
  };
}

'use strict';
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
let state = { devices: [], connected: null, status: [] };
let lastMedia = null;
let voiceRecognition = null;
let voiceActive = false;

const commandLabels = {
  up: 'Up', down: 'Down', left: 'Left', right: 'Right', ok: 'OK', back: 'Back', home: 'Home', info: 'Info',
  settings: 'Settings', input: 'Input', volumeUp: 'Vol+', volumeDown: 'Vol-', mute: 'Mute', channelUp: 'CH+', channelDown: 'CH-',
  play: 'Play', pause: 'Pause', stop: 'Stop', rewind: 'Rewind', forward: 'Forward', powerOff: 'Power', launchApp: 'Launch App',
  text: 'Send Text', enterText: 'Enter'
};

function toast(msg) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2600);
}
function brandName(b) { return { lg: 'LG', samsung: 'Samsung', roku: 'Roku' }[b] || 'TV'; }
function remoteName(b) { return { lg: 'LG Magic Remote', samsung: 'Samsung Smart Remote', roku: 'Roku Voice Remote' }[b] || 'Remote'; }
function labelFor(cmd) { return commandLabels[cmd] || cmd; }
function isDebug() { return Boolean($('#debugToggle') && $('#debugToggle').checked); }
function fmtTime(t) { try { return new Date(t).toLocaleTimeString(); } catch (_) { return new Date().toLocaleTimeString(); } }
function setClock() {
  const el = $('#clockText');
  if (el) el.textContent = new Date().toLocaleString([], { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' });
}

function setTheme(theme) {
  if (!theme || theme === 'all') theme = 'lg';
  document.body.dataset.theme = theme;
  $$('.brandTab').forEach(b => b.classList.toggle('active', b.dataset.themeBtn === theme));
  $('#remoteBrandLabel').textContent = remoteName(theme);
}

function setConnectedUI(connected) {
  const led = $('#connectionLed');
  const txt = $('#connectionText');
  const host = $('#connectionHost');
  if (led) led.classList.toggle('on', Boolean(connected));
  if (led) led.classList.toggle('off', !connected);
  if (txt) txt.textContent = connected ? 'Connected' : 'Standby';
  if (host) host.textContent = connected ? connected.host : 'Not connected';
}

function triggerRemoteFX() {
  const shell = $('#remoteShell');
  const sig = $('#signalState');
  if (!shell) return;
  shell.classList.remove('transmitting');
  void shell.offsetWidth;
  shell.classList.add('transmitting');
  if (sig) sig.textContent = 'Sending';
  setTimeout(() => { shell.classList.remove('transmitting'); if (sig) sig.textContent = 'Ready'; }, 820);
}

function pressFX(el) {
  if (!el) return;
  el.classList.add('is-pressing');
  setTimeout(() => el.classList.remove('is-pressing'), 170);
}

function renderDeviceCard(d) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'deviceCard';
  el.innerHTML = `<strong>${d.name}</strong><span>${brandName(d.brand)} · ${d.host} · ${d.discoveryMethod || 'found'}</span>`;
  el.onclick = async () => {
    pressFX(el);
    try {
      toast(`Connecting to ${d.name}`);
      if (d.brand) await window.wrs.setTheme(d.brand);
      await window.wrs.connect(d);
      await refreshMedia();
      toast('Connection established');
    } catch (e) { toast(e.message); }
  };
  return el;
}

function renderState(s) {
  state = { ...state, ...s };
  const interfaces = (state.interfaces || []).map(x => `${x.name} ${x.address}`).join(' · ');
  $('#interfaceText').textContent = interfaces || 'network ready';
  const connected = state.connected;
  $('#remoteTitle').textContent = connected ? `${connected.name}` : 'No TV Connected';
  $('#remoteSub').textContent = connected ? `${brandName(connected.brand)} · ${connected.host}` : 'Search, select, pair, then control.';
  setConnectedUI(connected);
  if (connected && connected.brand) setTheme(connected.brand);
  const list = $('#deviceList');
  list.innerHTML = '';
  for (const d of state.devices || []) list.appendChild(renderDeviceCard(d));
  renderLog(state.status || []);
}

function humanLog(entry) {
  const msg = entry.message || '';
  if (entry.type === 'command') {
    const m = msg.match(/^(.+?) sent$/);
    return `Command: ${labelFor(m ? m[1] : msg)}`;
  }
  if (entry.type === 'scan') return `Search: ${msg}`;
  if (entry.type === 'connect') return `Connection: ${msg}`;
  if (entry.type === 'config') return `Settings: ${msg}`;
  if (entry.type === 'media') return `Media: ${msg}`;
  if (entry.type === 'error') return `Error: ${msg}`;
  if (entry.type === 'app') return `App: ${msg}`;
  return `${entry.type || 'status'}: ${msg}`;
}

function renderLog(lines) {
  const log = $('#statusLog');
  if (!log) return;
  log.textContent = lines.slice(-44).map(x => {
    if (isDebug()) return `[${fmtTime(x.time)}] ${x.type}: ${x.message}`;
    return `[${fmtTime(x.time)}] ${humanLog(x)}`;
  }).join('\n');
  log.scrollTop = log.scrollHeight;
}

async function search() {
  const checked = document.querySelector('input[name="brand"]:checked');
  const brand = checked ? checked.value : 'all';
  toast('Searching network');
  const devs = await window.wrs.search(brand);
  toast(`Found ${devs.length} TV(s)`);
  if (devs.length === 1) {
    try {
      toast(`Auto-connecting ${devs[0].name}`);
      await window.wrs.setTheme(devs[0].brand);
      await window.wrs.connect(devs[0]);
      await refreshMedia();
      toast('Remote control ready');
    } catch (e) { toast(e.message); }
  }
}

function renderMedia(m) {
  lastMedia = m;
  $('#mediaTitle').textContent = m.title || 'Unknown';
  $('#mediaSub').textContent = m.subtitle || '';
  const img = $('#thumb');
  const fallback = $('#thumbFallback');
  if (m.thumbnail) {
    img.src = m.thumbnail;
    img.style.display = 'block';
    fallback.style.display = 'none';
  } else {
    img.removeAttribute('src');
    img.style.display = 'none';
    fallback.style.display = 'grid';
  }
}

async function refreshMedia() {
  const m = await window.wrs.nowPlaying();
  renderMedia(m);
  return m;
}

async function command(cmd, payload = {}, sourceEl = null) {
  pressFX(sourceEl);
  if (cmd && /^digit|list|more|voice$/.test(cmd)) {
    toast(`${labelFor(cmd)} is not mapped for this TV protocol`);
    return;
  }
  try {
    triggerRemoteFX();
    $('#lastAction').textContent = labelFor(cmd);
    await window.wrs.command(cmd, payload);
    toast(`Command: ${labelFor(cmd)}`);
    if (['home','back','input','launchApp','play','pause','stop','forward','rewind'].includes(cmd)) setTimeout(refreshMedia, 420);
  } catch (e) { toast(e.message); }
}

function openAbout() {
  const dialog = $('#aboutDialog');
  if (dialog && typeof dialog.showModal === 'function') dialog.showModal();
  else toast('Voltix Remote Studio · © 2026 Christopher Ryan');
}

function setupVoice() {
  const btn = $('#voiceBtn');
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!btn) return;
  if (!SpeechRecognition) {
    btn.onclick = () => toast('Voice recognition is not available in this browser');
    return;
  }
  voiceRecognition = new SpeechRecognition();
  voiceRecognition.continuous = false;
  voiceRecognition.interimResults = false;
  voiceRecognition.lang = 'en-US';
  voiceRecognition.onresult = e => {
    const phrase = String(e.results[0][0].transcript || '').toLowerCase();
    const map = [
      [/volume up|vol up/, 'volumeUp'], [/volume down|vol down/, 'volumeDown'], [/mute/, 'mute'], [/home/, 'home'], [/back/, 'back'],
      [/play/, 'play'], [/pause/, 'pause'], [/stop/, 'stop'], [/ok|select|enter/, 'ok'], [/up/, 'up'], [/down/, 'down'], [/left/, 'left'], [/right/, 'right'], [/input/, 'input']
    ];
    const hit = map.find(([re]) => re.test(phrase));
    if (hit) command(hit[1], {}, btn); else toast(`Voice phrase not mapped: ${phrase}`);
  };
  voiceRecognition.onend = () => { voiceActive = false; btn.textContent = 'Voice Off'; btn.setAttribute('aria-pressed', 'false'); };
  voiceRecognition.onerror = e => toast(`Voice error: ${e.error || 'unknown'}`);
  btn.onclick = () => {
    if (voiceActive) { voiceRecognition.stop(); return; }
    voiceActive = true; btn.textContent = 'Listening…'; btn.setAttribute('aria-pressed', 'true'); voiceRecognition.start();
  };
}

window.addEventListener('DOMContentLoaded', async () => {
  setClock(); setInterval(setClock, 30000);
  $$('.brandTab[data-theme-btn]').forEach(b => b.onclick = () => { pressFX(b); window.wrs.setTheme(b.dataset.themeBtn); });
  $('#searchBtn').onclick = () => { pressFX($('#searchBtn')); search().catch(e => toast(e.message)); };
  $('#connectLastBtn').onclick = async () => { pressFX($('#connectLastBtn')); try { await window.wrs.connectLast(); await refreshMedia(); toast('Connected last TV'); } catch (e) { toast(e.message); } };
  $('#addHostBtn').onclick = async () => { pressFX($('#addHostBtn')); const h = $('#manualHost').value.trim(); if (!h) return; await window.wrs.addManualHost(h); toast(`Saved ${h}`); };
  $('#refreshMedia').onclick = () => { pressFX($('#refreshMedia')); refreshMedia().catch(e => toast(e.message)); };
  $('#sendTextBtn').onclick = () => command('text', { text: $('#textInput').value }, $('#sendTextBtn'));
  $$('[data-cmd]').forEach(b => b.onclick = () => command(b.dataset.cmd, {}, b));
  $$('[data-app]').forEach(b => b.onclick = () => command('launchApp', { appId: b.dataset.app }, b));
  $('#debugToggle').addEventListener('change', () => renderLog(state.status || []));
  setupVoice();
  window.wrs.onStatus(x => { state.status = [...(state.status || []), x]; renderLog(state.status); });
  window.wrs.onState(renderState);
  window.wrs.onTheme(setTheme);
  window.wrs.onMedia(renderMedia);
  window.wrs.onMenuSearch(search);
  window.wrs.onMenuConnectLast(() => $('#connectLastBtn').click());
  window.wrs.onMenuCommand(x => command(x.cmd, x.payload || {}));
  window.wrs.onMenuRefreshMedia(refreshMedia);
  window.wrs.onAbout(openAbout);
  document.querySelectorAll('[data-menu-action]').forEach(btn => btn.addEventListener('click', () => {
    pressFX(btn);
    const a = btn.dataset.menuAction;
    if (a === 'search' && window.__menuSearch) window.__menuSearch();
    if (a === 'connectLast' && window.__menuConnectLast) window.__menuConnectLast();
    if (a === 'refreshMedia' && window.__menuRefreshMedia) window.__menuRefreshMedia();
    if (a === 'about' && window.__menuAbout) window.__menuAbout();
  }));
  renderState(await window.wrs.getState());
});
