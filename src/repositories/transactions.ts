/**
 * Transaction persistence, plus the aggregate reads the dashboard needs.
 *
 * Filtering is composed into a single WHERE clause so the list screen can page
 * through history without loading it all.
 */

import { query, run } from '../db/sqlite';
import type { Id, New, Transaction, TransactionKind } from '../domain/types';
import { newId } from '../lib/id';

interface TransactionRow extends Omit<Transaction, 'pending'> {
  pending: number;
}

function fromRow(row: TransactionRow): Transaction {
  return { ...row, pending: row.pending === 1 };
}

export interface TransactionFilter {
  accountId?: Id;
  categoryId?: Id;
  kind?: TransactionKind;
  /** Inclusive lower bound on `occurredAt`. */
  from?: number;
  /** Exclusive upper bound on `occurredAt`. */
  to?: number;
  /** Case-insensitive match against payee and note. */
  search?: string;
  includePending?: boolean;
}

/** Builds the shared WHERE clause and its bound values. */
function buildWhere(filter: TransactionFilter): { clause: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter.accountId) {
    // An account's ledger includes transfers that landed in it.
    conditions.push('(accountId = ? OR counterAccountId = ?)');
    params.push(filter.accountId, filter.accountId);
  }
  if (filter.categoryId) {
    conditions.push('categoryId = ?');
    params.push(filter.categoryId);
  }
  if (filter.kind) {
    conditions.push('kind = ?');
    params.push(filter.kind);
  }
  if (filter.from !== undefined) {
    conditions.push('occurredAt >= ?');
    params.push(filter.from);
  }
  if (filter.to !== undefined) {
    conditions.push('occurredAt < ?');
    params.push(filter.to);
  }
  if (filter.search) {
    conditions.push('(payee LIKE ? COLLATE NOCASE OR note LIKE ? COLLATE NOCASE)');
    const pattern = `%${filter.search}%`;
    params.push(pattern, pattern);
  }
  if (!filter.includePending) {
    conditions.push('pending = 0');
  }

  return {
    clause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}

export async function list(
  filter: TransactionFilter = {},
  page: { limit?: number; offset?: number } = {},
): Promise<Transaction[]> {
  const { clause, params } = buildWhere({ includePending: true, ...filter });
  const limit = page.limit ?? 50;
  const offset = page.offset ?? 0;

  const rows = await query<TransactionRow>(
    `SELECT * FROM transactions ${clause}
     ORDER BY occurredAt DESC, createdAt DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  return rows.map(fromRow);
}

export async function count(filter: TransactionFilter = {}): Promise<number> {
  const { clause, params } = buildWhere({ includePending: true, ...filter });
  const rows = await query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM transactions ${clause}`,
    params,
  );
  return rows[0]?.n ?? 0;
}

export async function get(id: Id): Promise<Transaction | null> {
  const rows = await query<TransactionRow>('SELECT * FROM transactions WHERE id = ?', [id]);
  return rows[0] ? fromRow(rows[0]) : null;
}

/** Totals for a window, used by the dashboard summary. */
export async function totals(
  from: number,
  to: number,
  currency: string,
): Promise<{ income: number; expense: number; net: number }> {
  const rows = await query<{ kind: TransactionKind; total: number }>(
    `SELECT kind, SUM(amount) AS total
     FROM transactions
     WHERE pending = 0 AND currency = ? AND occurredAt >= ? AND occurredAt < ?
       AND kind IN ('income', 'expense')
     GROUP BY kind`,
    [currency, from, to],
  );

  const income = rows.find((r) => r.kind === 'income')?.total ?? 0;
  const expense = rows.find((r) => r.kind === 'expense')?.total ?? 0;
  return { income, expense, net: income - expense };
}

export interface CategoryTotal {
  categoryId: Id | null;
  total: number;
}

/** Spending per category in a window, largest first. Powers the breakdown chart. */
export async function spendingByCategory(
  from: number,
  to: number,
  currency: string,
): Promise<CategoryTotal[]> {
  return query<CategoryTotal>(
    `SELECT categoryId, SUM(amount) AS total
     FROM transactions
     WHERE kind = 'expense' AND pending = 0 AND currency = ?
       AND occurredAt >= ? AND occurredAt < ?
     GROUP BY categoryId
     ORDER BY total DESC`,
    [currency, from, to],
  );
}

