'use strict';
class StatusLog {
  constructor(limit = 160) { this.limit = limit; this.lines = []; this.listeners = new Set(); }
  push(type, message, data = undefined) {
    const entry = { time: new Date().toISOString(), type, message, data };
    this.lines.push(entry); if (this.lines.length > this.limit) this.lines.shift();
    for (const listener of this.listeners) { try { listener(entry); } catch (_) {} }
    return entry;
  }
  on(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  snapshot() { return this.lines.slice(); }
}
module.exports = { StatusLog };
