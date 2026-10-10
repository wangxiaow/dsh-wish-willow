// Authorized isolated full Web profile for the unified Wish Willow bundle.
//
// Uses the same official boot path as the shipped launcher (`runProfile`) against a
// dedicated DSH_HOME, on its own port and with its own storage root. It never boots,
// stops or replaces the DSH instance at 127.0.0.1:19387 and never writes the live
// profiles. The authenticated URL is handed to the browser and is never logged.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const liveHome = resolve(process.env.USERPROFILE, '.dsh');
const port = Number(process.argv[2] ?? 3081);
const origin = `http://127.0.0.1:${port}`;
const home = resolve(process.argv[4] ?? resolve(repo, '.test-data/unified-home'));
const evidence = resolve(process.argv[5] ?? resolve(repo, 'docs/evidence/p1-unification/web'));
const acceptanceRoot = resolve(process.env.LOCALAPPDATA, 'dsh-wish-willow-acceptance');
assert.notEqual(home, liveHome, 'the isolated host must never boot the live DSH home');
assert.ok(home.startsWith(resolve(repo, '.test-data')) || home.startsWith(acceptanceRoot),
  `the isolated host must boot inside an acceptance home, got ${home}`);
const manifest = JSON.parse(readFileSync(resolve(home, 'profiles/web/package.json'), 'utf8'));
const expect = process.argv[6] ?? 'unified';
const wishWillow = manifest.dsh.profile.bundles.filter(name => name.startsWith('dsh-wish-willow'));
if (expect === 'legacy') {
  assert.deepEqual(wishWillow, ['dsh-wish-willow', 'dsh-wish-willow-p1'],
    'the pre-upgrade profile must carry both historical companion bundles');
} else {
  assert.deepEqual(wishWillow, ['dsh-wish-willow'], 'the isolated profile must install exactly one Wish Willow bundle');
}
const stopFile = resolve(home, 'stop-host');
assert(!existsSync(stopFile), 'a prior stop signal exists; refuse to silently restart');

process.env.DSH_HOME = home;
process.env.DSH_PROFILE = 'web';
process.env.DSH_TELEMETRY_DISABLED = '1';
delete process.env.DSH_PROFILE_DIR;
delete process.env.DSH_SESSION_ID;
process.chdir(home);

const dshModules = resolve(repo, '.research/installed/dsh/node_modules');
const load = relative => import(pathToFileURL(resolve(dshModules, relative)).href);
const { loadLayeredEnv } = await load('@deepseek-ai/dsh-app-boot/lib/index.js');
const { runProfile } = await load('@deepseek-ai/dsh/lib/profile-boot.js');
const overlay = resolve(here, 'runtime.patch.yml');
const application = await runProfile({ environment: loadLayeredEnv('dsh'), profile: 'web', patchFiles: [overlay], args: ['--no-open', '--port', String(port)] });
const { ctx } = application;
assert.equal(ctx.profileContext.home, home, 'the booted Host must use the isolated home');
assert.equal(ctx.webServer.port, port);

const record = {
  at: new Date().toISOString(), pid: process.pid, origin, home, profile: 'web', boot: 'official runProfile',
  fiberState: ctx.fiber.state, bundles: manifest.dsh.profile.bundles, storageRoot: resolve(home, 'storages'),
  liveProfilesModified: false, authenticatedUrlRecorded: false, stopFile,
};

// Same official authenticated handshake the product launcher uses. The URL is handed
// straight to a browser started with its OWN user-data-dir and a debug port, so the
// acceptance driver can identify that exact window and re-verify its origin; the URL
// itself is never written to disk.
const chromeDir = resolve(repo, '.test-data', `chrome-${basename(home)}-${port}`);
const debugPort = Number(process.argv[3] ?? 9333);
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  `--user-data-dir=${chromeDir}`, '--no-first-run', '--no-default-browser-check', '--disable-features=Translate',
  '--force-renderer-accessibility',
  `--remote-debugging-port=${debugPort}`, '--new-window', ctx.connection.authenticatedUrl(origin),
], { stdio: 'ignore', windowsHide: false });
chrome.on('error', () => console.error('Chrome handoff failed (URL deliberately omitted)'));
record.chromeProfile = chromeDir;
record.chromeDebugPort = debugPort;
record.chromePid = chrome.pid ?? null;
writeFileSync(resolve(evidence, 'host.json'), JSON.stringify(record, null, 2));
console.log(JSON.stringify(record));

const poll = setInterval(() => {
  if (existsSync(stopFile)) {
    clearInterval(poll);
    console.log('Authorized isolated test Host shutting down.');
    void application.shutdown.shutdown(0);
  }
}, 250);
