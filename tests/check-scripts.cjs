const fs = require('node:fs');
const vm = require('node:vm');
const cp = require('node:child_process');
let scripts = 0;
for (const file of fs.readdirSync('.')) {
  if (file.endsWith('.js')) {
    cp.execFileSync(process.execPath, ['--check', file], {stdio:'pipe'});
    scripts++;
  }
  if (file.endsWith('.html')) {
    const html = fs.readFileSync(file, 'utf8');
    for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (!match[2].trim() || /\btype=["']module/.test(match[1])) continue;
      new vm.Script(match[2], {filename:file}); scripts++;
    }
    if ((html.match(/src="\/firebase-config.js"/g) || []).length !== 1) {
      throw new Error('Expected one Firebase module on page: ' + file);
    }
  }
}
console.log('PASS: ' + scripts + ' JavaScript files and inline scripts parse; all root pages load one account module.');
