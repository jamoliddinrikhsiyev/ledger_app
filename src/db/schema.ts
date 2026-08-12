/**
 * Schema definition and forward-only migrations.
 *
 * To change the schema, append a new entry to `MIGRATIONS` — never edit an
 * existing one, since devices in the field have already run it. `runMigrations`
 * applies everything above the stored `user_version`.
 */

export interface Migration {
  version: number;
  statements: string[];
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    statements: [
      `CREATE TABLE IF NOT EXISTS accounts (
         id             TEXT PRIMARY KEY NOT NULL,
         name           TEXT NOT NULL,
         kind           TEXT NOT NULL,
         currency       TEXT NOT NULL,
         openingBalance INTEGER NOT NULL DEFAULT 0,
         color          TEXT,
         icon           TEXT,
         last4          TEXT,
         archived       INTEGER NOT NULL DEFAULT 0,
         sortOrder      INTEGER NOT NULL DEFAULT 0,
         createdAt      INTEGER NOT NULL,
         updatedAt      INTEGER NOT NULL
       );`,

      `CREATE TABLE IF NOT EXISTS categories (
         id        TEXT PRIMARY KEY NOT NULL,
         name      TEXT NOT NULL,
         kind      TEXT NOT NULL,
         icon      TEXT,
         color     TEXT,
         parentId  TEXT REFERENCES categories(id) ON DELETE SET NULL,
         sortOrder INTEGER NOT NULL DEFAULT 0,
         createdAt INTEGER NOT NULL,
         updatedAt INTEGER NOT NULL
       );`,

      // Deleting an account removes its transactions; deleting a category only
      // orphans them, so history survives a category cleanup.
      `CREATE TABLE IF NOT EXISTS transactions (
         id               TEXT PRIMARY KEY NOT NULL,
         kind             TEXT NOT NULL,
         amount           INTEGER NOT NULL,
         currency         TEXT NOT NULL,
         accountId        TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
         counterAccountId TEXT REFERENCES accounts(id) ON DELETE SET NULL,
         categoryId       TEXT REFERENCES categories(id) ON DELETE SET NULL,
         payee            TEXT NOT NULL DEFAULT '',
         note             TEXT,
         occurredAt       INTEGER NOT NULL,
         pending          INTEGER NOT NULL DEFAULT 0,
         createdAt        INTEGER NOT NULL,
         updatedAt        INTEGER NOT NULL
       );`,

      `CREATE TABLE IF NOT EXISTS budgets (
         id         TEXT PRIMARY KEY NOT NULL,
         categoryId TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
         "limit"    INTEGER NOT NULL,
         currency   TEXT NOT NULL,
         period     TEXT NOT NULL,
         createdAt  INTEGER NOT NULL,
         updatedAt  INTEGER NOT NULL
       );`,

      `CREATE TABLE IF NOT EXISTS settings (
         key   TEXT PRIMARY KEY NOT NULL,
         value TEXT NOT NULL
       );`,

      // Outbound requests parked while services are disabled or the device is
      // offline. Drained by the outbox once both conditions clear.
      `CREATE TABLE IF NOT EXISTS outbox (
         id          TEXT PRIMARY KEY NOT NULL,
         service     TEXT NOT NULL,
         endpoint    TEXT NOT NULL,
         method      TEXT NOT NULL,
         payload     TEXT,
         attempts    INTEGER NOT NULL DEFAULT 0,
         lastError   TEXT,
         createdAt   INTEGER NOT NULL,
         nextAttempt INTEGER NOT NULL DEFAULT 0
       );`,

      // The transaction list is always read newest-first, usually filtered by
      // account, so both indexes lead with the sort column's companion.
      `CREATE INDEX IF NOT EXISTS idx_tx_occurredAt ON transactions(occurredAt DESC);`,
      `CREATE INDEX IF NOT EXISTS idx_tx_account ON transactions(accountId, occurredAt DESC);`,
      `CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(categoryId, occurredAt DESC);`,
      `CREATE INDEX IF NOT EXISTS idx_outbox_next ON outbox(nextAttempt);`,
    ],
  },

  {
    version: 2,
    statements: [
      // Cached FX rates. Stored so conversion keeps working offline: the app
      // converts against the last known rate and shows how stale it is, rather
      // than blocking on a network call it may never be able to make.
      //
      // `rate` is how many units of `quote` one unit of `base` buys.
      `CREATE TABLE IF NOT EXISTS exchange_rates (
         base      TEXT NOT NULL,
         quote     TEXT NOT NULL,
         rate      REAL NOT NULL,
         fetchedAt INTEGER NOT NULL,
         source    TEXT,
         PRIMARY KEY (base, quote)
       );`,

      `CREATE INDEX IF NOT EXISTS idx_rates_base ON exchange_rates(base);`,
    ],
  },

  {
    version: 3,
    statements: [
      // Savings goals. `saved` is held on the row rather than derived: money
      // moved into a goal is an intent the user states, not something that can
      // be inferred from the transaction log.
      `CREATE TABLE IF NOT EXISTS goals (
         id        TEXT PRIMARY KEY NOT NULL,
         name      TEXT NOT NULL,
         icon      TEXT,
         target    INTEGER NOT NULL,
         saved     INTEGER NOT NULL DEFAULT 0,
         perMonth  INTEGER NOT NULL DEFAULT 0,
         currency  TEXT NOT NULL,
         sortOrder INTEGER NOT NULL DEFAULT 0,
         createdAt INTEGER NOT NULL,
         updatedAt INTEGER NOT NULL
       );`,

      // Recurring bills, for the "Upcoming" list. `dueDay` is a day of the
      // month (1-31); the next occurrence is computed on read so a bill needs
      // no upkeep as months roll over.
      `CREATE TABLE IF NOT EXISTS bills (
         id         TEXT PRIMARY KEY NOT NULL,
         name       TEXT NOT NULL,
         icon       TEXT,
         amount     INTEGER NOT NULL,
         currency   TEXT NOT NULL,
         dueDay     INTEGER NOT NULL,
         categoryId TEXT REFERENCES categories(id) ON DELETE SET NULL,
         accountId  TEXT REFERENCES accounts(id) ON DELETE SET NULL,
         createdAt  INTEGER NOT NULL,
         updatedAt  INTEGER NOT NULL
       );`,

      `CREATE INDEX IF NOT EXISTS idx_bills_due ON bills(dueDay);`,
    ],
  },
];

export const LATEST_VERSION = MIGRATIONS.reduce((max, m) => Math.max(max, m.version), 0);
