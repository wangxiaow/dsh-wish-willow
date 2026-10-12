// Targeted path-context regression only. No Shell, DSH boot, install, model or candidate execution.
// All filesystem fixtures are NEW UUID-owned test directories and are deliberately retained.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, symlink, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { acceptanceParent, createAcceptanceHome, assertAcceptanceHome, captureAcceptanceHome,
  assertIsolatedPath, isolatedEnvironment, liveHomePaths } from '../helpers/isolation.mjs';

async function fixture() {
  const home = await createAcceptanceHome(path.join(acceptanceParent, `wish-willow-p2-c-${randomUUID()}`));
  // Dummy protected roots, never a user's actual private directory. All names are unique.
  const userHome = `${home}-user`, dshHome = `${home}-dsh`, profile = `${home}-profile`;
  const env = { DSH_HOME: dshHome, DSH_PROFILE_DIR: profile,
    APPDATA: path.join(userHome, 'roaming'), LOCALAPPDATA: path.join(userHome, 'local') };
  return { home, userHome, dshHome, profile, env };
}
const envKeys = ['HOME', 'USERPROFILE', 'DSH_HOME', 'DSH_PROFILE_DIR', 'APPDATA', 'LOCALAPPDATA'];
async function withEnvironment(values, operation) {
  const saved = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
  try {
    for (const key of envKeys) {
      if (values[key] === undefined) delete process.env[key]; else process.env[key] = values[key];
    }
    return await operation();
  } finally {
    for (const key of envKeys) {
      if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
    }
  }
}

test('C captured Home survives separate dynamic homedir/DSH_HOME changes and full isolated environment', { concurrency: false }, async () => {
  const f = await fixture(), markerPath = path.join(f.home, '.wish-willow-test-owner');
  const marker = await readFile(markerPath, 'utf8');
  const check = await captureAcceptanceHome(f.home, { env: f.env, userHome: f.userHome });
  const actualCheck = await captureAcceptanceHome(f.home);
  assert.notEqual(homedir(), f.home);
  for (const target of [homedir(), ...liveHomePaths()]) await assert.rejects(captureAcceptanceHome(target), /Unsafe test path/);
  assert.notEqual(f.userHome, f.home);
  assert.equal(await check(f.home), f.home);
  // Both independent former failures are reproduced; the general default validator stays strict.
  await withEnvironment({ ...f.env, HOME: f.home, USERPROFILE: f.home }, async () => {
    assert.equal(homedir(), f.home);
    await assert.rejects(assertAcceptanceHome(f.home), /dangerous root or ancestor/);
    assert.equal(await check(f.home), f.home);
  });
  await withEnvironment({ ...f.env, HOME: f.userHome, USERPROFILE: f.userHome, DSH_HOME: f.home }, async () => {
    await assert.rejects(assertAcceptanceHome(f.home), /overlaps a real DSH home\/profile/);
    assert.equal(await check(f.home), f.home);
  });
  await withEnvironment(isolatedEnvironment(f.home, {}), async () => {
    await assert.rejects(assertAcceptanceHome(f.home), /Unsafe test path/);
    assert.equal(await check(f.home), f.home);
    assert.equal(await actualCheck(f.home), f.home);
    // Source objects cannot silently mutate the captured paths after capture, either.
    f.env.DSH_HOME = f.home; f.env.APPDATA = f.home;
    assert.equal(await check(f.home), f.home);
    for (const target of [f.userHome, f.dshHome, f.profile, acceptanceParent, path.parse(f.home).root,
      `${f.home}-sibling`, path.join(f.home, 'child')]) {
      await assert.rejects(check(target), /not the captured acceptance home/);
    }
  });
  assert.equal(await readFile(markerPath, 'utf8'), marker);
});

