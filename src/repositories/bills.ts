/**
 * Recurring bills.
 *
 * A bill stores only its day of the month; the next occurrence is computed on
 * read, so bills need no upkeep as months roll over and nothing has to run in
 * the background.
 */

import { query, run } from '../db/sqlite';
import type { Bill, Id, New, UpcomingBill } from '../domain/types';
import { newId } from '../lib/id';

const DAY_MS = 86_400_000;

/** Local midnight for a timestamp. */
function startOfDay(at: number): number {
  const d = new Date(at);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * The next time `dueDay` comes around, at or after `from`.
 *
 * A bill due on the 31st still lands in February: the day is clamped to the
 * month's length rather than rolling into the next month.
 */
export function nextDueDate(dueDay: number, from = Date.now()): number {
  const today = new Date(startOfDay(from));

  for (const monthOffset of [0, 1, 2]) {
    const year = today.getFullYear();
    const month = today.getMonth() + monthOffset;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const candidate = new Date(year, month, Math.min(dueDay, daysInMonth)).getTime();
    if (candidate >= today.getTime()) return candidate;
  }

  // Unreachable for dueDay 1-31, but keeps the return type honest.
  return today.getTime();
}

export async function list(): Promise<Bill[]> {
  return query<Bill>('SELECT * FROM bills ORDER BY dueDay ASC, createdAt ASC');
}

export async function get(id: Id): Promise<Bill | null> {
  const rows = await query<Bill>('SELECT * FROM bills WHERE id = ?', [id]);
  return rows[0] ?? null;
}

/** Bills sorted by their next occurrence, soonest first. */
export async function upcoming(
  options: { withinDays?: number; at?: number } = {},
): Promise<UpcomingBill[]> {
  const at = options.at ?? Date.now();
  const today = startOfDay(at);

  return (await list())
    .map((bill) => {
      const dueAt = nextDueDate(bill.dueDay, at);
      return { ...bill, dueAt, daysUntil: Math.round((dueAt - today) / DAY_MS) };
    })
    .filter((bill) => options.withinDays === undefined || bill.daysUntil <= options.withinDays)
    .sort((a, b) => a.dueAt - b.dueAt);
}

/** Sum of the upcoming bills in `currency`; other currencies are skipped. */
export async function totalDue(
  currency: string,
  options: { withinDays?: number; at?: number } = {},
): Promise<number> {
  const bills = await upcoming(options);
  return bills
    .filter((b) => b.currency.toUpperCase() === currency.toUpperCase())
    .reduce((sum, b) => sum + b.amount, 0);
}

export async function create(draft: New<Bill>): Promise<Bill> {
  if (draft.dueDay < 1 || draft.dueDay > 31) {
    throw new Error('Bill due day must be between 1 and 31.');
  }

  const now = Date.now();
  const bill: Bill = { ...draft, id: newId(), createdAt: now, updatedAt: now };

  await run(
    `INSERT INTO bills (id, name, icon, amount, currency, dueDay, categoryId, accountId, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      bill.id,
      bill.name,
      bill.icon,
      bill.amount,
      bill.currency,
      bill.dueDay,
      bill.categoryId,
      bill.accountId,
      bill.createdAt,
      bill.updatedAt,
    ],
  );

  return bill;
}

export async function update(id: Id, patch: Partial<New<Bill>>): Promise<void> {
  const fields = Object.keys(patch) as (keyof New<Bill>)[];
  if (fields.length === 0) return;

  const assignments = fields.map((f) => `${f} = ?`).join(', ');
  await run(`UPDATE bills SET ${assignments}, updatedAt = ? WHERE id = ?`, [
    ...fields.map((f) => patch[f]),
    Date.now(),
    id,
  ]);
}

export async function remove(id: Id): Promise<void> {
  await run('DELETE FROM bills WHERE id = ?', [id]);
}
