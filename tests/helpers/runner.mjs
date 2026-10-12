// Explicit, opt-in fixture command runner.
//
// This is NOT an OS sandbox and must never be cited as one. It exists so that the integration
// fixtures can execute the *real* PowerShell commands a Wish Willow delivery records, instead of
// faking exit codes. What bounds it:
//
//   1. it only runs when a test explicitly constructs it (`p1Runtime`/`unifiedRuntime` otherwise
//      refuse every shell call);
//   2. the working directory must resolve inside the fixture root owned by this process;
//   3. the child receives a minimal environment (OS launch essentials plus fixture-internal
//      TEMP/HOME); the caller's model/cloud credentials and NODE_OPTIONS are never inherited;
//   4. there is a bounded timeout, and an abort signal kills the child.
//
// Real OS-level confinement evidence comes from the DSH sandbox, which this module does not replace.
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { controlledPath, fixtureRunnerBrand } from './isolation.mjs';

/** OS launch essentials only; TEMP/HOME point inside the fixture so nothing lands in the real profile. */
export function fixtureEnvironment(root, source = process.env) {
  const out = {};
  for (const name of ['SYSTEMROOT', 'WINDIR', 'COMSPEC', 'PATHEXT', 'PATH', 'PROCESSOR_ARCHITECTURE', 'NUMBER_OF_PROCESSORS']) {
    const entry = Object.entries(source).find(([key]) => key.toUpperCase() === name);
    if (entry) out[name] = entry[1];
  }
  const processData = path.join(root, 'process-data');
  return { ...out, TEMP: path.join(processData, 'temp'), TMP: path.join(processData, 'temp'),
    HOME: path.join(processData, 'profile'), USERPROFILE: path.join(processData, 'profile'),
    APPDATA: path.join(processData, 'roaming'), LOCALAPPDATA: path.join(processData, 'local'),
    NODE_PATH: '', NODE_OPTIONS: '', npm_config_ignore_scripts: 'true',
    npm_config_userconfig: path.join(processData, 'empty.npmrc'), DSH_TELEMETRY_DISABLED: '1' };
}

export const fixtureShell = () => process.platform === 'win32'
  ? (process.env.WISH_WILLOW_TEST_POWERSHELL || 'powershell.exe') : 'pwsh';

export function createFixtureRunner({ root, timeoutMs = 60000 } = {}) {
  return {
    brand: fixtureRunnerBrand,
    async run({ command, workdir, timeoutMs: limit = timeoutMs, signal }) {
      if (typeof command !== 'string' || !command.trim()) throw Error('A fixture command is required');
      const cwd = await controlledPath(root, workdir, '.');
      if (signal?.aborted) return { kind: 'foreground', exitCode: null, aborted: true, timedOut: false, stdout: '', stderr: '' };
      await mkdir(path.join(root, 'process-data', 'temp'), { recursive: true });
      return await new Promise(resolve => {
        // -EncodedCommand takes the command as base64 UTF-16LE, so quoted operands inside the
        // replayed command (`node -e "process.exit(9)"`) reach PowerShell byte-exact instead of
        // being mangled by the Windows command line.
        const encoded = Buffer.from(command, 'utf16le').toString('base64');
        const child = spawn(fixtureShell(), ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded],
          { cwd, env: fixtureEnvironment(root), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '', stderr = '', settled = false, timer;
        const finish = result => {
          if (settled) return;
          settled = true; clearTimeout(timer); signal?.removeEventListener?.('abort', abort);
          resolve({ stdout, stderr, ...result });
        };
        const abort = () => { child.kill(); finish({ kind: 'foreground', exitCode: null, aborted: true, timedOut: false }); };
        timer = setTimeout(() => { child.kill(); finish({ kind: 'foreground', exitCode: null, aborted: false, timedOut: true }); }, limit);
        signal?.addEventListener?.('abort', abort, { once: true });
        child.stdout.on('data', chunk => { stdout += chunk; });
        child.stderr.on('data', chunk => { stderr += chunk; });
        child.on('error', error => finish({ kind: 'foreground', exitCode: null, runnerFailed: true, stderr: String(error.message ?? error) }));
        child.on('close', code => finish({ kind: 'foreground', exitCode: code, aborted: false, timedOut: false, signal: null }));
      });
    },
  };
}
