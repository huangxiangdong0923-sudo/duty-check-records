import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('../', import.meta.url));
const sw = await readFile(path.join(rootDir, 'sw.js'), 'utf8');
const cachedAssets = Array.from(sw.matchAll(/'(\.\/[^']*)'/g), (match) => match[1]);

test('a new service worker takes over without waiting for every tab to close', () => {
  assert.match(sw, /self\.skipWaiting\(\)/);
  assert.match(sw, /self\.clients\.claim\(\)/);
});

test('old caches are dropped when the cache name changes', () => {
  const version = /const CACHE = '([^']+)'/.exec(sw);
  assert.ok(version, 'cache name missing');
  assert.match(sw, /keys\.filter\(\(key\) => key !== CACHE\)/);
});

test('page loads come from the network first so a new version shows up', () => {
  const navigationBlock = sw.slice(sw.indexOf("request.mode === 'navigate'"));
  assert.ok(navigationBlock.indexOf('fetch(request)') < navigationBlock.indexOf('caches.match(request)'), 'navigation should try the network before the cache');
});

test('every javascript module is pre-cached for offline use', async () => {
  const files = (await readdir(path.join(rootDir, 'js'))).filter((name) => name.endsWith('.js'));
  assert.ok(files.length >= 8, 'expected the js folder to hold the app modules');
  for (const file of files) {
    assert.ok(cachedAssets.includes(`./js/${file}`), `js/${file} is missing from the service worker cache list`);
  }
});

test('the entry pages and icons are pre-cached', () => {
  for (const asset of ['./', './index.html', './styles.css', './app.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png']) {
    assert.ok(cachedAssets.includes(asset), `${asset} missing from the cache list`);
  }
});

test('cached assets are fetched fresh during install', () => {
  assert.match(sw, /new Request\(asset, \{ cache: 'reload' \}\)/);
});

test('cross-origin requests (the sync API) never go through the cache', () => {
  const fetchBlock = sw.slice(sw.indexOf("addEventListener('fetch'"));
  const guard = fetchBlock.indexOf('self.location.origin');
  assert.ok(guard > -1, 'the service worker must skip cross-origin requests');
  assert.ok(guard < fetchBlock.indexOf('caches.match'), 'the origin check must run before any cache lookup');
});
