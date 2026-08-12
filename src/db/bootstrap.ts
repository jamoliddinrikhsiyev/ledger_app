/**
 * First-run initialisation.
 *
 * Opens the database, applies migrations and seeds default categories once.
 * Purely local — the app is fully usable from this point with no network.
 */

import { getDb } from './sqlite';
import * as categories from '../repositories/categories';
import * as settings from '../repositories/settings';

let ready: Promise<void> | null = null;

export function initialize(): Promise<void> {
  ready ??= (async () => {
    await getDb();

    const current = await settings.all();
    if (!current.seeded) {
      await categories.seedDefaults();
      await settings.set('seeded', true);
    }
  })().catch((error) => {
    ready = null;
    throw error;
  });

  return ready;
}
