import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { Context } from '@deepseek-ai/cordis';
import Storage from '@deepseek-ai/dsh-storage';
import * as Json from '@deepseek-ai/dsh-storage-json';
import * as Domain from '@deepseek-ai/dsh-storage-domain';
import Typert from '@deepseek-ai/dsh-typert-registry';
import Gateway from '@deepseek-ai/dsh-api-gateway';
const root = process.cwd();
const profile = resolve(root, '.test-data/final-github-home-20261009/profiles/web');
const installed = resolve(profile, 'node_modules/dsh-wish-willow');
const evidence = resolve(root, 'docs/evidence/final-acceptance');
const manifest = JSON.parse(await readFile(resolve(installed, 'package.json'), 'utf8'));
const selection = JSON.parse(await readFile(resolve(profile, 'package.json'), 'utf8'));
assert(selection.dsh.profile.bundles.includes('dsh-wish-willow'));
const hashes = {};
for (const path of ['src/host.js', 'src/model.js', 'client.js', 'cordis.patch.yml', 'locale/en.json', 'locale/zh.json']) {
 const bytes = await readFile(resolve(installed, path));
 assert.deepEqual(bytes, await readFile(resolve(root, path)), path);
 hashes[path] = createHash('sha256').update(bytes).digest('hex');
}
const Wish = await import(pathToFileURL(resolve(installed, 'src/host.js')));
const storage = resolve(root, '.test-data/final-github-service-storage-20261009');
await mkdir(storage); // must be fresh; no live root or concurrent writer
const ctx = new Context(); const fibers = [];
async function mount(plugin, config={}) {const fiber=ctx.plugin(plugin, config); fibers.push(fiber); await fiber; assert.equal(fiber.state, 2); return fiber;}
const result = { observedAt:new Date().toISOString(), target:selection.dependencies['dsh-wish-willow'], installedVersion:manifest.version, profile, storage, selected:true, hashes, boundaries:['Isolated real DSH services; not a second Web/Desktop app', 'No network server, no production storage root', 'Service CAS; not two browser DOM clients'] };
try {
 await mount(Storage); await mount(Json,{root:storage}); await mount(Domain,{backend:'json'}); await mount(Typert); await mount(Gateway);
 const fiber=await mount(Wish);
 const call=(method,args={})=>ctx.typertGateway.invoke({namespace:'wishWillow',method,args});
 assert.deepEqual(await call('list'),[]);
 const fields={title:'[P0 ACCEPTANCE TEST] GitHub installed service',wish:'Isolated fixed-commit installation acceptance',status:'draft'};
 const created=await call('create',{input:fields});
 const clientA=structuredClone((await call('list'))[0]);
 const clientB=structuredClone((await call('list'))[0]);
 assert.equal(clientA.revision,clientB.revision);
 const updated=await call('update',{input:{...fields,title:'[P0 ACCEPTANCE TEST] Service winner A',id:created.id,expectedRevision:clientA.revision}});
 let conflict;
 try {await call('update',{input:{...fields,title:'[P0 ACCEPTANCE TEST] stale B',id:created.id,expectedRevision:clientB.revision}});} catch(error) {conflict={code:error.code,message:error.message,details:error.details};}
 assert.equal(conflict?.code,'wish-willow/conflict');
 assert.deepEqual((await call('list'))[0],updated);
 const onDisk=JSON.parse(await readFile(resolve(storage,'wish_willow.json'),'utf8')).tables.products[created.id];
 assert.deepEqual(onDisk,updated);
 await fiber.dispose();
 const reloaded=await mount(Wish);
 assert.deepEqual((await call('list'))[0],updated);
 Object.assign(result,{hostFiberState:reloaded.state,created,initialReadRevisions:[clientA.revision,clientB.revision],updated,conflict,staleWriteRejected:true,winnerPreservedOnDisk:true,domainReopened:true,status:'PASS'});
} finally {for(const fiber of fibers.reverse()) await fiber.dispose();}
await writeFile(resolve(evidence,'github-load-and-service-cas.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
