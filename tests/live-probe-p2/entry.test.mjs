// Targeted STATIC/plumbing regression, NOT real DSH execution or Reviewer acceptance. NOT RUN this round.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { argumentsFor, productionFileIdentity, assertProductionIdentity } from './run.mjs';
import { fixedInputs, inputLedger, commands, contract } from './inputs.mjs';

test('C entry rejects bare/extra flags and never exposes supplied source/results/verdicts', () => {
  for (const args of [[], ['prepare'], ['review'], ['import', 'source'], ['prepare', 'home', 'evidence', '19391', 'a'.repeat(64), '--authorize-c-tool-preparation', '--success'],
    ['review', 'home', 'evidence', '19391', 'provider', 'model', '--authorize-c-reviewers']]) assert.throws(() => argumentsFor(args));
  const prepared = argumentsFor(['prepare', 'home', 'evidence', '19391', 'a'.repeat(64), '--authorize-c-tool-preparation']);
  assert.equal(prepared.mode, 'prepare'); assert.equal(prepared.port, 19391);
  assert.equal(argumentsFor(['review', 'home', 'evidence', '19391', 'provider', 'model', '--authorize-c-reviewers', '--acknowledge-no-hard-money-cap']).mode, 'review');
});
test('C neutral input pins preserve subtraction/zero-only defect and the common contract', async () => {
  const inputs = await fixedInputs(); assert.equal(inputs.length, 2);
  assert.match(inputs[0].files[0].content, /return a \+ b/); assert.match(inputs[1].files[0].content, /return a - b/);
  assert.match(inputs[1].files[1].content, /assert\.equal\(sum\(0, 0\), 0\)/);
  assert.equal((inputs[1].files[1].content.match(/assert\.equal/g) ?? []).length, 1);
  for (const input of inputs) assert.doesNotMatch(input.files.map(f => f.content).join('\n'), /\bWeak\b|\bgood\b|\bbad\b|expected verdict/i);
  assert.deepEqual(commands.map(([kind]) => kind), ['build', 'test', 'run']); assert.match(contract, /Number/);
  const ledger = inputLedger(inputs);
  for (const entry of ledger.inputs.flat()) assert.match(entry.sha256, /^[a-f0-9]{64}$/);
});
test('C preparation remains internal and the normal Coder durable completion checks remain present', async () => {
  const host = await readFile(new URL('../../packages/p1/src/host.js', import.meta.url), 'utf8');
  assert.doesNotMatch(host, /Remote\([^\n]*(?:prepareFixed|stageDelivery|verifyCommand)/);
  const source = await readFile(new URL('../../packages/p1/src/orchestrator.js', import.meta.url), 'utf8');
  assert.match(source, /return this\.verifyCommand\(/); assert.match(source, /await this\.stageDelivery\(/);
  assert.match(source, /lastEnd\?\.kind !== 'completed' \|\| !stagedDelivery/);
  assert.match(source, /deliveryResult\.data\.message\.isError/);
  assert.match(source, /await handle\.dispose\(\); handle = undefined/);
});

// Synthetic byte fixtures only; no pack/install/Host/candidate execution and no archive/Home adoption.
const productionNames = ['src/host.js', 'packages/p1/src/host.js', 'packages/p1/src/orchestrator.js',
  'packages/p1/src/delivery-runner.js', 'packages/p1/src/delivery.js', 'packages/p1/src/artifacts.js',
  'packages/p1/src/reviewer.js', 'packages/p1/src/quality-gate.js', 'packages/p1/src/state.js'];
const productionBytes = name => Buffer.from(`// STATIC identity fixture for ${name}\n`);
const identities = manifestBytes => [productionFileIdentity('package.json', manifestBytes),
  ...productionNames.map(name => productionFileIdentity(name, productionBytes(name)))];
const reverseKeys = value => Array.isArray(value) ? value.map(reverseKeys) : value !== null && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).reverse().map(key => [key, reverseKeys(value[key])])) : value;

test('C manifest accepts only formatting/key-order differences and retains raw installed receipt identity', async () => {
  const bytes = await readFile(new URL('../../package.json', import.meta.url));
  const formatted = Buffer.from(` \n${JSON.stringify(reverseKeys(JSON.parse(bytes.toString('utf8'))), null, 4)}\n\t`);
  const current = identities(bytes), actual = identities(formatted);
  assert.doesNotThrow(() => assertProductionIdentity(actual, current));
  assert.notEqual(actual[0].sha256, current[0].sha256); // real fixture byte hashes are NOT equal
  assert.equal(actual[0].manifestJson, current[0].manifestJson);
  assert.equal(actual[0].manifestSha256, current[0].manifestSha256);
  assert.equal(actual[0].manifestNormalization, 'wish-willow-manifest-sorted-json/1');
  const receipt = JSON.parse(JSON.stringify({ core: actual }));
  assert.deepEqual(receipt.core, identities(formatted));
  assert.throws(() => assert.deepEqual(receipt.core, current)); // later installed byte changes are still refused
  const driver = await readFile(new URL('./run.mjs', import.meta.url), 'utf8');
  assert.match(driver, /assertProductionIdentity\(actual, current\)/);
  assert.match(driver, /assert\.deepEqual\(receipt\.core, binding\.core\)/);
  assert.match(driver, /assert\.equal\(sha256\(await readFile\(receipt\.archive\)\), receipt\.archiveHash\)/);
});
test('C manifest rejects package identity and all nested semantic changes or ambiguous/invalid JSON', async () => {
  const bytes = await readFile(new URL('../../package.json', import.meta.url)), value = JSON.parse(bytes.toString('utf8'));
  const current = identities(bytes);
  for (const change of [m => { m.name = 'another-bundle'; }, m => { m.version = '0.3.3'; },
    m => { m.dsh.bundle.patch = './other.patch.yml'; }, m => { m.dsh.client.immediately = false; },
    m => { m.dependencies.zod = '4.6.6'; }, m => { m.peerDependencies['@deepseek-ai/dsh'] = 'latest'; },
    m => { m.engines.node = '>=23'; }, m => { m.exports['.'] = './other.js'; }, m => { m.files.reverse(); },
    m => { delete m.license; }, m => { m.extra = null; }, m => { m.description += ' '; }]) {
    const changed = structuredClone(value); change(changed);
    assert.throws(() => assertProductionIdentity(identities(Buffer.from(JSON.stringify(changed))), current));
  }
  for (const text of ['{"name":"dsh-wish-willow","version":"0.3.2",}', 'null', '[]',
    '{"name":"another-bundle","name":"dsh-wish-willow","version":"0.3.2"}',
    '{"name":"dsh-wish-willow","\\u006eame":"dsh-wish-willow","version":"0.3.2"}',
    '{"name":"dsh-wish-willow","version":"0.3.2","nested":{"key":1,"key":2}}',
    '{"name":"dsh-wish-willow","version":"0.3.2","overflow":1e400}']) assert.throws(() => productionFileIdentity('package.json', Buffer.from(text)));
});
test('C non-manifest production identity refuses even one changed byte in any of the nine files', async () => {
  const bytes = await readFile(new URL('../../package.json', import.meta.url)), current = identities(bytes);
  assert.equal(current.length, 10);
  for (const [index, name] of productionNames.entries()) {
    const actual = identities(bytes);
    actual[index + 1] = productionFileIdentity(name, Buffer.concat([productionBytes(name), Buffer.from(' ')]));
    assert.throws(() => assertProductionIdentity(actual, current));
    assert.equal('manifestNormalization' in actual[index + 1], false);
  }
});
