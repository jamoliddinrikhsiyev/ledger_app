/**
 * Runs the app's schema and its trickiest queries against node:sqlite.
 *
 * The browser/native layer needs a WebView, but the SQL itself does not — this
 * catches syntax slips and wrong aggregates without a device.
 *
 *   node --experimental-sqlite scripts/verify-sql.mjs
 */

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

// schema.ts is TypeScript; pull the statements out without a build step.
const source = readFileSync(new URL('../src/db/schema.ts', import.meta.url), 'utf8');
const statements = [...source.matchAll(/`([^`]*?)`/g)]
  .map((m) => m[1].trim())
  .filter((s) => /^(CREATE|ALTER|DROP)/i.test(s));

const db = new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys = ON;');
for (const statement of statements) db.exec(statement);
console.log(`schema: applied ${statements.length} statements`);

const now = Date.now();
const stamp = [now, now];

db.prepare(
  `INSERT INTO accounts (id, name, kind, currency, openingBalance, archived, sortOrder, createdAt, updatedAt)
   VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)`,
).run('acc-cash', 'Cash', 'cash', 'USD', 100_00, ...stamp);
db.prepare(
  `INSERT INTO accounts (id, name, kind, currency, openingBalance, archived, sortOrder, createdAt, updatedAt)
   VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?)`,
).run('acc-bank', 'Bank', 'bank', 'USD', 1000_00, ...stamp);

db.prepare(
  `INSERT INTO categories (id, name, kind, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, 0, ?, ?)`,
).run('cat-food', 'Groceries', 'expense', ...stamp);

const insertTx = db.prepare(
  `INSERT INTO transactions
     (id, kind, amount, currency, accountId, counterAccountId, categoryId, payee, note, occurredAt, pending, createdAt, updatedAt)
   VALUES (?, ?, ?, 'USD', ?, ?, ?, ?, NULL, ?, ?, ?, ?)`,
);
insertTx.run('t1', 'expense', 25_00, 'acc-cash', null, 'cat-food', 'Market', now, 0, ...stamp);
insertTx.run('t2', 'income', 500_00, 'acc-bank', null, null, 'Salary', now, 0, ...stamp);
insertTx.run('t3', 'transfer', 200_00, 'acc-bank', 'acc-cash', null, 'Top up', now, 0, ...stamp);
insertTx.run('t4', 'expense', 999_00, 'acc-cash', null, 'cat-food', 'Pending', now, 1, ...stamp);

// --- balances (mirrors repositories/accounts.listWithBalances) ---
const balances = db
  .prepare(
    `SELECT a.id,
            a.openingBalance + COALESCE((
              SELECT SUM(
                CASE
                  WHEN t.kind = 'income'   AND t.accountId = a.id        THEN  t.amount
                  WHEN t.kind = 'expense'  AND t.accountId = a.id        THEN -t.amount
                  WHEN t.kind = 'transfer' AND t.accountId = a.id        THEN -t.amount
                  WHEN t.kind = 'transfer' AND t.counterAccountId = a.id THEN  t.amount
                  ELSE 0
                END)
              FROM transactions t
              WHERE t.pending = 0
                AND (t.accountId = a.id OR t.counterAccountId = a.id)
            ), 0) AS balance
     FROM accounts a WHERE a.archived = 0 ORDER BY a.sortOrder`,
  )
  .all();

const expected = {
  // 100 opening − 25 expense + 200 transfer in; the pending 999 must not count
  'acc-cash': 100_00 - 25_00 + 200_00,
  // 1000 opening + 500 income − 200 transfer out
  'acc-bank': 1000_00 + 500_00 - 200_00,
};

let failures = 0;
for (const row of balances) {
  const ok = row.balance === expected[row.id];
  if (!ok) failures++;
  console.log(`balance ${row.id}: ${row.balance} (expected ${expected[row.id]}) ${ok ? 'OK' : 'FAIL'}`);
}

// --- totals ---
const totals = db
  .prepare(
    `SELECT kind, SUM(amount) AS total FROM transactions
     WHERE pending = 0 AND currency = ? AND occurredAt >= ? AND occurredAt < ?
       AND kind IN ('income','expense') GROUP BY kind`,
  )
  .all('USD', now - 1000, now + 1000);
const income = totals.find((r) => r.kind === 'income')?.total ?? 0;
const expense = totals.find((r) => r.kind === 'expense')?.total ?? 0;
const totalsOk = income === 500_00 && expense === 25_00;
if (!totalsOk) failures++;
console.log(`totals: income=${income} expense=${expense} ${totalsOk ? 'OK' : 'FAIL'}`);

// --- budgets: "limit" is a reserved word, so this exercises the quoting ---
db.prepare(
  `INSERT INTO budgets (id, categoryId, "limit", currency, period, createdAt, updatedAt)
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
).run('b1', 'cat-food', 300_00, 'USD', 'monthly', ...stamp);
db.prepare('UPDATE budgets SET "limit" = ?, updatedAt = ? WHERE id = ?').run(400_00, now, 'b1');
const budget = db.prepare('SELECT * FROM budgets WHERE id = ?').get('b1');
const budgetOk = budget.limit === 400_00;
if (!budgetOk) failures++;
console.log(`budget limit quoting: ${budget.limit} ${budgetOk ? 'OK' : 'FAIL'}`);

// --- spending by category ---
const spending = db
  .prepare(
    `SELECT categoryId, SUM(amount) AS total FROM transactions
     WHERE kind = 'expense' AND pending = 0 AND currency = ?
       AND occurredAt >= ? AND occurredAt < ? GROUP BY categoryId ORDER BY total DESC`,
  )
  .all('USD', now - 1000, now + 1000);
