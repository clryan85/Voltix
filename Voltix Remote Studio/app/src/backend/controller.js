'use strict';
const { LGClient } = require('./lg');
const { RokuClient } = require('./roku');
const { SamsungClient } = require('./samsung');
class ControllerHub {
  constructor(store, status = () => {}) { this.store = store; this.status = status; this.client = null; this.device = null; }
  makeClient(device) { if (device.brand === 'lg') return new LGClient(device, this.store, this.status); if (device.brand === 'roku') return new RokuClient(device, this.store, this.status); if (device.brand === 'samsung') return new SamsungClient(device, this.store, this.status); throw new Error(`Unsupported brand: ${device.brand}`); }
  async connect(device) { if (this.client) this.client.close(); this.device = device; this.client = this.makeClient(device); await this.client.connect(); this.store.setLastDevice(device); return { connected: true, device }; }
  async command(cmd, payload) { if (!this.client) throw new Error('No TV connected'); const res = await this.client.command(cmd, payload || {}); this.status('command', `${cmd} sent`); return res; }
  async nowPlaying() { if (!this.client) return { title: 'No TV connected', subtitle: 'Connect to a TV first', thumbnail: '', raw: {} }; return this.client.nowPlaying(); }
  close() { if (this.client) this.client.close(); this.client = null; }
}
module.exports = { ControllerHub };
