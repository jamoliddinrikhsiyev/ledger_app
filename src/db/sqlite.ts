/**
 * SQLite bootstrap.
 *
 * Native (iOS/Android) uses the platform SQLite through
 * `@capacitor-community/sqlite`. The browser uses the same plugin backed by
 * `jeep-sqlite` (sql.js compiled to wasm, persisted to IndexedDB), so identical
 * SQL runs in dev and in the shipped app.
 *
 * Nothing here talks to a network. The database is the only source of truth.
 */

import { Capacitor } from '@capacitor/core';
import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from '@capacitor-community/sqlite';

import { MIGRATIONS, LATEST_VERSION } from './schema';

export const DB_NAME = 'ledger';

const sqlite = new SQLiteConnection(CapacitorSQLite);
const isWeb = Capacitor.getPlatform() === 'web';

let dbPromise: Promise<SQLiteDBConnection> | null = null;

/** Mounts the <jeep-sqlite> element and its IndexedDB-backed store. Web only. */
async function initWebStore(): Promise<void> {
  const { defineCustomElements } = await import('jeep-sqlite/loader');
  defineCustomElements(window);
  await customElements.whenDefined('jeep-sqlite');

  if (!document.querySelector('jeep-sqlite')) {
    const el = document.createElement('jeep-sqlite');
    document.body.appendChild(el);
  }
  await sqlite.initWebStore();
}

/**
 * Applies every migration above the database's current `user_version`, in a
 * single transaction per migration so a failure leaves the version untouched.
 */
async function runMigrations(db: SQLiteDBConnection): Promise<void> {
  const result = await db.query('PRAGMA user_version;');
  const current = (result.values?.[0] as { user_version?: number } | undefined)?.user_version ?? 0;

  if (current >= LATEST_VERSION) return;

  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;

    await db.execute('BEGIN TRANSACTION;', false);
    try {
      for (const statement of migration.statements) {
        await db.execute(statement, false);
      }
      // PRAGMA cannot be parameterised; the value is a literal from our own code.
      await db.execute(`PRAGMA user_version = ${migration.version};`, false);
      await db.execute('COMMIT;', false);
    } catch (error) {
      await db.execute('ROLLBACK;', false);
      throw new Error(
        `Migration ${migration.version} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

/**
 * Opens the shared connection, running migrations on first call. Concurrent
 * callers await the same promise, so the database is never opened twice.
 */
export function getDb(): Promise<SQLiteDBConnection> {
  dbPromise ??= (async () => {
    if (isWeb) await initWebStore();

    // A connection left behind by a hot reload would make createConnection throw.
    await sqlite.checkConnectionsConsistency();
    const existing = await sqlite.isConnection(DB_NAME, false);

    const db = existing.result
      ? await sqlite.retrieveConnection(DB_NAME, false)
      : await sqlite.createConnection(DB_NAME, false, 'no-encryption', LATEST_VERSION, false);

    if (!(await db.isDBOpen()).result) await db.open();

    await db.execute('PRAGMA foreign_keys = ON;', false);
    await runMigrations(db);
    await persist();

    return db;
  })().catch((error) => {
    // Let the next call retry instead of caching a rejected promise forever.
    dbPromise = null;
    throw error;
  });

  return dbPromise;
}

/**
 * Flushes the in-memory web database to IndexedDB. No-op on native, where
 * writes already hit disk. Call after any mutation.
 */
export async function persist(): Promise<void> {
  if (!isWeb) return;
  await sqlite.saveToStore(DB_NAME);
}

/** Runs `fn` inside a transaction, rolling back if it throws. */
export async function transact<T>(fn: (db: SQLiteDBConnection) => Promise<T>): Promise<T> {
  const db = await getDb();
  await db.execute('BEGIN TRANSACTION;', false);
  try {
    const result = await fn(db);
    await db.execute('COMMIT;', false);
    await persist();
    return result;
  } catch (error) {
    await db.execute('ROLLBACK;', false);
    throw error;
  }
}

/** Typed SELECT helper. */
export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const db = await getDb();
  const result = await db.query(sql, params as never[]);
  return (result.values ?? []) as T[];
}

/** INSERT/UPDATE/DELETE helper that persists the web store afterwards. */
export async function run(sql: string, params: unknown[] = []): Promise<void> {
  const db = await getDb();
  await db.run(sql, params as never[], false);
  await persist();
}

/** Closes the connection. Used by tests and by teardown paths. */
export async function closeDb(): Promise<void> {
  if (!dbPromise) return;
  await dbPromise;
  dbPromise = null;
  await sqlite.closeConnection(DB_NAME, false);
}