export interface MonthlySpend {
  /** Local midnight on the first of the month. */
  monthStart: number;
  total: number;
}

/**
 * Expense totals for the last `count` months, oldest first, including months
 * with no spending so the bar chart keeps a stable width.
 *
 * Grouping happens in JS rather than SQL because SQLite's date functions work
 * in UTC, which would shift a transaction near midnight into the wrong month
 * for anyone east or west of Greenwich.
 */
export async function monthlySpend(
  count: number,
  currency: string,
  at = Date.now(),
): Promise<MonthlySpend[]> {
  const now = new Date(at);
  const firstMonth = new Date(now.getFullYear(), now.getMonth() - (count - 1), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const rows = await query<{ occurredAt: number; amount: number }>(
    `SELECT occurredAt, amount FROM transactions
     WHERE kind = 'expense' AND pending = 0 AND currency = ?
       AND occurredAt >= ? AND occurredAt < ?`,
    [currency, firstMonth.getTime(), end.getTime()],
  );

  const buckets = new Map<number, number>();
  for (let i = 0; i < count; i += 1) {
    const month = new Date(firstMonth.getFullYear(), firstMonth.getMonth() + i, 1);
    buckets.set(month.getTime(), 0);
  }

  for (const row of rows) {
    const d = new Date(row.occurredAt);
    const key = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    const current = buckets.get(key);
    if (current !== undefined) buckets.set(key, current + row.amount);
  }

  return [...buckets].map(([monthStart, total]) => ({ monthStart, total }));
}

export async function create(draft: New<Transaction>): Promise<Transaction> {
  if (draft.amount <= 0) {
    throw new Error('Transaction amount must be positive; direction comes from `kind`.');
  }
  if (draft.kind === 'transfer' && !draft.counterAccountId) {
    throw new Error('A transfer needs a destination account.');
  }
  if (draft.kind === 'transfer' && draft.counterAccountId === draft.accountId) {
    throw new Error('A transfer needs two different accounts.');
  }

  const now = Date.now();
  const transaction: Transaction = { ...draft, id: newId(), createdAt: now, updatedAt: now };

  await run(
    `INSERT INTO transactions
       (id, kind, amount, currency, accountId, counterAccountId, categoryId,
        payee, note, occurredAt, pending, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      transaction.id,
      transaction.kind,
      transaction.amount,
      transaction.currency,
      transaction.accountId,
      transaction.counterAccountId,
      transaction.categoryId,
      transaction.payee,
      transaction.note,
      transaction.occurredAt,
      transaction.pending ? 1 : 0,
      transaction.createdAt,
      transaction.updatedAt,
    ],
  );

  return transaction;
}

export async function update(id: Id, patch: Partial<New<Transaction>>): Promise<void> {
  const fields = Object.keys(patch) as (keyof New<Transaction>)[];
  if (fields.length === 0) return;

  const assignments = fields.map((f) => `${f} = ?`).join(', ');
  const values = fields.map((f) => {
    const value = patch[f];
    return typeof value === 'boolean' ? (value ? 1 : 0) : value;
  });

  await run(`UPDATE transactions SET ${assignments}, updatedAt = ? WHERE id = ?`, [
    ...values,
    Date.now(),
    id,
  ]);
}

export async function remove(id: Id): Promise<void> {
  await run('DELETE FROM transactions WHERE id = ?', [id]);
}

/** Groups a loaded page by calendar day for the sectioned list UI. */
export function groupByDay(transactions: Transaction[]): { day: number; items: Transaction[] }[] {
  const groups = new Map<number, Transaction[]>();

  for (const transaction of transactions) {
    const date = new Date(transaction.occurredAt);
    const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const bucket = groups.get(day);
    if (bucket) bucket.push(transaction);
    else groups.set(day, [transaction]);
  }

  return [...groups.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([day, items]) => ({ day, items }));
}
