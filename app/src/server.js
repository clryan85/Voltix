'use strict';
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { discover, interfaces } = require('./backend/discovery');
const { ConfigStore } = require('./backend/config');
const { StatusLog } = require('./backend/log');
const { ControllerHub } = require('./backend/controller');
const rendererDir = path.join(__dirname, 'renderer');
const userDataDir = process.env.SMART_REMOTE_STUDIO_USERDATA || path.join(os.homedir(), '.config', 'VoltixRemoteStudio');
const store = new ConfigStore(userDataDir);
const status = new StatusLog();
let currentTheme = 'lg';
let devices = [];
let clients = new Set();
const hub = new ControllerHub(store, (type, message, data) => log(type, message, data));
function log(type, message, data) { const entry = status.push(type, message, data); broadcast('status:event', entry); return entry; }
function snapshot() { return { theme: currentTheme, devices, connected: hub && hub.device ? hub.device : null, status: status.snapshot(), interfaces: interfaces(), lastDevice: store.getLastDevice() }; }
function sendSse(res, event, payload) { res.write(`event: ${event}\n`); res.write(`data: ${JSON.stringify(payload)}\n\n`); }
function broadcast(event, payload) { for (const c of Array.from(clients)) { try { sendSse(c, event, payload); } catch (_) { clients.delete(c); } } }
function broadcastState() { broadcast('state:update', snapshot()); }
function contentType(file) { if (file.endsWith('.html')) return 'text/html; charset=utf-8'; if (file.endsWith('.css')) return 'text/css; charset=utf-8'; if (file.endsWith('.js')) return 'application/javascript; charset=utf-8'; if (file.endsWith('.png')) return 'image/png'; if (file.endsWith('.svg')) return 'image/svg+xml'; return 'application/octet-stream'; }
async function bodyJson(req) { return new Promise((resolve, reject) => { const chunks=[]; req.on('data', c => chunks.push(Buffer.from(c))); req.on('end', () => { const raw=Buffer.concat(chunks).toString('utf8'); if (!raw) return resolve({}); try { resolve(JSON.parse(raw)); } catch(e) { reject(e); } }); req.on('error', reject); }); }
function json(res, code, payload) { const data = JSON.stringify(payload); res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(data), 'cache-control':'no-store' }); res.end(data); }
function fail(res, e) { log('error', e.message || String(e)); json(res, 500, { error: e.message || String(e) }); }
async function api(req, res, pathname) { try {
  if (req.method === 'GET' && pathname === '/api/state') return json(res, 200, snapshot());
  if (req.method === 'POST' && pathname === '/api/theme') { const b = await bodyJson(req); currentTheme = b.theme || 'lg'; broadcast('theme:set', currentTheme); broadcastState(); return json(res, 200, snapshot()); }
  if (req.method === 'POST' && pathname === '/api/manualHost') { const b = await bodyJson(req); store.addManualHost(String(b.host || '').trim()); log('config', `Saved manual host ${b.host}`); broadcastState(); return json(res, 200, snapshot()); }
  if (req.method === 'POST' && pathname === '/api/search') { const b = await bodyJson(req); devices = await discover(b.brand || 'all', store.manualHosts(), log); broadcastState(); return json(res, 200, devices); }
  if (req.method === 'POST' && pathname === '/api/connect') { const b = await bodyJson(req); const out = await hub.connect(b.device); broadcastState(); return json(res, 200, out); }
  if (req.method === 'POST' && pathname === '/api/connectLast') { const d = store.getLastDevice(); if (!d) throw new Error('No last TV saved'); const out = await hub.connect(d); broadcastState(); return json(res, 200, out); }
  if (req.method === 'POST' && pathname === '/api/command') { const b = await bodyJson(req); const out = await hub.command(b.cmd, b.payload || {}); return json(res, 200, out); }
  if (req.method === 'POST' && pathname === '/api/nowPlaying') { const out = await hub.nowPlaying(); broadcast('media:update', out); return json(res, 200, out); }
  json(res, 404, { error: 'not found' });
} catch(e) { fail(res, e); } }
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1');
  if (u.pathname === '/events') { res.writeHead(200, { 'content-type':'text/event-stream', 'cache-control':'no-cache', connection:'keep-alive', 'x-accel-buffering':'no' }); clients.add(res); sendSse(res, 'state:update', snapshot()); sendSse(res, 'theme:set', currentTheme); log('app', 'Browser client attached'); req.on('close', () => clients.delete(res)); return; }
  if (u.pathname.startsWith('/api/')) return api(req, res, u.pathname);
  const file = u.pathname === '/' ? 'index.html' : u.pathname.replace(/^\//, '');
  const resolved = path.normalize(path.join(rendererDir, file));
  if (!resolved.startsWith(rendererDir)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(resolved, (err, data) => { if (err) { res.writeHead(404); res.end('not found'); } else { res.writeHead(200, { 'content-type': contentType(resolved), 'cache-control':'no-store' }); res.end(data); } });
});
server.listen(Number(process.env.SMART_REMOTE_STUDIO_PORT || 0), '127.0.0.1', () => { const actual = server.address().port; if (process.env.SRS_PORT_FILE) fs.writeFileSync(process.env.SRS_PORT_FILE, String(actual)); console.log(`SMART_REMOTE_STUDIO_PORT=${actual}`); log('app', `Voltix server listening on 127.0.0.1:${actual}`); });
function close() { try { hub.close(); } catch (_) {} server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 1000).unref(); }
process.on('SIGTERM', close); process.on('SIGINT', close);
