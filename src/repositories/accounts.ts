/**
 * Account persistence. Balances are derived from transactions on read rather
 * than cached on the row, so an edited or deleted transaction can never leave a
 * stale balance behind.
 */

import { query, run } from '../db/sqlite';
import type { Account, AccountWithBalance, Id, New } from '../domain/types';
import { newId } from '../lib/id';
import * as rates from './rates';

interface AccountRow extends Omit<Account, 'archived'> {
  archived: number;
}

function fromRow(row: AccountRow): Account {
  return { ...row, archived: row.archived === 1 };
}

export async function list(options: { includeArchived?: boolean } = {}): Promise<Account[]> {
  const rows = await query<AccountRow>(
    `SELECT * FROM accounts
     ${options.includeArchived ? '' : 'WHERE archived = 0'}
     ORDER BY sortOrder ASC, createdAt ASC`,
  );
  return rows.map(fromRow);
}

export async function get(id: Id): Promise<Account | null> {
  const rows = await query<AccountRow>('SELECT * FROM accounts WHERE id = ?', [id]);
  return rows[0] ? fromRow(rows[0]) : null;
}

/**
 * Accounts with balances, in one pass.
 *
 * The correlated subquery sums each account's effect: income adds, expense
 * subtracts, and a transfer subtracts from its source while adding to its
 * destination. Pending rows are excluded.
 */
export async function listWithBalances(
  options: { includeArchived?: boolean } = {},
): Promise<AccountWithBalance[]> {
  const rows = await query<AccountRow & { balance: number }>(
    `SELECT a.*,
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
     FROM accounts a
     ${options.includeArchived ? '' : 'WHERE a.archived = 0'}
     ORDER BY a.sortOrder ASC, a.createdAt ASC`,
  );

  return rows.map((row) => ({ ...fromRow(row), balance: row.balance }));
}

export interface NetWorth {
  /** Total in `currency` minor units, covering every convertible account. */
  total: number;
  /** Currencies excluded because no cached rate reaches `currency`. */
  missing: string[];
  /** Per-currency subtotals before conversion, for the breakdown view. */
  byCurrency: { currency: string; total: number }[];
  currency: string;
}

/**
 * Net worth across every account, converted into `currency` using cached rates.
 *
 * Accounts in currencies the rate cache cannot reach are reported in `missing`
 * rather than silently dropped, so the UI can flag an incomplete total. With an
 * empty cache and mixed currencies, only same-currency accounts contribute.
 */
export async function netWorth(currency: string): Promise<NetWorth> {
  const target = currency.toUpperCase();
  const accounts = await listWithBalances();

  const subtotals = new Map<string, number>();
  for (const account of accounts) {
    const code = account.currency.toUpperCase();
    subtotals.set(code, (subtotals.get(code) ?? 0) + account.balance);
  }

  const summary = await rates.sumInto(
    [...subtotals].map(([currency, minorUnits]) => ({ currency, minorUnits })),
    target,
  );

  return {
    total: summary.total,
    missing: summary.missing,
    byCurrency: [...subtotals]
      .map(([currency, total]) => ({ currency, total }))
      .sort((a, b) => b.total - a.total),
    currency: target,
  };
}

/** Net worth across accounts sharing `currency`, with no conversion involved. */
export async function totalBalance(currency: string): Promise<number> {
  const accounts = await listWithBalances();
  return accounts
    .filter((a) => a.currency.toUpperCase() === currency.toUpperCase())
    .reduce((sum, a) => sum + a.balance, 0);
}

export async function create(draft: New<Account>): Promise<Account> {
  const now = Date.now();
  const account: Account = { ...draft, id: newId(), createdAt: now, updatedAt: now };

  await run(
    `INSERT INTO accounts
       (id, name, kind, currency, openingBalance, color, icon, last4, archived, sortOrder, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      account.id,
      account.name,
      account.kind,
      account.currency,
      account.openingBalance,
      account.color,
      account.icon,
      account.last4,
      account.archived ? 1 : 0,
      account.sortOrder,
      account.createdAt,
      account.updatedAt,
    ],
  );

  return account;
}

export async function update(id: Id, patch: Partial<New<Account>>): Promise<void> {
  const fields = Object.keys(patch) as (keyof New<Account>)[];
  if (fields.length === 0) return;

  const assignments = fields.map((f) => `${f} = ?`).join(', ');
  const values = fields.map((f) => {
    const value = patch[f];
    return typeof value === 'boolean' ? (value ? 1 : 0) : value;
  });

  await run(`UPDATE accounts SET ${assignments}, updatedAt = ? WHERE id = ?`, [
    ...values,
    Date.now(),
    id,
  ]);
}

/** Hides an account without touching its history. Prefer this over `remove`. */
export async function archive(id: Id): Promise<void> {
  await run('UPDATE accounts SET archived = 1, updatedAt = ? WHERE id = ?', [Date.now(), id]);
}

/** Deletes the account and, by cascade, every transaction that originated on it. */
export async function remove(id: Id): Promise<void> {
  await run('DELETE FROM accounts WHERE id = ?', [id]);
}
