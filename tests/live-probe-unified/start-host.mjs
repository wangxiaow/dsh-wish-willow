// Opt-in isolated probe. No default boot/browser, credential inheritance, ACL change,
// profile adoption, directory deletion, or replacement of an existing listener.
import assert from 'node:assert/strict';
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { repositoryRoot, assertAcceptanceHome, assertNoLinks, within, isolatedEnvironment } from '../helpers/isolation.mjs';

export function hostArguments(argv) {
  const [portArg, debugArg, homeArg, evidenceArg, expect, authorization, browserAuthorization, ...extra] = argv;
  const port = Number(portArg), debugPort = debugArg === 'none' ? null : Number(debugArg);
  const validPort = value => Number.isInteger(value) && value >= 1024 && value <= 65535 && value !== 19387;
  if (!validPort(port) || (debugPort !== null && (!validPort(debugPort) || debugPort === port)) ||
      !homeArg || !evidenceArg || !['unified', 'legacy'].includes(expect) ||
      authorization !== '--authorize-isolated-host' || extra.length ||
      (debugPort !== null ? browserAuthorization !== '--authorize-browser' : browserAuthorization !== undefined)) {
    throw Error('usage: start-host.mjs <port> <debug-port|none> <owned-home> <new-evidence-dir> <unified|legacy> --authorize-isolated-host [--authorize-browser]');
  }
  return { port, debugPort, home: resolve(homeArg), evidence: resolve(evidenceArg), expect };
}

async function unusedPort(port) {
  await new Promise((ok, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen({ host: '127.0.0.1', port, exclusive: true }, () => probe.close(error => error ? reject(error) : ok()));
  });
}
async function absent(file) {
  await assertNoLinks(file);
  try { await lstat(file); throw Error(`Refusing to reuse existing probe state: ${file}`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}

export async function startHost(argv) {
  const args = hostArguments(argv); // rejects a bare invocation before any mutation
  const home = await assertAcceptanceHome(args.home); // capture/check actual inherited DSH_HOME before changing it
  const evidenceParent = join(home, 'evidence');
  if (!within(evidenceParent, args.evidence)) throw Error('Evidence must be a new child of this owned home/evidence');
  await assertNoLinks(args.evidence);
  await absent(args.evidence);
  const stopFile = join(home, 'stop-host'), claim = join(home, 'probe-host-started');
  await absent(stopFile); await absent(claim);
  const manifestPath = join(home, 'profiles', 'web', 'package.json');
  for (const file of [manifestPath, join(home, 'profiles/web/cordis.yml'), join(home, 'profiles/web/cordis.patch.yml'),
    join(home, 'cordis.patch.yml'), join(home, '.credentials.yaml'), join(home, '.env'), join(home, 'storages')]) await assertNoLinks(file);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const wishWillow = manifest.dsh.profile.bundles.filter(name => name.startsWith('dsh-wish-willow'));
  assert.deepEqual(wishWillow, args.expect === 'legacy' ? ['dsh-wish-willow', 'dsh-wish-willow-p1'] : ['dsh-wish-willow']);
  await unusedPort(args.port);
  if (args.debugPort !== null) await unusedPort(args.debugPort);
  // Single-use claim is deliberately retained, even on failure. Restart/adoption needs
  // a separate human decision, not an automatic delete that could erase another run.
  await writeFile(claim, `${JSON.stringify({ pid: process.pid, at: new Date().toISOString() })}\n`, { flag: 'wx', mode: 0o600 });
  await mkdir(dirname(args.evidence), { recursive: true });
  await mkdir(args.evidence);
  const env = { ...isolatedEnvironment(home), DSH_PROFILE: 'web' };
  for (const dir of [env.APPDATA, env.LOCALAPPDATA, env.TEMP]) {
    await assertNoLinks(dir); await mkdir(dir, { recursive: true });
  }
  // Do not inherit model/cloud credentials, NODE_OPTIONS, DSH_SESSION_ID, or caller profile overrides.
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, env);
  process.chdir(home);
  const dshModules = join(repositoryRoot, '.research/installed/dsh/node_modules');
  const load = relative => import(pathToFileURL(resolve(dshModules, relative)).href);
  const { loadLayeredEnv } = await load('@deepseek-ai/dsh-app-boot/lib/index.js');
  const { runProfile } = await load('@deepseek-ai/dsh/lib/profile-boot.js');
  const overlay = resolve(dirname(fileURLToPath(import.meta.url)), 'runtime.patch.yml');
  const application = await runProfile({ environment: loadLayeredEnv('dsh'), profile: 'web', patchFiles: [overlay], args: ['--no-open', '--port', String(args.port)] });
  const { ctx } = application;
  let chrome, poll;
  try {
    assert.equal(ctx.profileContext.home, home);
    assert.equal(ctx.webServer.port, args.port);
    const origin = `http://127.0.0.1:${args.port}`;
    const record = { at: new Date().toISOString(), pid: process.pid, origin, home, profile: 'web',
      boot: 'official runProfile', fiberState: ctx.fiber.state, bundles: manifest.dsh.profile.bundles,
      storageRoot: join(home, 'storages'), isolationPreflight: 'passed', liveProfilesModified: 'not-measured',
      credentialsInherited: false, authenticatedUrlRecorded: false, stopFile, fixtureRetained: true };
    if (args.debugPort !== null) {
      const chromeDir = join(home, `chrome-${randomUUID()}`);
      await assertNoLinks(chromeDir); await mkdir(chromeDir);
      chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        `--user-data-dir=${chromeDir}`, '--no-first-run', '--no-default-browser-check', '--disable-features=Translate',
        '--force-renderer-accessibility', `--remote-debugging-port=${args.debugPort}`, '--new-window', ctx.connection.authenticatedUrl(origin),
      ], { stdio: 'ignore', windowsHide: false, shell: false, env });
      chrome.on('error', () => console.error('Chrome handoff failed (URL deliberately omitted)'));
      Object.assign(record, { chromeProfile: chromeDir, chromeDebugPort: args.debugPort, chromePid: chrome.pid ?? null });
    }
    const evidenceFile = join(args.evidence, 'host.json');
    await assertNoLinks(evidenceFile);
    await writeFile(evidenceFile, `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx' });
    console.log(JSON.stringify(record));
    poll = setInterval(() => {
      if (!existsSync(stopFile)) return;
      clearInterval(poll);
      // Only our own child handle; never search for/kill the user's browser or Host.
      if (chrome && chrome.exitCode === null) chrome.kill();
      void application.shutdown.shutdown(0);
    }, 250);
    return application;
  } catch (error) {
    clearInterval(poll);
    if (chrome && chrome.exitCode === null) chrome.kill();
    await application.shutdown.shutdown(1);
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { await startHost(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 2; }
}
