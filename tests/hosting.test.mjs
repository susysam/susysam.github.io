import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

execFileSync(process.execPath, ['scripts/build-site.mjs'], { stdio: 'pipe' });
test('hosting build contains the entry page and excludes development/private metadata', () => {
  assert.match(fs.readFileSync('dist/index.html', 'utf8'), /Welcome to/);
  for (const excluded of ['.git', '.github', '.firebaserc', 'firestore.rules', 'FIREBASE-SETUP.md', 'tests', 'package.json', 'deployment']) {
    assert.equal(fs.existsSync(path.join('dist', excluded)), false, excluded + ' must not be hosted');
  }
});
test('built static pages can resolve their local links, styles and scripts', () => {
  for (const entry of fs.readdirSync('dist').filter(name => name.endsWith('.html'))) {
    const html = fs.readFileSync(path.join('dist', entry), 'utf8');
    for (const [, value] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
      if (/^(?:[a-z]+:|\/\/|#)/i.test(value) || value.includes('${')) continue;
      const localPath = decodeURIComponent(value.split(/[?#]/)[0]);
      if (!localPath) continue;
      assert(fs.existsSync(path.join('dist', localPath)), entry + ': missing public asset ' + localPath);
    }
  }
});
test('Hosting targets the existing Firebase project with a bounded public directory and no SPA catch-all', () => {
  const config = JSON.parse(fs.readFileSync('firebase.json','utf8'));
  const project = JSON.parse(fs.readFileSync('.firebaserc','utf8')).projects.default;
  const client = fs.readFileSync('firebase-config.js','utf8');
  assert(client.includes("projectId: '"+project+"'"));
  assert.equal(config.hosting.site, 'susysam-2ae6e');
  assert.equal(config.hosting.public, 'dist');
  assert.equal(config.hosting.rewrites, undefined);
});
