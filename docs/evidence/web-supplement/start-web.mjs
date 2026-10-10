// Authorized isolated full Web profile, using the same official boot path as the CLI.
// No product/DSH implementation patches; only an ordinary config overlay suppresses URL logging.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const evidence=dirname(fileURLToPath(import.meta.url));
const root=resolve(evidence,'../../..');
const home=resolve(root,'.test-data/final-github-home-20261009');
assert(home !== String.raw`C:\Users\wangw\.dsh`);
const manifest=JSON.parse(readFileSync(resolve(home,'profiles/web/package.json'),'utf8'));
assert(manifest.dsh.profile.bundles.includes('dsh-wish-willow'));
const stopFile=resolve(home,'stop-web-supplement');
assert(!existsSync(stopFile),'A prior stop signal exists; do not silently restart');
process.env.DSH_HOME=home;
process.env.DSH_PROFILE='web';
process.env.DSH_TELEMETRY_DISABLED='1';
delete process.env.DSH_PROFILE_DIR;
delete process.env.DSH_SESSION_ID;
process.chdir(home);
const {loadLayeredEnv}=await import('../../../.research/installed/dsh/node_modules/@deepseek-ai/dsh-app-boot/lib/index.js');
const {runProfile}=await import('../../../.research/installed/dsh/node_modules/@deepseek-ai/dsh/lib/profile-boot.js');
const application=await runProfile({environment:loadLayeredEnv('dsh'),profile:'web',patchFiles:[resolve(evidence,'runtime.patch.yml')],args:['--no-open','--port','3081']});
const {ctx}=application;
assert.equal(ctx.fiber.state,2);
assert.equal(ctx.webServer.port,3081);
assert.equal(ctx.profileContext.home,home);
const origin='http://127.0.0.1:3081';
// Same official authenticatedUrl handshake as the product launcher; pass directly
// to the authorized browser, never to evidence/console, and do not read stored secrets.
const chrome=spawn(String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`,['--new-window',ctx.connection.authenticatedUrl(origin)],{stdio:'ignore',windowsHide:false});
chrome.on('error',()=>console.error('Chrome handoff failed (URL deliberately omitted)'));
const record={at:new Date().toISOString(),pid:process.pid,origin,home,profile:'web',boot:'official runProfile',fiberState:ctx.fiber.state,bundles:manifest.dsh.profile.bundles,storageRoot:resolve(home,'storages'),authenticatedUrlRecorded:false,liveProfilesModified:false,stopFile};
writeFileSync(resolve(evidence,'isolated-host.json'),JSON.stringify(record,null,2));
console.log(JSON.stringify(record));
const poll=setInterval(()=>{if(existsSync(stopFile)){clearInterval(poll);console.log('Authorized isolated test Host shutting down.');void application.shutdown.shutdown(0);}},250);
