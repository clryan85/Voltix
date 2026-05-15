'use strict';
const dgram = require('dgram');
const net = require('net');
const os = require('os');
const { request } = require('./http');
const { tag } = require('./xml');

const SSDP_ADDR = '239.255.255.250';
const SSDP_PORT = 1900;
const TARGETS = {
  lg: ['urn:lge-com:service:webos-second-screen:1', 'urn:schemas-upnp-org:device:MediaRenderer:1', 'ssdp:all'],
  samsung: ['urn:samsung.com:device:RemoteControlReceiver:1', 'urn:schemas-upnp-org:device:MediaRenderer:1', 'ssdp:all'],
  roku: ['roku:ecp', 'ssdp:all']
};

function interfaces() {
  const out = [];
  for (const [name, rows] of Object.entries(os.networkInterfaces())) {
    for (const row of rows || []) {
      if (row.family === 'IPv4' && !row.internal) {
        const parts = row.address.split('.').map(Number);
        out.push({ name, address: row.address, prefix24: `${parts[0]}.${parts[1]}.${parts[2]}.` });
      }
    }
  }
  return out;
}
function uniqDevices(devices) {
  const map = new Map();
  for (const d of devices) {
    const key = `${d.brand}:${d.host}`;
    const old = map.get(key) || {};
    map.set(key, { ...old, ...d, capabilities: Array.from(new Set([...(old.capabilities || []), ...(d.capabilities || [])])) });
  }
  return Array.from(map.values()).sort((a,b) => `${a.brand}:${a.host}`.localeCompare(`${b.brand}:${b.host}`));
}
function parseHostFromLocation(location) {
  try { return new URL(location).hostname; } catch (_) { return ''; }
}
function identifyFromText(text, fallbackBrand) {
  const lower = text.toLowerCase();
  if (lower.includes('roku')) return 'roku';
  if (lower.includes('samsung')) return 'samsung';
  if (lower.includes('lge') || lower.includes('lg electronics') || lower.includes('webos')) return 'lg';
  return fallbackBrand;
}
async function fetchDescription(location, fallbackBrand) {
  let detail = { name: '', model: '', manufacturer: '', brand: fallbackBrand };
  if (!location) return detail;
  try {
    const res = await request('GET', location, '', 1200);
    detail.name = tag(res.body, 'friendlyName') || tag(res.body, 'modelName') || '';
    detail.model = tag(res.body, 'modelName') || tag(res.body, 'modelNumber') || '';
    detail.manufacturer = tag(res.body, 'manufacturer') || '';
    detail.brand = identifyFromText(`${detail.manufacturer} ${detail.name} ${detail.model} ${res.body}`, fallbackBrand);
  } catch (_) {}
  return detail;
}
async function ssdpSearch(brand = 'all', status = () => {}) {
  const brands = brand === 'all' ? ['lg', 'samsung', 'roku'] : [brand];
  const targets = Array.from(new Set(brands.flatMap(b => TARGETS[b] || []).filter(Boolean)));
  const ifaces = interfaces();
  const found = [];
  await Promise.all(ifaces.map(iface => new Promise(resolve => {
    const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    const seen = new Set();
    const timer = setTimeout(() => { try { sock.close(); } catch (_) {} resolve(); }, 2600);
    sock.on('message', async (msg, rinfo) => {
      const text = msg.toString('utf8');
      const key = `${rinfo.address}:${text}`;
      if (seen.has(key)) return; seen.add(key);
      const headers = Object.fromEntries(text.split(/\r?\n/).map(line => {
        const i = line.indexOf(':'); return i > 0 ? [line.slice(0,i).trim().toLowerCase(), line.slice(i+1).trim()] : null;
      }).filter(Boolean));
      const location = headers.location || '';
      const detail = await fetchDescription(location, identifyFromText(text, 'lg'));
      const host = parseHostFromLocation(location) || rinfo.address;
      if (!brands.includes(detail.brand) && brand !== 'all') return;
      found.push({ id: `${detail.brand}:${host}`, brand: detail.brand, host, name: detail.name || `${detail.brand.toUpperCase()} TV (${host})`, model: detail.model, manufacturer: detail.manufacturer, location, discoveryMethod: 'ssdp', capabilities: ['discovery'] });
    });
    sock.on('error', () => { clearTimeout(timer); try { sock.close(); } catch (_) {} resolve(); });
    sock.bind(0, iface.address, () => {
      try { sock.setMulticastInterface(iface.address); } catch (_) {}
      status('scan', `SSDP search on ${iface.name} ${iface.address}`);
      for (const st of targets) {
        const packet = Buffer.from([
          'M-SEARCH * HTTP/1.1',
          `HOST: ${SSDP_ADDR}:${SSDP_PORT}`,
          'MAN: "ssdp:discover"',
          'MX: 2',
          `ST: ${st}`,
          '', ''
        ].join('\r\n'));
        for (let i = 0; i < 2; i++) sock.send(packet, 0, packet.length, SSDP_PORT, SSDP_ADDR);
      }
    });
  })));
  return uniqDevices(found);
}
function portOpen(host, port, timeoutMs = 260) {
  return new Promise(resolve => {
    const sock = net.createConnection({ host, port });
    const done = ok => { try { sock.destroy(); } catch (_) {} resolve(ok); };
    sock.setTimeout(timeoutMs);
    sock.on('connect', () => done(true));
    sock.on('timeout', () => done(false));
    sock.on('error', () => done(false));
  });
}
async function probeHost(host, brand = 'all') {
  const devices = [];
  const want = b => brand === 'all' || brand === b;
  if (want('roku')) {
    try {
      const res = await request('GET', `http://${host}:8060/query/device-info`, '', 500);
      if (res.status < 500 && /roku|device-info/i.test(res.body)) {
        devices.push({ id: `roku:${host}`, brand: 'roku', host, name: tag(res.body, 'friendly-device-name') || tag(res.body, 'model-name') || `Roku (${host})`, model: tag(res.body, 'model-name') || tag(res.body, 'model-number'), manufacturer: 'Roku', discoveryMethod: 'probe', capabilities: ['ecp'] });
      }
    } catch (_) {}
  }
  if (want('lg')) {
    const secure = await portOpen(host, 3001, 260);
    const insecure = secure ? false : await portOpen(host, 3000, 260);
    if (secure || insecure) devices.push({ id: `lg:${host}`, brand: 'lg', host, name: `LG webOS TV (${host})`, model: '', manufacturer: 'LG Electronics', securePort: secure ? 3001 : null, insecurePort: insecure ? 3000 : null, discoveryMethod: 'probe', capabilities: ['webos'] });
  }
  if (want('samsung')) {
    const secure = await portOpen(host, 8002, 260);
    const insecure = secure ? false : await portOpen(host, 8001, 260);
    if (secure || insecure) devices.push({ id: `samsung:${host}`, brand: 'samsung', host, name: `Samsung TV (${host})`, model: '', manufacturer: 'Samsung', securePort: secure ? 8002 : null, insecurePort: insecure ? 8001 : null, discoveryMethod: 'probe', capabilities: ['tizen-remote'] });
  }
  return devices;
}
async function probeLan(brand = 'all', manualHosts = [], status = () => {}) {
  const hosts = new Set(manualHosts.filter(Boolean));
  for (const iface of interfaces()) for (let i = 1; i < 255; i++) hosts.add(`${iface.prefix24}${i}`);
  const list = Array.from(hosts);
  const found = [];
  let index = 0;
  async function worker() {
    while (index < list.length) {
      const host = list[index++];
      const hits = await probeHost(host, brand);
      if (hits.length) { status('scan', `Probe found ${hits.map(h => h.name).join(', ')}`); found.push(...hits); }
    }
  }
  await Promise.all(Array.from({ length: 80 }, worker));
  return uniqDevices(found);
}
async function discover(brand = 'all', manualHosts = [], status = () => {}) {
  status('scan', `Starting ${brand} TV discovery`);
  const [a, b] = await Promise.all([ssdpSearch(brand, status), probeLan(brand, manualHosts, status)]);
  const result = uniqDevices([...a, ...b]);
  status('scan', `Discovery complete: ${result.length} device(s)`);
  return result;
}
module.exports = { discover, ssdpSearch, probeLan, probeHost, interfaces, uniqDevices, portOpen };
