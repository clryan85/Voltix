'use strict';
const assert = require('node:assert/strict');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { ConfigStore } = require('../src/backend/config');
const { LGClient } = require('../src/backend/lg');
const { RokuClient } = require('../src/backend/roku');
const { SamsungClient } = require('../src/backend/samsung');
const { uniqDevices } = require('../src/backend/discovery');
const { startLG, startRoku, startSamsung } = require('../tests/mock_servers');
function store() { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'wrs-test-')); return new ConfigStore(d); }
function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
(async () => {
  const results = [];
  let mock = startLG(); await wait(80);
  let c = new LGClient({ brand: 'lg', host: '127.0.0.1', securePort: null, insecurePort: 13001, name: 'Mock LG' }, store(), () => {});
  await c.connect(); await c.command('volumeUp'); await c.command('up'); let media = await c.nowPlaying();
  assert.equal(media.title, 'YouTube'); assert.ok(mock.pointerMessages.some(x => x.includes('name:UP')));
  c.close(); mock.close(); results.push('lg_mock_pass'); await wait(50);

  mock = startRoku(); await wait(80);
  c = new RokuClient({ brand: 'roku', host: '127.0.0.1', port: 18060, name: 'Mock Roku' }, store(), () => {});
  await c.connect(); await c.command('home'); media = await c.nowPlaying();
  assert.equal(media.title, 'Mock Channel'); assert.ok(mock.commands.includes('/keypress/Home'));
  mock.close(); results.push('roku_mock_pass'); await wait(50);

  mock = startSamsung(); await wait(80); const s = store();
  c = new SamsungClient({ brand: 'samsung', host: '127.0.0.1', securePort: null, insecurePort: 18001, name: 'Mock Samsung' }, s, () => {});
  await c.connect(); await wait(80); await c.command('volumeUp'); await wait(80);
  assert.equal(s.tokenFor('127.0.0.1'), 'mock-samsung-token'); assert.equal(mock.commands[0].params.DataOfCmd, 'KEY_VOLUP');
  c.close(); mock.close(); results.push('samsung_mock_pass');

  const merged = uniqDevices([{ brand: 'lg', host: '1.2.3.4', name: 'A', capabilities: ['a'] }, { brand: 'lg', host: '1.2.3.4', name: 'B', capabilities: ['b'] }]);
  assert.equal(merged.length, 1); assert.deepEqual(merged[0].capabilities.sort(), ['a','b']); results.push('merge_pass');
  console.log(JSON.stringify({ mock_smoke: 'pass', results }, null, 2));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
