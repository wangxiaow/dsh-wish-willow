import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const text = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('public Chinese branding is 许愿柳; stable package and storage identifiers remain unchanged', async () => {
  const readme = await text('README.md');
  const client = await text('client.js');
  const zh = JSON.parse(await text('locale/zh.json'));
  const pkg = JSON.parse(await text('package.json'));
  assert.match(readme, /^# 🌿 Wish Willow · 许愿柳$/m);
  assert.match(client, /zh:\s*\{\s*title: '许愿柳'/);
  assert.equal(zh.meta.title, '许愿柳 · P0');
  assert.equal(pkg.name, 'dsh-wish-willow');
  assert.doesNotMatch(readme + client + JSON.stringify(zh), /愿望之柳|愿望柳|许愿之柳/);
});

test('private docs are excluded from source publishing and package distribution', async () => {
  const pkg = JSON.parse(await text('package.json'));
  const ignore = await text('.gitignore');
  const readme = await text('README.md');
  assert.ok(!pkg.files.some(file => /^\/?docs(?:\/|$)/.test(file)));
  assert.match(ignore, /^\/docs\/$/m);
  assert.match(ignore, /^\/\.p1-preservation\*\/$/m);
  assert.doesNotMatch(readme, /\]\([^\n]*docs\//);
});
