'use strict';
const http = require('http');
const WebSocket = require('ws');
function startLG() {
  const pointer = new WebSocket.Server({ port: 13002 });
  const pointerMessages = [];
  pointer.on('connection', ws => ws.on('message', m => pointerMessages.push(String(m))));
  const wss = new WebSocket.Server({ port: 13001 });
  const messages = [];
  wss.on('connection', ws => ws.on('message', raw => {
    const msg = JSON.parse(String(raw)); messages.push(msg);
    if (msg.type === 'register') {
      ws.send(JSON.stringify({ id: msg.id, type: 'response', payload: { pairingType: 'PROMPT', returnValue: true } }));
      setTimeout(() => ws.send(JSON.stringify({ type: 'registered', payload: { 'client-key': 'mock-lg-key' } })), 40);
    }
    else if (msg.uri === 'ssap://com.webos.service.networkinput/getPointerInputSocket') ws.send(JSON.stringify({ id: msg.id, type: 'response', payload: { socketPath: 'ws://127.0.0.1:13002/pointer' } }));
    else if (msg.uri === 'ssap://com.webos.applicationManager/getForegroundAppInfo') ws.send(JSON.stringify({ id: msg.id, type: 'response', payload: { appId: 'youtube.leanback.v4', title: 'YouTube' } }));
    else if (msg.uri === 'ssap://com.webos.applicationManager/listLaunchPoints') ws.send(JSON.stringify({ id: msg.id, type: 'response', payload: { launchPoints: [{ id: 'youtube.leanback.v4', title: 'YouTube', largeIcon: 'http://127.0.0.1/icon.png' }] } }));
    else ws.send(JSON.stringify({ id: msg.id, type: 'response', payload: { returnValue: true } }));
  }));
  return { close: () => { wss.close(); pointer.close(); }, messages, pointerMessages };
}
function startRoku() {
  const commands = [];
  const server = http.createServer((req, res) => {
    commands.push(req.url);
    if (req.url === '/query/device-info') return res.end('<device-info><friendly-device-name>Mock Roku</friendly-device-name><model-name>Roku Ultra</model-name></device-info>');
    if (req.url === '/query/active-app') return res.end('<active-app><app id="12">Mock Channel</app></active-app>');
    if (req.url === '/query/apps') return res.end('<apps><app id="12">Mock Channel</app></apps>');
    if (req.url.startsWith('/query/icon/')) { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(Buffer.from('')); }
    res.writeHead(200); res.end('OK');
  }).listen(18060);
  return { close: () => server.close(), commands };
}
function startSamsung() {
  const wss = new WebSocket.Server({ port: 18001 });
  const commands = [];
  wss.on('connection', ws => {
    ws.send(JSON.stringify({ event: 'ms.channel.connect', data: { token: 'mock-samsung-token' } }));
    ws.on('message', m => commands.push(JSON.parse(String(m))));
  });
  return { close: () => wss.close(), commands };
}
module.exports = { startLG, startRoku, startSamsung };
