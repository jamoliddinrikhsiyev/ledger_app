/** Category persistence and the default set seeded on first launch. */

import { query, run } from '../db/sqlite';
import type { Category, CategoryKind, Id, New } from '../domain/types';
import { newId } from '../lib/id';

export async function list(kind?: CategoryKind): Promise<Category[]> {
  return query<Category>(
    `SELECT * FROM categories
     ${kind ? 'WHERE kind = ?' : ''}
     ORDER BY sortOrder ASC, name ASC`,
    kind ? [kind] : [],
  );
}

export async function get(id: Id): Promise<Category | null> {
  const rows = await query<Category>('SELECT * FROM categories WHERE id = ?', [id]);
  return rows[0] ?? null;
}

/** Id-keyed map, for resolving category names while rendering a transaction list. */
export async function byId(): Promise<Map<Id, Category>> {
  const all = await list();
  return new Map(all.map((category) => [category.id, category]));
}

export async function create(draft: New<Category>): Promise<Category> {
  const now = Date.now();
  const category: Category = { ...draft, id: newId(), createdAt: now, updatedAt: now };

  await run(
    `INSERT INTO categories (id, name, kind, icon, color, parentId, sortOrder, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      category.id,
      category.name,
      category.kind,
      category.icon,
      category.color,
      category.parentId,
      category.sortOrder,
      category.createdAt,
      category.updatedAt,
    ],
  );

  return category;
}

export async function update(id: Id, patch: Partial<New<Category>>): Promise<void> {
  const fields = Object.keys(patch) as (keyof New<Category>)[];
  if (fields.length === 0) return;

  const assignments = fields.map((f) => `${f} = ?`).join(', ');
  await run(`UPDATE categories SET ${assignments}, updatedAt = ? WHERE id = ?`, [
    ...fields.map((f) => patch[f]),
    Date.now(),
    id,
  ]);
}

/** Removes the category; its transactions survive with a null `categoryId`. */
export async function remove(id: Id): Promise<void> {
  await run('DELETE FROM categories WHERE id = ?', [id]);
}

/**
 * Category colours come from one accent-to-neutral ramp rather than a rainbow.
 * Nocturne has no red or green, so a category never signals good or bad by
 * hue — the numbers do that.
 */
export const CATEGORY_RAMP = [
  '#b5abfc',
  '#968ae0',
  '#796cbf',
  '#9397ab',
  '#75798c',
  '#5d5294',
  '#cfd3e5',
  '#423a6a',
];

/** Phosphor glyph names, matching the icon set the design draws with. */
export const CATEGORY_ICONS = [
  'ph-tag',
  'ph-fork-knife',
  'ph-car',
  'ph-bag',
  'ph-heartbeat',
  'ph-book-open',
  'ph-barbell',
  'ph-paw-print',
  'ph-gift',
  'ph-airplane-tilt',
  'ph-game-controller',
  'ph-graduation-cap',
];

const DEFAULTS: Omit<New<Category>, 'parentId'>[] = [
  { name: 'Groceries', kind: 'expense', icon: 'ph-shopping-cart', color: CATEGORY_RAMP[0], sortOrder: 0 },
  { name: 'Eating out', kind: 'expense', icon: 'ph-fork-knife', color: CATEGORY_RAMP[1], sortOrder: 1 },
  { name: 'Transport', kind: 'expense', icon: 'ph-car', color: CATEGORY_RAMP[2], sortOrder: 2 },
  { name: 'Bills', kind: 'expense', icon: 'ph-lightning', color: CATEGORY_RAMP[3], sortOrder: 3 },
  { name: 'Shopping', kind: 'expense', icon: 'ph-bag', color: CATEGORY_RAMP[4], sortOrder: 4 },
  { name: 'Health', kind: 'expense', icon: 'ph-heartbeat', color: CATEGORY_RAMP[5], sortOrder: 5 },
  { name: 'Salary', kind: 'income', icon: 'ph-briefcase', color: CATEGORY_RAMP[0], sortOrder: 0 },
  { name: 'Freelance', kind: 'income', icon: 'ph-laptop', color: CATEGORY_RAMP[1], sortOrder: 1 },
  { name: 'Gifts', kind: 'income', icon: 'ph-gift', color: CATEGORY_RAMP[2], sortOrder: 2 },
];

/** Seeds the default categories. Called once, guarded by the `seeded` setting. */
export async function seedDefaults(): Promise<void> {
  for (const category of DEFAULTS) {
    await create({ ...category, parentId: null });
  }
}
