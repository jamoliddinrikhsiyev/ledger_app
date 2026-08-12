/**
 * Drives the running app in a real browser: boots it, writes data, changes the
 * base currency, and pokes the closed rates service.
 *
 * This is the only way to exercise the browser SQLite path (jeep-sqlite + wasm
 * + IndexedDB), which node-side checks cannot reach.
 *
 *   node scripts/drive-app.mjs [url]
 */

import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://localhost:5180/';
const shots = new URL('../.screenshots/', import.meta.url).pathname;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 430, height: 932 } });

const consoleErrors = [];
const requests = [];
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
// Anything leaving the origin would mean the service gates leaked.
page.on('request', (r) => {
  if (!r.url().startsWith(new URL(url).origin) && !r.url().startsWith('data:')) {
    requests.push(`${r.method()} ${r.url()}`);
  }
});

function log(label, value) {
  console.log(`${label.padEnd(28)} ${value}`);
}

await page.goto(url, { waitUntil: 'networkidle' });

// The card only renders once the database is open and read.
await page.getByText('Schema version').waitFor({ timeout: 30_000 });
log('database opened', 'yes');

const readNote = async (label) =>
  (await page.locator('ion-item', { hasText: label }).first().locator('ion-note').innerText()).trim();

log('schema version', await readNote('Schema version'));
log('seeded categories', await readNote('Seeded categories'));
log('accounts (before)', await readNote('Accounts'));
log('transactions (before)', await readNote('Transactions'));

await page.screenshot({ path: `${shots}01-boot.png`, fullPage: true });

// --- write path ---
await page.getByRole('button', { name: 'Write sample data' }).click();
await page.getByText('Wrote 1 account').waitFor({ timeout: 15_000 });
log('accounts (after write)', await readNote('Accounts'));
log('transactions (after write)', await readNote('Transactions'));

const netWorth = await page.locator('ion-card-title', { hasText: 'Net worth' }).innerText();
log('derived net worth', netWorth.replace(/\s+/g, ' '));
await page.screenshot({ path: `${shots}02-after-write.png`, fullPage: true });

// --- base currency change ---
await page.locator('ion-select').click();
await page.locator('ion-alert button', { hasText: 'UZS' }).first().click();
await page.locator('ion-alert button', { hasText: /^OK$/ }).click();
await page.waitForTimeout(1500);
const converted = await page.locator('ion-card-title', { hasText: 'Net worth' }).innerText();
log('net worth after switch', converted.replace(/\s+/g, ' '));
const warning = await page.locator('ion-note[color="warning"]').count();
log('unconverted-currency flag', warning > 0 ? 'shown' : 'none');
await page.screenshot({ path: `${shots}03-currency-uzs.png`, fullPage: true });

// --- the closed service gate ---
await page.getByRole('button', { name: 'Try rates refresh' }).click();
await page.locator('#status-message').waitFor({ timeout: 15_000 });
log('rates refresh result', (await page.locator('#status-message').innerText()).trim());
await page.screenshot({ path: `${shots}04-rates-gate.png`, fullPage: true });

// --- persistence across a reload ---
await page.reload({ waitUntil: 'networkidle' });
await page.getByText('Schema version').waitFor({ timeout: 30_000 });
log('accounts after reload', await readNote('Accounts'));
log('transactions after reload', await readNote('Transactions'));

console.log('');
log('outbound requests', requests.length === 0 ? 'none (0)' : requests.join(', '));
log('console errors', consoleErrors.length === 0 ? 'none' : consoleErrors.join(' | '));

await browser.close();
process.exit(consoleErrors.length === 0 && requests.length === 0 ? 0 : 1);
