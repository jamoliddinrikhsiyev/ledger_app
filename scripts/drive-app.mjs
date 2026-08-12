/**
 * Drives the app through onboarding and every screen in a real browser,
 * capturing a screenshot of each.
 *
 * This is the only way to exercise the browser SQLite path (jeep-sqlite + wasm
 * + IndexedDB) and the only way to see whether the UI actually renders. It also
 * fails if the page makes any off-origin request, which is what keeps the
 * "nothing leaves the device" claim honest.
 *
 *   node scripts/drive-app.mjs [url]
 */

import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://localhost:5180/';
const shots = new URL('../.screenshots/', import.meta.url).pathname;
const origin = new URL(url).origin;

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 402, height: 874 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();

const problems = [];
const offOrigin = [];
page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`));
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('request', (r) => {
  const target = r.url();
  if (!target.startsWith(origin) && !target.startsWith('data:') && !target.startsWith('blob:')) {
    offOrigin.push(`${r.method()} ${target}`);
  }
});

let step = 0;
async function shot(name) {
  step += 1;
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${shots}${String(step).padStart(2, '0')}-${name}.png` });
  console.log(`  captured ${name}`);
}

async function tapTab(label) {
  await page.locator('nav button', { hasText: label }).first().click();
  await page.waitForTimeout(350);
}

console.log('onboarding');
await page.goto(url, { waitUntil: 'networkidle' });
await page.getByText('One running total.').waitFor({ timeout: 30_000 });
await shot('onboarding-intro');

await page.getByRole('button', { name: 'Set up an account' }).click();
await page.getByPlaceholder('Name, e.g. Everyday').fill('Everyday');
await page.locator('button', { hasText: 'Card' }).first().click();
await page.getByPlaceholder('0').last().fill('2400');
await shot('onboarding-account');

await page.getByRole('button', { name: 'Continue' }).click();
await page.getByPlaceholder('0').first().fill('1800');
await shot('onboarding-plan');

await page.getByRole('button', { name: 'Open Ledger' }).click();
await page.getByText('Net worth').waitFor({ timeout: 20_000 });
console.log('home');
await shot('home-empty');

// --- log a transaction through the keypad ---
console.log('add transaction');
await page.locator('nav button', { hasText: 'Add' }).click();
await page.getByText('Amount').waitFor();
// Exact-name matching. Building a regex from the key would turn "\2" into a
// backreference and silently press the wrong button.
const keypad = page.locator('div[style*="repeat(3, 1fr)"]');
for (const key of ['4', '2', '.', '5', '0']) {
  await keypad.getByRole('button', { name: key, exact: true }).click();
}
await page.locator('button', { hasText: 'Groceries' }).first().click();
await page.getByPlaceholder('Who or what (optional)').fill('Corner shop');
await shot('add-transaction');

await page.getByRole('button', { name: 'Save transaction' }).click();
await page.getByText('Net worth').waitFor({ timeout: 20_000 });
await shot('home-with-data');

const netWorth = await page.locator('text=Net worth').locator('..').innerText();
console.log(`  net worth block: ${netWorth.split('\n').slice(0, 3).join(' | ')}`);

console.log('transactions');
await page.getByRole('button', { name: 'See all' }).click();
await page.waitForTimeout(400);
await shot('transactions');

console.log('insights');
await tapTab('Insights');
await shot('insights');

// --- budgets: create one, so the populated state is what gets verified ---
console.log('budgets');
await tapTab('Budgets');
await shot('budgets-empty');
await page.getByRole('button', { name: 'Set a budget' }).click();
await page.locator('div[role], button', { hasText: 'Groceries' }).first().click();
await page.getByPlaceholder('0').fill('400');
await page.getByRole('button', { name: 'Set cap' }).click();
await page.waitForTimeout(600);
await shot('budgets');

console.log('more');
await tapTab('More');
await shot('more');

// --- secondary screens from the More menu ---
for (const [row, name] of [
  ['Accounts', 'accounts'],
  ['Categories', 'categories'],
  ['Currency', 'currency'],
]) {
  console.log(name);
  await tapTab('More');
  await page.locator('main button', { hasText: row }).first().click();
  await page.waitForTimeout(400);
  await shot(name);
}

// --- goals: create one, then contribute to it ---
console.log('goals');
await tapTab('More');
await page.locator('main button', { hasText: 'Savings goals' }).first().click();
await page.getByRole('button', { name: 'New savings goal' }).click();
await page.getByPlaceholder('Goal, e.g. Deposit on a flat').fill('Emergency fund');
await page.getByPlaceholder('10000').fill('5000');
await page.getByRole('button', { name: 'Set target' }).click();
await page.waitForTimeout(700);
await page.locator('main button', { hasText: 'Emergency fund' }).first().click();
await page.getByPlaceholder('Amount').fill('750');
await page.getByRole('button', { name: 'Move to savings' }).click();
await page.waitForTimeout(700);
await shot('goals');

console.log('settings');
await page.locator('header button[aria-label="Settings"]').click();
await page.waitForTimeout(400);
await shot('settings');

// --- persistence: reload lands on the last route, so come back to Home ---
await page.reload({ waitUntil: 'networkidle' });
await page.locator('nav button', { hasText: 'Home' }).waitFor({ timeout: 30_000 });
await tapTab('Home');
await page.getByText('Net worth').waitFor({ timeout: 20_000 });
const survived = await page.locator('text=Corner shop').count();
console.log(`\ntransaction survived reload: ${survived > 0 ? 'yes' : 'NO'}`);

console.log(`off-origin requests:          ${offOrigin.length === 0 ? 'none' : offOrigin.join(', ')}`);
console.log(`console errors:               ${problems.length === 0 ? 'none' : problems.join(' | ')}`);

await browser.close();
process.exit(problems.length === 0 && offOrigin.length === 0 && survived > 0 ? 0 : 1);
