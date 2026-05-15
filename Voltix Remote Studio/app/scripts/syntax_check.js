'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const files = [];
function walk(dir) {
  for (const item of fs.readdirSync(dir)) {
    const p = path.join(dir, item);
    const st = fs.statSync(p);
    if (st.isDirectory() && !['node_modules','.git','dist'].includes(item)) walk(p);
    else if (st.isFile() && p.endsWith('.js')) files.push(p);
  }
}
walk(root);
for (const f of files) new vm.Script(fs.readFileSync(f, 'utf8'), { filename: f });
console.log(JSON.stringify({ syntax: 'pass', files: files.length }, null, 2));
