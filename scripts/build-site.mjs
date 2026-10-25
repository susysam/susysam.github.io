import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist');
// Explicit allowlist: never publish docs, rules, tests, credentials or repository metadata.
export const publicFiles = [
  'index.html', 'start27.html', 'settings.html', 'games.html', 'movie+tv.html',
  'tabs.html', 'search.html', 'about.html', '404.html', 'games/index.html',
  'site-storage.js', 'site-appearance.js', 'site-navigation.css', 'site-data.js',
  'local-profile.js', 'direct-link-timer.js', 'account-errors.js', 'account-ui.js',
  'account-ui.css', 'cloud-sync-core.js', 'firebase-config.js', 'sync-presentation.js',
  'time-preferences.js', 'site-clock.js', 'settings-navigation.js', 'settings-layout.css',
  'images/mc.png', 'images/A1R.png'
];
for (const name of publicFiles) {
  const source = path.join(root, name);
  if (!fs.statSync(source).isFile() || fs.lstatSync(source).isSymbolicLink()) throw new Error('Invalid public file: ' + name);
}
// Resolve and bound the generated output before replacing it. Do not follow symlinks.
if (path.dirname(output) !== root || path.basename(output) !== 'dist') throw new Error('Unsafe output path');
if (fs.existsSync(output)) {
  if (fs.lstatSync(output).isSymbolicLink() || fs.realpathSync(output) !== output) throw new Error('Unsafe output directory');
  fs.rmSync(output, { recursive: true });
}
for (const name of publicFiles) {
  const destination = path.join(output, name);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(path.join(root, name), destination);
}
console.log(`Prepared ${publicFiles.length} public files in ${output}. Nothing deployed.`);
