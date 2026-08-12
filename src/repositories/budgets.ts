/**
 * Budget persistence and per-period progress.
 *
 * Budgets recur: a monthly budget applies to whatever month you are looking at,
 * so only the cap is stored and the window is computed on read.
 */

import { query, run } from '../db/sqlite';
import type { Budget, BudgetPeriod, BudgetProgress, Id, New } from '../domain/types';
import { newId } from '../lib/id';

/** Half-open window [start, end) containing `at` for the given period. */
export function periodBounds(
  period: BudgetPeriod,
  at: number,
  weekStartsOn: 0 | 1 = 1,
): { start: number; end: number } {
  const date = new Date(at);

  if (period === 'yearly') {
    return {
      start: new Date(date.getFullYear(), 0, 1).getTime(),
      end: new Date(date.getFullYear() + 1, 0, 1).getTime(),
    };
  }

  if (period === 'monthly') {
    return {
      start: new Date(date.getFullYear(), date.getMonth(), 1).getTime(),
      end: new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime(),
    };
  }

  // Weekly: walk back to the configured first day of the week.
  const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (midnight.getDay() - weekStartsOn + 7) % 7;
  const start = new Date(midnight);
  start.setDate(midnight.getDate() - offset);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);

  return { start: start.getTime(), end: end.getTime() };
}

export async function list(): Promise<Budget[]> {
  return query<Budget>('SELECT * FROM budgets ORDER BY createdAt ASC');
}

export async function get(id: Id): Promise<Budget | null> {
  const rows = await query<Budget>('SELECT * FROM budgets WHERE id = ?', [id]);
  return rows[0] ?? null;
}

/**
 * Budgets joined with spending in their current period.
 *
 * `at` defaults to now; pass a timestamp to inspect a past month.
 */
export async function progress(
  options: { at?: number; weekStartsOn?: 0 | 1 } = {},
): Promise<BudgetProgress[]> {
  const at = options.at ?? Date.now();
  const budgets = await list();
  const result: BudgetProgress[] = [];

  for (const budget of budgets) {
    const { start, end } = periodBounds(budget.period, at, options.weekStartsOn ?? 1);

    const rows = await query<{ spent: number | null }>(
      `SELECT SUM(amount) AS spent FROM transactions
       WHERE kind = 'expense' AND pending = 0
         AND categoryId = ? AND currency = ?
         AND occurredAt >= ? AND occurredAt < ?`,
      [budget.categoryId, budget.currency, start, end],
    );

    const spent = rows[0]?.spent ?? 0;
    result.push({
      ...budget,
      spent,
      remaining: budget.limit - spent,
      // A zero cap would divide by zero; treat it as fully consumed.
      ratio: budget.limit > 0 ? Math.min(spent / budget.limit, 1) : 1,
      periodStart: start,
      periodEnd: end,
    });
  }

  return result;
}

export async function create(draft: New<Budget>): Promise<Budget> {
  const now = Date.now();
  const budget: Budget = { ...draft, id: newId(), createdAt: now, updatedAt: now };

  await run(
    `INSERT INTO budgets (id, categoryId, "limit", currency, period, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      budget.id,
      budget.categoryId,
      budget.limit,
      budget.currency,
      budget.period,
      budget.createdAt,
      budget.updatedAt,
    ],
  );

  return budget;
}

export async function update(id: Id, patch: Partial<New<Budget>>): Promise<void> {
  const fields = Object.keys(patch) as (keyof New<Budget>)[];
  if (fields.length === 0) return;

  // `limit` is a reserved word in SQLite and must stay quoted.
  const assignments = fields.map((f) => `${f === 'limit' ? '"limit"' : f} = ?`).join(', ');
  await run(`UPDATE budgets SET ${assignments}, updatedAt = ? WHERE id = ?`, [
    ...fields.map((f) => patch[f]),
    Date.now(),
    id,
  ]);
}

export async function remove(id: Id): Promise<void> {
  await run('DELETE FROM budgets WHERE id = ?', [id]);
}
