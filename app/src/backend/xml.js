'use strict';
function tag(text, name) {
  const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i');
  const m = text.match(re); return m ? decode(m[1].trim()) : '';
}
function attr(text, name) {
  const re = new RegExp(`${name}=["']([^"']+)["']`, 'i');
  const m = text.match(re); return m ? decode(m[1]) : '';
}
function decode(s) { return String(s || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"); }
module.exports = { tag, attr };
