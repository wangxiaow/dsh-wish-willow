// Real-browser UI driver for the isolated Wish Willow acceptance Host.
//
// It attaches to the dedicated Chrome instance over the DevTools Protocol and drives the
// rendered product UI with genuine input events (`Input.dispatchMouseEvent` /
// `Input.dispatchKeyEvent`), exactly the path Playwright and Puppeteer use. It never calls
// the product's RPC endpoints, never injects application state and never fabricates a page:
// every action lands on a real DOM control of the real page served by the isolated Host.
//
// Element lookup uses the standard automation technique (a selector, then the element's
// client rect); everything else is a real user-level event.
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const args = process.argv.slice(2);
const option = name => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? undefined : args[index + 1];
};
const origin = option('origin') ?? 'http://127.0.0.1:3081';
const debugPort = Number(option('debug-port') ?? 9333);
const label = option('label') ?? 'ui';
const outDir = resolve(option('out') ?? resolve(repo, 'docs/evidence/p1-unification/web'));
mkdirSync(outDir, { recursive: true });
const log = entry => appendFileSync(resolve(outDir, 'driver.jsonl'), `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`);

const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
const pages = targets.filter(target => target.type === 'page' && /^https?:\/\//.test(target.url));
if (pages.length !== 1) throw new Error(`expected exactly one http page in the isolated browser, found ${pages.length}`);
const pageUrl = new URL(pages[0].url);
if (pageUrl.origin !== origin) throw new Error(`page origin ${pageUrl.origin} is not the isolated origin ${origin}`);
console.log(`attached to ${pageUrl.origin} (title '${pages[0].title}')`);

const socket = new WebSocket(pages[0].webSocketDebuggerUrl);
const pending = new Map();
let sequence = 0;
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.id === undefined) return;
  const entry = pending.get(message.id);
  if (!entry) return;
  pending.delete(message.id);
  if (message.error) entry.reject(new Error(`${entry.method}: ${message.error.message}`));
  else entry.resolve(message.result);
});
await new Promise((ok, fail) => {
  socket.addEventListener('open', ok, { once: true });
  socket.addEventListener('error', () => fail(new Error('devtools socket failed')), { once: true });
});
function send(method, params = {}) {
  const id = ++sequence;
  return new Promise((ok, fail) => {
    pending.set(id, { resolve: ok, reject: fail, method });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? 'page evaluation failed');
  return result.result.value;
}
const rectScript = query => `(() => {
  const locate = () => {
    const query = ${JSON.stringify(query)};
    const visible = element => element && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
    if (query.startsWith('#')) return document.querySelector(query);
    const wanted = query.startsWith('text=') ? query.slice(5) : query.slice(9);
    const exact = query.startsWith('text=');
    const candidates = [...document.querySelectorAll('button,[role="button"],a,[role="tab"],[role="menuitem"],summary')]
      .filter(element => visible(element) && (exact ? element.textContent.trim() === wanted : element.textContent.includes(wanted)))
      .filter(element => !element.matches('[disabled],[aria-disabled="true"]'));
    return candidates[0];
  };
  const element = locate();
  if (!element) return null;
  // Same auto-scroll a real user performs before clicking an off-viewport control.
  element.scrollIntoView({ block: 'center', inline: 'center' });
  const rect = element.getBoundingClientRect();
  const withinViewport = rect.top >= 0 && rect.left >= 0 && rect.bottom <= innerHeight && rect.right <= innerWidth;
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, width: rect.width, height: rect.height,
    text: element.textContent.trim().slice(0, 120), id: element.id || null, withinViewport };
})()`;
async function locate(query) {
  const hit = await evaluate(rectScript(query));
  if (!hit) throw new Error(`no visible element matches '${query}'`);
  return hit;
}
async function click(query) {
  const hit = await locate(query);
  if (!hit.withinViewport) throw new Error(`'${query}' is still outside the viewport after scrolling (${JSON.stringify(hit)})`);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: hit.x, y: hit.y, button: 'none' });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: hit.x, y: hit.y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: hit.x, y: hit.y, button: 'left', clickCount: 1 });
  log({ action: 'click', query, hit });
  console.log(`clicked '${query}' -> ${hit.id ?? '<no id>'} '${hit.text}' at (${Math.round(hit.x)},${Math.round(hit.y)})`);
}
async function key(name, code) {
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: name, code, windowsVirtualKeyCode: code === 'Enter' ? 13 : 9 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code, windowsVirtualKeyCode: code === 'Enter' ? 13 : 9 });
}
async function type(query, text) {
  await click(query);
  for (const character of text) {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', text: character, unmodifiedText: character });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', text: character, unmodifiedText: character });
  }
  const value = await evaluate(`document.querySelector(${JSON.stringify(query)}).value`);
  if (value !== text) throw new Error(`typed value mismatch for ${query}: '${value}'`);
  log({ action: 'type', query, characters: text.length });
  console.log(`typed ${text.length} characters into ${query}`);
}
const snapshotScript = `(() => {
  const panel = document.querySelector('#ww-app');
  const text = selector => { const element = document.querySelector(selector); return element ? element.textContent.trim() : null; };
  const rows = selector => [...document.querySelectorAll(selector)].map(element => ({
    id: element.id || null, text: (element.innerText || element.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 400) }));
  const sections = [...document.querySelectorAll('#ww-product-list button')]
    .filter(element => !['ww-create', 'ww-reload'].includes(element.id))
    .map(element => element.textContent.trim());
  const panelClone = panel ? panel.cloneNode(true) : null;
  if (panelClone) for (const node of panelClone.querySelectorAll('style,script')) node.remove();
  return {
    panelPresent: panel !== null,
    ariaBusy: panel ? panel.getAttribute('aria-busy') : null,
    panelText: panelClone ? panelClone.textContent.replace(/\\s+/g, ' ').trim().slice(0, 6000) : null,
    status: text('#ww-status-label'), revision: text('#ww-revision'), version: text('#ww-version'),
    workspace: text('#ww-overview'), notice: text('#ww-notice'), error: text('#ww-error'),
    productTitle: text('#ww-product-title'), goal: text('#ww-goal'), currentWish: text('#ww-current-wish'),
    confirmed: rows('#ww-requirements-confirmed li'), inferred: rows('#ww-requirements-inferred li'),
    constraints: rows('#ww-constraints li'), decisions: rows('#ww-decision-history li'),
    tasks: rows('#ww-tasks .ww-task'), runs: rows('#ww-runs tbody tr'), evidence: rows('#ww-evidence tbody tr'),
    build: text('#ww-build-status'), evidenceKinds: text('#ww-evidence-kinds'), tests: text('#ww-test-status'),
    artifacts: text('#ww-artifacts'), snapshot: text('#ww-snapshot'), startCommand: text('#ww-start-command'),
    versions: rows('#ww-versions tbody tr'), suggestions: text('#ww-suggestion'),
    products: sections, legacyProducts: [...document.querySelectorAll('#ww-legacy-list button')].map(element => element.textContent.trim()),
    legacyEditorOpen: document.querySelector('#ww-legacy-title') !== null,
  };
})()`;
async function snapshot(tag) {
  const value = await evaluate(snapshotScript);
  writeFileSync(resolve(outDir, `${tag}.json`), JSON.stringify(value, null, 2));
  log({ action: 'snapshot', tag, panelPresent: value.panelPresent, status: value.status });
  console.log(`snapshot ${tag}: panel=${value.panelPresent} status=${value.status} products=${value.products.length} legacy=${value.legacyProducts.length}`);
  return value;
}
async function screenshot(tag) {
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(resolve(outDir, `${tag}.png`), Buffer.from(shot.data, 'base64'));
  log({ action: 'screenshot', tag });
  console.log(`screenshot ${tag}.png`);
}

