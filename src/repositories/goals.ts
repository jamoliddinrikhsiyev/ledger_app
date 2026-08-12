/** Savings-goal persistence and derived progress. */

import { query, run } from '../db/sqlite';
import type { Goal, GoalProgress, Id, New } from '../domain/types';
import { newId } from '../lib/id';

export async function list(): Promise<Goal[]> {
  return query<Goal>('SELECT * FROM goals ORDER BY sortOrder ASC, createdAt ASC');
}

export async function get(id: Id): Promise<Goal | null> {
  const rows = await query<Goal>('SELECT * FROM goals WHERE id = ?', [id]);
  return rows[0] ?? null;
}

function withProgress(goal: Goal): GoalProgress {
  const remaining = Math.max(0, goal.target - goal.saved);
  return {
    ...goal,
    remaining,
    // A zero target would divide by zero; treat it as already met.
    ratio: goal.target > 0 ? Math.min(goal.saved / goal.target, 1) : 1,
    etaMonths: remaining > 0 && goal.perMonth > 0 ? Math.ceil(remaining / goal.perMonth) : null,
  };
}

export async function progress(): Promise<GoalProgress[]> {
  return (await list()).map(withProgress);
}

/** Totals across every goal, for the header on the Goals screen. */
export async function totals(): Promise<{ saved: number; target: number; ratio: number }> {
  const goals = await list();
  const saved = goals.reduce((sum, g) => sum + g.saved, 0);
  const target = goals.reduce((sum, g) => sum + g.target, 0);
  return { saved, target, ratio: target > 0 ? Math.min(saved / target, 1) : 0 };
}

export async function create(draft: New<Goal>): Promise<Goal> {
  const now = Date.now();
  const goal: Goal = { ...draft, id: newId(), createdAt: now, updatedAt: now };

  await run(
    `INSERT INTO goals (id, name, icon, target, saved, perMonth, currency, sortOrder, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      goal.id,
      goal.name,
      goal.icon,
      goal.target,
      goal.saved,
      goal.perMonth,
      goal.currency,
      goal.sortOrder,
      goal.createdAt,
      goal.updatedAt,
    ],
  );

  return goal;
}

export async function update(id: Id, patch: Partial<New<Goal>>): Promise<void> {
  const fields = Object.keys(patch) as (keyof New<Goal>)[];
  if (fields.length === 0) return;

  const assignments = fields.map((f) => `${f} = ?`).join(', ');
  await run(`UPDATE goals SET ${assignments}, updatedAt = ? WHERE id = ?`, [
    ...fields.map((f) => patch[f]),
    Date.now(),
    id,
  ]);
}

/**
 * Moves `amount` minor units into a goal.
 *
 * Done in SQL rather than read-modify-write so two quick contributions cannot
 * lose one another.
 */
export async function contribute(id: Id, amount: number): Promise<void> {
  if (amount <= 0) throw new Error('Contribution must be positive.');
  await run('UPDATE goals SET saved = saved + ?, updatedAt = ? WHERE id = ?', [
    amount,
    Date.now(),
    id,
  ]);
}

export async function remove(id: Id): Promise<void> {
  await run('DELETE FROM goals WHERE id = ?', [id]);
}
