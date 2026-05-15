'use strict';
const WebSocket = require('ws');

const LG_MANIFEST = {
  forcePairing: false,
  pairingType: 'PROMPT',
  manifest: {
    manifestVersion: 1,
    appVersion: '1.1',
    signed: {
      created: '20140509',
      appId: 'com.lge.test',
      vendorId: 'com.lge',
      localizedAppNames: { '': 'LG Remote App', 'ko-KR': '리모컨 앱', 'zxx-XX': 'ЛГ Rэмotэ AПП' },
      localizedVendorNames: { '': 'LG Electronics' },
      permissions: [
        'TEST_SECURE', 'CONTROL_INPUT_TEXT', 'CONTROL_MOUSE_AND_KEYBOARD', 'READ_INSTALLED_APPS',
        'READ_LGE_SDX', 'READ_NOTIFICATIONS', 'SEARCH', 'WRITE_SETTINGS', 'WRITE_NOTIFICATION_ALERT',
        'CONTROL_POWER', 'READ_CURRENT_CHANNEL', 'READ_RUNNING_APPS', 'READ_UPDATE_INFO',
        'UPDATE_FROM_REMOTE_APP', 'READ_LGE_TV_INPUT_EVENTS', 'READ_TV_CURRENT_TIME'
      ],
      serial: '2f930e2d2cfe083771f68e4fe7bb07'
    },
    permissions: [
      'LAUNCH', 'LAUNCH_WEBAPP', 'APP_TO_APP', 'CLOSE', 'TEST_OPEN', 'TEST_PROTECTED',
      'CONTROL_AUDIO', 'CONTROL_DISPLAY', 'CONTROL_INPUT_JOYSTICK', 'CONTROL_INPUT_MEDIA_RECORDING',
      'CONTROL_INPUT_MEDIA_PLAYBACK', 'CONTROL_INPUT_TV', 'CONTROL_POWER', 'READ_APP_STATUS',
      'READ_CURRENT_CHANNEL', 'READ_INPUT_DEVICE_LIST', 'READ_NETWORK_STATE', 'READ_RUNNING_APPS',
      'READ_TV_CHANNEL_LIST', 'WRITE_NOTIFICATION_TOAST', 'READ_POWER_STATE', 'READ_COUNTRY_INFO',
      'READ_SETTINGS', 'CONTROL_TV_SCREEN', 'CONTROL_TV_STANBY', 'CONTROL_FAVORITE_GROUP',
      'CONTROL_USER_INFO', 'CHECK_BLUETOOTH_DEVICE', 'CONTROL_BLUETOOTH', 'CONTROL_TIMER_INFO',
      'STB_INTERNAL_CONNECTION', 'CONTROL_RECORDING', 'READ_RECORDING_STATE', 'WRITE_RECORDING_LIST',
      'READ_RECORDING_LIST', 'READ_RECORDING_SCHEDULE', 'WRITE_RECORDING_SCHEDULE',
      'READ_STORAGE_DEVICE_LIST', 'READ_TV_PROGRAM_INFO', 'CONTROL_BOX_CHANNEL',
      'READ_TV_ACR_AUTH_TOKEN', 'READ_TV_CONTENT_STATE', 'READ_TV_CURRENT_TIME',
      'ADD_LAUNCHER_CHANNEL', 'SET_CHANNEL_SKIP', 'RELEASE_CHANNEL_SKIP', 'CONTROL_CHANNEL_BLOCK',
      'DELETE_SELECT_CHANNEL', 'CONTROL_CHANNEL_GROUP', 'SCAN_TV_CHANNELS', 'CONTROL_TV_POWER', 'CONTROL_WOL'
    ],
    signatures: [
      {
        signatureVersion: 1,
        signature: 'eyJhbGdvcml0aG0iOiJSU0EtU0hBMjU2Iiwia2V5SWQiOiJ0ZXN0LXNpZ25pbmctY2VydCIsInNpZ25hdHVyZVZlcnNpb24iOjF9.hrVRgjCwXVvE2OOSpDZ58hR+59aFNwYDyjQgKk3auukd7pcegmE2CzPCa0bJ0ZsRAcKkCTJrWo5iDzNhMBWRyaMOv5zWSrthlf7G128qvIlpMT0YNY+n/FaOHE73uLrS/g7swl3/qH/BGFG2Hu4RlL48eb3lLKqTt2xKHdCs6Cd4RMfJPYnzgvI4BNrFUKsjkcu+WD4OO2A27Pq1n50cMchmcaXadJhGrOqH5YmHdOCj5NSHzJYrsW0HPlpuAx/ECMeIZYDh6RMqaFM2DXzdKX9NmmyqzJ3o/0lkk/N97gfVRLW5hA29yeAwaCViZNCP8iC9aO0q9fQojoa7NQnAtw=='
      }
    ]
  }
};