const command = args[0];
const value = option('value') ?? '';
switch (command) {
  case 'click': await click(args[1]); break;
  case 'type': await type(args[1], value); break;
  case 'press': await key(value === 'Enter' ? 'Enter' : 'Tab', value === 'Enter' ? 'Enter' : 'Tab'); console.log(`pressed ${value}`); break;
  case 'wait': {
    const deadline = Date.now() + Number(option('timeout') ?? 15000);
    let found = null;
    while (Date.now() < deadline) {
      found = await evaluate(`(() => { const hit = ${rectScript(args[1])}; return hit; })()`).catch(() => null);
      if (found) break;
      await new Promise(ok => setTimeout(ok, 250));
    }
    if (!found) throw new Error(`timed out waiting for '${args[1]}'`);
    console.log(`wait ok: '${args[1]}' -> '${found.text}'`);
    break;
  }
  case 'wait-text': {
    const deadline = Date.now() + Number(option('timeout') ?? 120000);
    let current = null;
    while (Date.now() < deadline) {
      current = await evaluate(`(document.body.innerText || '').includes(${JSON.stringify(value)})`);
      if (current) break;
      await new Promise(ok => setTimeout(ok, 500));
    }
    if (!current) throw new Error(`timed out waiting for text '${value}'`);
    console.log(`text '${value}' is present`);
    break;
  }
  case 'text': console.log(await evaluate(`(document.querySelector(${JSON.stringify(args[1])}) || {}).textContent || '<missing>'`)); break;
  case 'snapshot': await snapshot(label); break;
  case 'screenshot': await screenshot(label); break;
  case 'reload':
    await send('Page.reload', { ignoreCache: true });
    await new Promise(ok => setTimeout(ok, Number(option('settle') ?? 4000)));
    log({ action: 'reload' });
    console.log('page reloaded');
    break;
  case 'eval': console.log(JSON.stringify(await evaluate(args[1]))); break;
  case 'buttons': {
    const rows = await evaluate(`[...document.querySelectorAll('button,[role="button"],a,[role="tab"]')]
      .filter(element => element.getClientRects().length > 0)
      .map(element => { const r = element.getBoundingClientRect();
        return { text: element.textContent.trim().slice(0, 40), id: element.id || null, x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), w: Math.round(r.width), h: Math.round(r.height) }; })`);
    console.log(JSON.stringify(rows, null, 1));
    break;
  }
  case 'body-text': {
    const text = await evaluate('document.body.innerText');
    writeFileSync(resolve(outDir, `${label}-body.txt`), text);
    console.log(text.slice(0, 2000));
    break;
  }
  default: throw new Error(`unknown command '${command}'`);
}
socket.close();
