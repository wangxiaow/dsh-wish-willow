// Isolated-environment installer for the unified Wish Willow bundle.
//
// Uses ONLY the official launcher path (`dsh plugin --profile <name> add <package>`, which
// forwards to pnpm through @deepseek-ai/dsh-plugin-manager) against a dedicated DSH_HOME.
// It never touches the user's live profiles: the real profile manifests are hashed before
// and after, and any change aborts the run.
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const dshInstall = resolve(repo, '.research/installed/dsh');
const bundledNode = process.execPath;
const bundledPnpm = 'D:\\Program Files\\DeepSeek Harness\\resources\\runtime\\pnpm\\bin\\pnpm.mjs';
const liveHome = resolve(process.env.USERPROFILE, '.dsh');
// Isolated acceptance homes: inside the ignored `.test-data` tree, or in the dedicated
// per-user acceptance root. The DSH Windows sandbox needs a workspace the user owns with
// WRITE_OWNER (its mandatory label lives in the SACL), which a profile-backed C: path has
// and the repo drive does not, so both locations are supported.
const acceptanceRoot = resolve(process.env.LOCALAPPDATA, 'dsh-wish-willow-acceptance');

const [homeArg, target, profile = 'web', operation = 'add'] = process.argv.slice(2);
if (!homeArg || !target) {
  console.error('usage: node install.mjs <isolated-home> <package-path-or-tgz> [profile] [add|remove]');
  process.exit(2);
}
if (!['add', 'remove'].includes(operation)) {
  console.error(`unsupported operation ${operation}`);
  process.exit(2);
}
const home = resolve(homeArg);
if (home === liveHome || !(home.startsWith(resolve(repo, '.test-data')) || home.startsWith(acceptanceRoot))) {
  console.error(`refusing to install outside an isolated acceptance home: ${home}`);
  process.exit(2);
}
const pathLike = /[\\/]|\.tgz$/i.test(target);
if (operation === 'add' && !existsSync(pathLike ? resolve(target) : target)) { console.error(`target does not exist: ${target}`); process.exit(2); }
if (operation === 'remove' && !/^[@a-z0-9][\w@/.-]*$/i.test(target)) { console.error(`remove expects a package name, got ${target}`); process.exit(2); }
const specifier = operation === 'remove' ? target : resolve(target);

const hash = path => existsSync(path) ? createHash('sha256').update(readFileSync(path)).digest('hex') : '<absent>';
const liveProfile = join(liveHome, 'profiles', profile);
const liveBefore = { manifest: hash(join(liveProfile, 'package.json')), patch: hash(join(liveProfile, 'cordis.patch.yml')) };

mkdirSync(home, { recursive: true });
// The isolated home needs the operator's own credentials to reach the configured model
// provider. The file is copied byte-for-byte and never read, printed or modified here.
const credentials = join(liveHome, '.credentials.yaml');
if (existsSync(credentials) && !existsSync(join(home, '.credentials.yaml'))) copyFileSync(credentials, join(home, '.credentials.yaml'));

const shimDir = resolve(repo, '.test-data/unified-bin');
mkdirSync(shimDir, { recursive: true });
const shim = join(shimDir, 'pnpm.cmd');
const previousShim = existsSync(shim) ? readFileSync(shim, 'utf8') : '';
const shimBody = `@echo off\r\n"${bundledNode}" "${bundledPnpm}" %*\r\n`;
if (previousShim !== shimBody) writeFileSync(shim, shimBody);

const cli = join(dshInstall, 'node_modules/@deepseek-ai/dsh/lib/bin.js');
const result = spawnSync(bundledNode, [cli, 'plugin', '--profile', profile, operation, specifier], {
  stdio: 'inherit',
  env: { ...process.env, DSH_HOME: home, PATH: `${shimDir};${process.env.PATH}`, DSH_TELEMETRY_DISABLED: '1' },
});
const liveAfter = { manifest: hash(join(liveProfile, 'package.json')), patch: hash(join(liveProfile, 'cordis.patch.yml')) };
if (liveBefore.manifest !== liveAfter.manifest || liveBefore.patch !== liveAfter.patch) {
  console.error('ABORT: the isolated installer modified the live profile; investigate before continuing');
  process.exit(3);
}
const manifestPath = join(home, 'profiles', profile, 'package.json');
console.log(`install exit=${result.status}`);
console.log(`isolated manifest=${manifestPath}`);
console.log(existsSync(manifestPath) ? readFileSync(manifestPath, 'utf8') : '<no manifest>');
console.log(`live profile untouched: ${JSON.stringify(liveBefore)}`);
process.exit(result.status ?? 1);
