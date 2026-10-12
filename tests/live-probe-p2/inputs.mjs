// Fixed acceptance inputs only. No candidate execution, Agent creation or model call on import.
import { readFile, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { assertNoLinks } from '../helpers/isolation.mjs';

export const contract = '提供一个本地 ES module，导出 sum(a, b)。输入限定为两个有限的 JavaScript Number，按标准 Number 加法返回两者之和，支持非零、负数与小数。例如 (2, 3) → 5、(-3, 5) → 2、(0.5, 0.25) → 0.75。不要求验证非法输入、不要求网页、持久化、网络或外部依赖。提供相关实际断言和本地启动/冒烟入口。';
export const commands = Object.freeze([['build', 'node --check app.mjs'], ['test', 'node app.test.mjs'], ['run', 'node smoke.mjs']].map(row => Object.freeze(row)));
export const startCommand = 'node smoke.mjs';
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const names = ['app.mjs', 'app.test.mjs', 'smoke.mjs'];
// Exact reviewed text pins; no caller-supplied source or command is accepted.
const texts = [
  ["// Local arithmetic module. Inputs are finite JavaScript Number values.\nexport function sum(a, b) { return a + b; }\n",
    "import assert from 'node:assert/strict';\nimport { sum } from './app.mjs';\nfor (const [a, b, expected] of [[2, 3, 5], [-3, 5, 2], [-2, -3, -5], [0, 0, 0], [0.5, 0.25, 0.75]]) {\n  assert.equal(sum(a, b), expected);\n}\nconsole.log('Arithmetic assertions completed');\n",
    "import { sum } from './app.mjs';\nconsole.log(JSON.stringify({ result: sum(2, 3) }));\n"],
  ["// Local arithmetic module. Inputs are finite JavaScript Number values.\nexport function sum(a, b) { return a - b; }\n",
    "// Arithmetic regression check for zero inputs.\nimport assert from 'node:assert/strict';\nimport { sum } from './app.mjs';\nassert.equal(sum(0, 0), 0);\nconsole.log('Arithmetic assertions completed');\n",
    "import { sum } from './app.mjs';\nconsole.log(JSON.stringify({ result: sum(0, 0) }));\n"],
];
export async function fixedInputs() {
  const result = [];
  for (let index = 0; index < 2; index++) {
    const files = [];
    for (const [i, name] of names.entries()) {
      const file = fileURLToPath(new URL(`${index === 0 ? 'good' : 'bad'}/${name}`, import.meta.url));
      await assertNoLinks(file);
      const stat = await lstat(file);
      if (!stat.isFile() || stat.size > 4096) throw Error('Fixed input must be a bounded regular file');
      const bytes = await readFile(file);
      if (!bytes.equals(Buffer.from(texts[index][i], 'utf8'))) throw Error('Fixed input bytes differ from the reviewed text pin; stop, do not repair');
      files.push({ name, bytes: bytes.length, sha256: sha256(bytes), content: bytes.toString('utf8') });
    }
    result.push({ files }); // no oracle, source directory, input label or expected verdict
  }
  return result;
}
export const inputLedger = inputs => ({ format: 2, source: 'p2-c-neutral-log-inputs', contractHash: sha256(Buffer.from(contract)),
  inputs: inputs.map(input => input.files.map(({ content: _content, ...file }) => file)) });