test('C capture refuses original protected homes, live profile/storage overlap, roots and ancestors', async () => {
  const f = await fixture(), protection = { env: f.env, userHome: f.userHome };
  for (const target of [f.userHome, f.dshHome, path.join(f.dshHome, 'storages'), f.profile,
    path.join(f.userHome, '.dsh'), f.env.APPDATA, f.env.LOCALAPPDATA, acceptanceParent, path.parse(f.home).root]) {
    await assert.rejects(captureAcceptanceHome(target, protection), /Unsafe test path/);
  }
  // A valid marker must never override either real-home protection branch.
  await assert.rejects(captureAcceptanceHome(f.home, { ...protection, userHome: f.home }), /dangerous root or ancestor/);
  await assert.rejects(captureAcceptanceHome(f.home, { ...protection, env: { ...f.env, DSH_HOME: f.home } }), /overlaps a real DSH home\/profile/);
  await assert.rejects(captureAcceptanceHome(f.home, { ...protection, env: { ...f.env, DSH_PROFILE_DIR: path.join(f.home, 'profile') } }), /overlaps a real DSH home\/profile/);
  await assert.rejects(assertIsolatedPath(acceptanceParent, { userHome: f.userHome,
    env: { DSH_HOME: f.dshHome }, parent: acceptanceParent, allowParent: true }), /dangerous root or ancestor/);
  await assert.rejects(captureAcceptanceHome(f.home, { ...protection,
    env: { ...f.env, DSH_HOME: path.join(f.home, 'storages') } }), /overlaps a real DSH home\/profile/);
  // An unmarked directory or even a different properly owned Home cannot use this binding.
  const unmarked = `${f.home}-unmarked`; await mkdir(unmarked);
  await assert.rejects(captureAcceptanceHome(unmarked, protection), /ENOENT/);
  const other = await createAcceptanceHome(path.join(acceptanceParent, `wish-willow-p2-c-${randomUUID()}`));
  const check = await captureAcceptanceHome(f.home, protection);
  await withEnvironment(isolatedEnvironment(other, {}), async () => {
    await assert.rejects(check(other), /not the captured acceptance home/);
  });
});

test('C capture still refuses redirected paths and linked ownership markers', async () => {
  const f = await fixture(), protection = { env: f.env, userHome: f.userHome };
  const alias = `${f.home}-alias`;
  await symlink(f.home, alias, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(captureAcceptanceHome(alias, protection), /link or junction/);
  await assert.rejects(captureAcceptanceHome(path.join(alias, 'child'), protection), /link or junction/);
  const linkedMarkerHome = `${f.home}-linked-marker`; await mkdir(linkedMarkerHome);
  // A directory link is enough to test redirection and needs no Windows file-symlink privilege.
  await symlink(f.home, path.join(linkedMarkerHome, '.wish-willow-test-owner'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(captureAcceptanceHome(linkedMarkerHome, protection), /link or junction/);
});

test('C driver passes pre-boot context without bypassing receipt or fixed-candidate checks', async () => {
  const driver = await readFile(new URL('./run.mjs', import.meta.url), 'utf8');
  const candidate = await readFile(new URL('./fixed-candidate.mjs', import.meta.url), 'utf8');
  const receiptCheck = driver.indexOf('assert.deepEqual(receipt.driver, binding.driver)');
  const capture = driver.indexOf('const checkAcceptanceHome = await captureAcceptanceHome(args.home)');
  assert.ok(receiptCheck >= 0 && capture > receiptCheck);
  assert.match(driver, /assert\.equal\(sha256\(await readFile\(receipt\.archive\)\), receipt\.archiveHash\)/);
  assert.equal((driver.match(/return boot\(args, checkAcceptanceHome,/g) ?? []).length, 2);
  assert.match(driver, /prepareFixedCandidate\(service, index, args\.home, args\.evidence, signal, checkAcceptanceHome\)/);
  assert.match(candidate, /typeof checkAcceptanceHome !== 'function'/);
  assert.match(candidate, /home = await checkAcceptanceHome\(home\)/);
  assert.doesNotMatch(candidate, /assertAcceptanceHome\(home\)/);
});
