'use strict';
const http = require('http');
const https = require('https');
function request(method, urlString, body = '', timeoutMs = 1500, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlString);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request({ method, hostname: u.hostname, port: u.port, path: `${u.pathname}${u.search}`, timeout: timeoutMs, rejectUnauthorized: false, headers }, res => {
      const chunks = [];
      res.on('data', d => chunks.push(Buffer.from(d)));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}
module.exports = { request };