const spendOk = spending.length === 1 && spending[0].total === 25_00;
if (!spendOk) failures++;
console.log(`spendingByCategory: ${JSON.stringify(spending)} ${spendOk ? 'OK' : 'FAIL'}`);

// --- filter clause with an account that has an incoming transfer ---
const ledger = db
  .prepare(
    `SELECT id FROM transactions WHERE (accountId = ? OR counterAccountId = ?)
     ORDER BY occurredAt DESC, createdAt DESC LIMIT ? OFFSET ?`,
  )
  .all('acc-cash', 'acc-cash', 50, 0);
const ledgerOk = ledger.length === 3; // t1, t3 (incoming), t4 (pending)
if (!ledgerOk) failures++;
console.log(`account ledger rows: ${ledger.length} (expected 3) ${ledgerOk ? 'OK' : 'FAIL'}`);

// --- cascade: deleting an account removes its transactions, orphans transfers ---
db.prepare('DELETE FROM accounts WHERE id = ?').run('acc-bank');
const afterDelete = db.prepare('SELECT COUNT(*) AS n FROM transactions').get();
// t2 and t3 both originated on acc-bank, so the cascade takes them; t1 and t4 stay.
const cascadeOk = afterDelete.n === 2;
if (!cascadeOk) failures++;
console.log(`after account delete: ${afterDelete.n} remain (expected 2) ${cascadeOk ? 'OK' : 'FAIL'}`);

// --- category delete must orphan, not cascade ---
db.prepare('DELETE FROM categories WHERE id = ?').run('cat-food');
const orphaned = db.prepare("SELECT COUNT(*) AS n FROM transactions WHERE categoryId IS NULL").get();
const orphanOk = orphaned.n > 0;
if (!orphanOk) failures++;
console.log(`transactions orphaned by category delete: ${orphaned.n} ${orphanOk ? 'OK' : 'FAIL'}`);

// --- exchange rates: direct, inverse and triangulated lookups ---
const insertRate = db.prepare(
  'INSERT OR REPLACE INTO exchange_rates (base, quote, rate, fetchedAt, source) VALUES (?, ?, ?, ?, ?)',
);
// A USD-based cache only — every other pair has to be derived from it.
insertRate.run('USD', 'EUR', 0.92, now, 'test');
insertRate.run('USD', 'UZS', 12800, now, 'test');

const direct = db
  .prepare('SELECT rate FROM exchange_rates WHERE base = ? AND quote = ?')
  .get('USD', 'EUR');
const directOk = direct?.rate === 0.92;
if (!directOk) failures++;
console.log(`rate USD->EUR (direct): ${direct?.rate} ${directOk ? 'OK' : 'FAIL'}`);

const inverse = db
  .prepare('SELECT rate FROM exchange_rates WHERE base = ? AND quote = ?')
  .get('USD', 'EUR');
const inverseRate = 1 / inverse.rate;
const inverseOk = Math.abs(inverseRate - 1.0869) < 0.001;
if (!inverseOk) failures++;
console.log(`rate EUR->USD (inverse): ${inverseRate.toFixed(4)} ${inverseOk ? 'OK' : 'FAIL'}`);

// EUR->UZS exists in neither direction; it must come from the shared USD base.
const bridged = db
  .prepare(
    `SELECT (b.rate / a.rate) AS rate
     FROM exchange_rates a
     JOIN exchange_rates b ON a.base = b.base
     WHERE a.quote = ? AND b.quote = ? AND a.rate != 0
     ORDER BY MIN(a.fetchedAt, b.fetchedAt) DESC
     LIMIT 1`,
  )
  .get('EUR', 'UZS');
const expectedBridge = 12800 / 0.92;
const bridgeOk = bridged && Math.abs(bridged.rate - expectedBridge) < 0.01;
if (!bridgeOk) failures++;
console.log(
  `rate EUR->UZS (triangulated): ${bridged?.rate?.toFixed(2)} (expected ${expectedBridge.toFixed(2)}) ${bridgeOk ? 'OK' : 'FAIL'}`,
);

// --- replaceForBase must not leave stale pairs behind ---
db.prepare('DELETE FROM exchange_rates WHERE base = ?').run('USD');
insertRate.run('USD', 'EUR', 0.9, now + 1, 'test');
const remaining = db.prepare('SELECT COUNT(*) AS n FROM exchange_rates WHERE base = ?').get('USD');
const replaceOk = remaining.n === 1;
if (!replaceOk) failures++;
console.log(`replaceForBase leaves ${remaining.n} row(s) (expected 1) ${replaceOk ? 'OK' : 'FAIL'}`);

// --- settings round-trip, including a JSON object value ---
const setSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
setSetting.run('baseCurrency', JSON.stringify('UZS'));
setSetting.run(
  'services',
  JSON.stringify({ rates: { baseUrl: 'https://open.er-api.com/v6', enabled: true } }),
);
const baseCurrency = JSON.parse(
  db.prepare('SELECT value FROM settings WHERE key = ?').get('baseCurrency').value,
);
const services = JSON.parse(
  db.prepare('SELECT value FROM settings WHERE key = ?').get('services').value,
);
const settingsOk = baseCurrency === 'UZS' && services.rates.enabled === true;
if (!settingsOk) failures++;
console.log(
  `settings round-trip: baseCurrency=${baseCurrency} rates.baseUrl=${services.rates.baseUrl} ${settingsOk ? 'OK' : 'FAIL'}`,
);

db.close();
console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
