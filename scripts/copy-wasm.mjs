/**
 * Copies the SQLite wasm binary into `public/assets/`.
 *
 * jeep-sqlite loads it at runtime from `/assets/sql-wasm.wasm` — it is fetched
 * by the browser, not bundled, so it has to be a static asset. Run from
 * `postinstall` so a fresh clone works without anyone remembering this.
 *
 * The binary must match the sql.js JS glue that jeep-sqlite compiled into its
 * own bundle. A mismatch does not fail here — it surfaces in the browser as
 * `LinkError: function import requires a callable`, which points nowhere near
 * the real cause. Hence the version guard below: `sql.js` is pinned exactly in
 * devDependencies, and drifting off it should be loud.
 */

import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Versions verified against jeep-sqlite 2.8.0. 1.13+ needs a newer glue. */
const KNOWN_GOOD = ['1.11.0', '1.12.0'];

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = `${root}/node_modules/sql.js/dist/sql-wasm.wasm`;
const target = `${root}/public/assets/sql-wasm.wasm`;

try {
  const { version } = JSON.parse(
    readFileSync(`${root}/node_modules/sql.js/package.json`, 'utf8'),
  );

  if (!KNOWN_GOOD.includes(version)) {
    console.warn(
      `\n  WARNING: sql.js is ${version}; jeep-sqlite is known to work with ` +
        `${KNOWN_GOOD.join(' or ')}.\n` +
        `  If the browser reports "LinkError: function import requires a callable",\n` +
        `  pin it: npm i -D --save-exact sql.js@${KNOWN_GOOD.at(-1)}\n`,
    );
  }

  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
  console.log(`copied sql-wasm.wasm (sql.js ${version}) -> public/assets/`);
} catch (error) {
  // A missing binary breaks the browser build only; native builds are fine.
  console.warn(`could not copy sql-wasm.wasm: ${error.message}`);
}
