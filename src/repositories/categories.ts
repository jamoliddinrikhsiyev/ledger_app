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

/** Icons are ionicons names; colours are theme tokens resolved in CSS. */
const DEFAULTS: Omit<New<Category>, 'parentId'>[] = [
  { name: 'Groceries', kind: 'expense', icon: 'cart-outline', color: 'mint', sortOrder: 0 },
  { name: 'Dining', kind: 'expense', icon: 'restaurant-outline', color: 'amber', sortOrder: 1 },
  { name: 'Transport', kind: 'expense', icon: 'car-outline', color: 'sky', sortOrder: 2 },
  { name: 'Housing', kind: 'expense', icon: 'home-outline', color: 'violet', sortOrder: 3 },
  { name: 'Utilities', kind: 'expense', icon: 'flash-outline', color: 'teal', sortOrder: 4 },
  { name: 'Health', kind: 'expense', icon: 'fitness-outline', color: 'rose', sortOrder: 5 },
  { name: 'Shopping', kind: 'expense', icon: 'bag-handle-outline', color: 'coral', sortOrder: 6 },
  { name: 'Entertainment', kind: 'expense', icon: 'film-outline', color: 'indigo', sortOrder: 7 },
  { name: 'Travel', kind: 'expense', icon: 'airplane-outline', color: 'cyan', sortOrder: 8 },
  { name: 'Subscriptions', kind: 'expense', icon: 'repeat-outline', color: 'plum', sortOrder: 9 },
  { name: 'Other', kind: 'expense', icon: 'ellipsis-horizontal-outline', color: 'slate', sortOrder: 10 },
  { name: 'Salary', kind: 'income', icon: 'briefcase-outline', color: 'mint', sortOrder: 0 },
  { name: 'Freelance', kind: 'income', icon: 'laptop-outline', color: 'sky', sortOrder: 1 },
  { name: 'Interest', kind: 'income', icon: 'trending-up-outline', color: 'amber', sortOrder: 2 },
  { name: 'Gifts', kind: 'income', icon: 'gift-outline', color: 'rose', sortOrder: 3 },
];

/** Seeds the default categories. Called once, guarded by the `seeded` setting. */
export async function seedDefaults(): Promise<void> {
  for (const category of DEFAULTS) {
    await create({ ...category, parentId: null });
  }
}
