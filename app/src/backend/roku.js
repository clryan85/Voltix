'use strict';
const { request } = require('./http');
const { tag, attr } = require('./xml');
class RokuClient {
  constructor(device, store, status = () => {}) { this.device = device; this.host = device.host; this.port = device.port || 8060; this.status = status; }
  async connect() { await request('GET', `http://${this.host}:${this.port}/query/device-info`, '', 1500); this.status('connect', `Roku connected at ${this.host}:8060`); return true; }
  keyFor(cmd) { return { up:'Up', down:'Down', left:'Left', right:'Right', ok:'Select', back:'Back', home:'Home', info:'Info', volumeUp:'VolumeUp', volumeDown:'VolumeDown', mute:'VolumeMute', channelUp:'ChannelUp', channelDown:'ChannelDown', play:'Play', pause:'Play', stop:'Back', rewind:'Rev', forward:'Fwd', powerOff:'PowerOff', powerOn:'PowerOn', input:'InputHDMI1' }[cmd]; }
  async command(cmd, payload = {}) {
    if (cmd === 'launchApp') return request('POST', `http://${this.host}:${this.port}/launch/${encodeURIComponent(payload.appId)}`, '', 1500);
    if (cmd === 'text') {
      for (const ch of String(payload.text || '')) await request('POST', `http://${this.host}:${this.port}/keypress/Lit_${encodeURIComponent(ch)}`, '', 1500);
      return { ok: true };
    }
    const key = this.keyFor(cmd); if (!key) throw new Error(`Roku command not mapped: ${cmd}`);
    return request('POST', `http://${this.host}:${this.port}/keypress/${key}`, '', 1500);
  }
  async apps() { const res = await request('GET', `http://${this.host}:${this.port}/query/apps`, '', 1500); const apps = [...res.body.matchAll(/<app[^>]*id="([^"]+)"[^>]*>([^<]+)<\/app>/gi)].map(m => ({ id: m[1], name: m[2] })); return apps; }
  async nowPlaying() { const res = await request('GET', `http://${this.host}:${this.port}/query/active-app`, '', 1500); const appId = attr(res.body, 'id') || attr(res.body, 'app-id') || ''; const title = tag(res.body, 'app') || 'Roku'; return { title, subtitle: appId || 'Roku active app', thumbnail: appId ? `http://${this.host}:${this.port}/query/icon/${appId}` : '', raw: res.body }; }
  close() {}
}
module.exports = { RokuClient };