class LGClient {
  constructor(device, store, status = () => {}) {
    this.device = device;
    this.host = device.host;
    this.store = store;
    this.status = status;
    this.ws = null;
    this.pending = new Map();
    this.registerWait = null;
    this.counter = 0;
    this.connected = false;
    this.pointerSocket = null;
  }

  _urlCandidates() {
    const out = [];
    if (this.device.securePort !== null) out.push(`wss://${this.host}:${this.device.securePort || 3001}`);
    out.push(`wss://${this.host}:3001`);
    if (this.device.insecurePort !== null) out.push(`ws://${this.host}:${this.device.insecurePort || 3000}`);
    out.push(`ws://${this.host}:3000`);
    return [...new Set(out)];
  }

  async connect() {
    let lastErr;
    for (const url of this._urlCandidates()) {
      try {
        await this._connectUrl(url);
        this.status('connect', `LG registered at ${url}`);
        return true;
      } catch (e) {
        lastErr = e;
        this.status('connect', `LG connect failed at ${url}: ${e.message}`);
        this.closeSocketOnly();
      }
    }
    throw lastErr || new Error('LG connection failed');
  }

  _connectUrl(url) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url, { rejectUnauthorized: false, handshakeTimeout: 3500 });
      let settled = false;
      const finish = (err) => {
        if (settled) return;
        settled = true;
        if (err) reject(err); else resolve(true);
      };
      const timeout = setTimeout(() => finish(new Error('pairing timeout: approve the Voltix prompt on the TV')), 90000);
      ws.on('open', () => {
        this.ws = ws;
        ws.on('message', data => this._onMessage(String(data)));
        ws.on('close', () => { this.connected = false; this.status('connect', 'LG socket closed'); });
        ws.on('error', err => this.status('error', err.message || String(err)));
        const payload = JSON.parse(JSON.stringify(LG_MANIFEST));
        const key = this.store.keyFor(this.host);
        if (key) {
          payload['client-key'] = key;
          this.status('connect', 'Stored LG client key found; registering without TV prompt');
        } else {
          this.status('connect', 'No stored LG client key; approve the TV pairing prompt once');
        }
        this._register(payload).then(() => { clearTimeout(timeout); finish(); }).catch(err => { clearTimeout(timeout); finish(err); });
      });
      ws.on('error', err => { clearTimeout(timeout); finish(err); });
    });
  }

  _register(payload) {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return reject(new Error('LG socket not connected'));
      const id = `wrs_register_${Date.now()}_${this.counter++}`;
      const timer = setTimeout(() => {
        this.registerWait = null;
        this.pending.delete(id);
        reject(new Error('TV did not finish pairing registration'));
      }, 88000);
      this.registerWait = { resolve, reject, timer, id };
      this.pending.set(id, { kind: 'register', resolve, reject, timer });
      this.ws.send(JSON.stringify({ id, type: 'register', payload }));
    });
  }

  _completeRegistration(key) {
    if (!key) return;
    this.store.setKey(this.host, key);
    this.connected = true;
    this.status('connect', 'TV pairing accepted; LG client key saved');
    if (this.registerWait) {
      clearTimeout(this.registerWait.timer);
      const { resolve, id } = this.registerWait;
      this.pending.delete(id);
      this.registerWait = null;
      resolve({ 'client-key': key });
    }
  }

  _onMessage(text) {
    let msg;
    try { msg = JSON.parse(text); } catch (_) { return; }
    const key = msg.payload && msg.payload['client-key'];
    if (key && (msg.type === 'registered' || msg.type === 'response')) this._completeRegistration(key);
    if (msg.type === 'registered' && !key && this.registerWait) this.status('connect', 'TV registration event received; waiting for client key');

    if (msg.id && this.pending.has(msg.id)) {
      const pending = this.pending.get(msg.id);
      if (msg.type === 'error') {
        clearTimeout(pending.timer);
        this.pending.delete(msg.id);
        if (pending.kind === 'register') this.registerWait = null;
        pending.reject(new Error(msg.error || msg.payload?.errorText || msg.payload?.message || 'LG command error'));
        return;
      }
      if (pending.kind === 'register') {
        if (key) return;
        this.status('connect', 'TV pairing prompt is open; approve Voltix on the TV');
        return;
      }
      clearTimeout(pending.timer);
      this.pending.delete(msg.id);
      pending.resolve(msg.payload || {});
    }
  }

  _sendRaw(type, uri, payload = {}, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return reject(new Error('LG socket not connected'));
      if (!this.connected && type !== 'register') return reject(new Error('LG TV is not registered yet; approve the TV prompt first'));
      const id = `wrs_${Date.now()}_${this.counter++}`;
      const msg = { id, type, payload };
      if (uri) msg.uri = uri;
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('LG command timeout')); }, timeoutMs || 8000);
      this.pending.set(id, { kind: 'request', resolve, reject, timer });
      this.ws.send(JSON.stringify(msg));
    });
  }

  request(uri, payload = {}) { return this._sendRaw('request', uri, payload); }

  async command(cmd, payload = {}) {
    const buttonMap = {
      up:'UP', down:'DOWN', left:'LEFT', right:'RIGHT', ok:'ENTER', back:'BACK', home:'HOME', exit:'EXIT',
      info:'INFO', menu:'MENU', settings:'MENU', input:'INPUT', channelUp:'CHANNELUP', channelDown:'CHANNELDOWN',
      play:'PLAY', pause:'PAUSE', stop:'STOP', rewind:'REWIND', forward:'FASTFORWARD', red:'RED', green:'GREEN', yellow:'YELLOW', blue:'BLUE',
      digit0:'0', digit1:'1', digit2:'2', digit3:'3', digit4:'4', digit5:'5', digit6:'6', digit7:'7', digit8:'8', digit9:'9', list:'LIST', guide:'GUIDE'
    };
    if (buttonMap[cmd]) return this.button(buttonMap[cmd]);
    if (cmd === 'volumeUp') return this.request('ssap://audio/volumeUp');
    if (cmd === 'volumeDown') return this.request('ssap://audio/volumeDown');
    if (cmd === 'mute') return this.request('ssap://audio/setMute', { mute: true });
    if (cmd === 'powerOff') return this.request('ssap://system/turnOff');
    if (cmd === 'launchApp') return this.request('ssap://system.launcher/launch', { id: payload.appId });
    if (cmd === 'toast') return this.request('ssap://system.notifications/createToast', { message: payload.message || 'Voltix Remote Studio' });
    if (cmd === 'text') return this.request('ssap://com.webos.service.ime/insertText', { text: payload.text || '', replace: 0 });
    if (cmd === 'enterText') return this.request('ssap://com.webos.service.ime/sendEnterKey');
    throw new Error(`LG command not mapped: ${cmd}`);
  }

  async button(name) {
    const sock = await this._pointer();
    sock.send(`type:button\nname:${name}\n\n`);
    return { returnValue: true, button: name };
  }

  async _pointer() {
    if (this.pointerSocket && this.pointerSocket.readyState === WebSocket.OPEN) return this.pointerSocket;
    const res = await this.request('ssap://com.webos.service.networkinput/getPointerInputSocket');
    const url = res.socketPath;
    if (!url) throw new Error('LG pointer socket missing');
    this.pointerSocket = await new Promise((resolve, reject) => {
      const ws = new WebSocket(url, { rejectUnauthorized: false, handshakeTimeout: 4000 });
      ws.on('open', () => { this.status('connect', 'LG pointer button socket ready'); resolve(ws); });
      ws.on('error', reject);
      ws.on('close', () => { this.pointerSocket = null; });
    });
    return this.pointerSocket;
  }

  async nowPlaying() {
    let app = {}; let launches = [];
    try { app = await this.request('ssap://com.webos.applicationManager/getForegroundAppInfo'); } catch (e) { this.status('media', `foreground app unavailable: ${e.message}`); }
    try { const r = await this.request('ssap://com.webos.applicationManager/listLaunchPoints'); launches = r.launchPoints || r || []; } catch (e) { this.status('media', `launch artwork unavailable: ${e.message}`); }
    const id = app.appId || app.id || app.processId || '';
    const lp = Array.isArray(launches) ? launches.find(x => x.id === id || x.launchPointId === id) : null;
    return { title: app.title || lp?.title || lp?.name || id || 'Current LG app', subtitle: id || 'LG webOS exposes app status, not a live video feed', thumbnail: lp?.largeIcon || lp?.icon || '', raw: app };
  }

  closeSocketOnly() { try { if (this.ws) this.ws.close(); } catch (_) {} this.ws = null; }
  close() { try { if (this.pointerSocket) this.pointerSocket.close(); } catch (_) {} this.closeSocketOnly(); }
}
module.exports = { LGClient, LG_MANIFEST };
