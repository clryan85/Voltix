'use strict';
const fs = require('fs');
const path = require('path');
function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
class ConfigStore {
  constructor(userDataDir) {
    this.userDataDir = userDataDir;
    ensureDir(userDataDir);
    this.file = path.join(userDataDir, 'voltix-remote-studio.json');
    this.legacyFiles = [
      path.join(path.dirname(userDataDir), 'SmartRemoteStudio', 'smart-remote-studio.json'),
      path.join(path.dirname(userDataDir), ['Web','Remote','Studio'].join(''), ['web','remote','studio'].join('-') + '.json')
    ];
    this.state = { keys: {}, tokens: {}, lastDevice: null, manualHosts: [] };
    this.load();
  }
  load() {
    try {
      if (!fs.existsSync(this.file)) {
        const legacy = this.legacyFiles.find(f => fs.existsSync(f));
        if (legacy) {
          ensureDir(this.userDataDir);
          fs.copyFileSync(legacy, this.file);
        }
      }
      if (fs.existsSync(this.file)) this.state = { ...this.state, ...JSON.parse(fs.readFileSync(this.file, 'utf8')) };
    } catch (_) {}
  }
  save() { ensureDir(this.userDataDir); fs.writeFileSync(this.file, JSON.stringify(this.state, null, 2)); }
  keyFor(host) { return this.state.keys[host] || null; }
  setKey(host, key) { this.state.keys[host] = key; this.save(); }
  tokenFor(host) { return this.state.tokens[host] || null; }
  setToken(host, token) { this.state.tokens[host] = token; this.save(); }
  setLastDevice(device) { this.state.lastDevice = device; this.save(); }
  getLastDevice() { return this.state.lastDevice || null; }
  addManualHost(host) { if (host && !this.state.manualHosts.includes(host)) { this.state.manualHosts.push(host); this.save(); } }
  manualHosts() { return this.state.manualHosts.slice(); }
}
module.exports = { ConfigStore };
