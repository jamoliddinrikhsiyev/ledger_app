/**
 * Cached exchange rates and currency conversion.
 *
 * Rates are persisted, so conversion keeps working with no connection — the app
 * converts against the last known rate and reports how stale it is instead of
 * blocking on a fetch it may never be able to make.
 *
 * A rate row means: one unit of `base` buys `rate` units of `quote`.
 */

import { query, run, transact } from '../db/sqlite';
import { exponentOf } from '../lib/money';

export interface ExchangeRate {
  base: string;
  quote: string;
  rate: number;
  fetchedAt: number;
  source: string | null;
}

export async function all(): Promise<ExchangeRate[]> {
  return query<ExchangeRate>('SELECT * FROM exchange_rates ORDER BY base, quote');
}

/** Timestamp of the most recently fetched rate, or null when the cache is empty. */
export async function lastFetchedAt(): Promise<number | null> {
  const rows = await query<{ newest: number | null }>(
    'SELECT MAX(fetchedAt) AS newest FROM exchange_rates',
  );
  return rows[0]?.newest ?? null;
}

/** Age of the cache in hours, or null when empty. */
export async function ageHours(now = Date.now()): Promise<number | null> {
  const newest = await lastFetchedAt();
  return newest === null ? null : (now - newest) / 3_600_000;
}

/** Replaces every rate quoted against `base` in one transaction. */
export async function replaceForBase(
  base: string,
  rates: Record<string, number>,
  source: string,
  fetchedAt = Date.now(),
): Promise<number> {
  const upper = base.toUpperCase();
  const entries = Object.entries(rates).filter(
    ([quote, rate]) => Number.isFinite(rate) && rate > 0 && quote.toUpperCase() !== upper,
  );

  await transact(async (db) => {
    await db.run('DELETE FROM exchange_rates WHERE base = ?', [upper], false);
    for (const [quote, rate] of entries) {
      await db.run(
        `INSERT OR REPLACE INTO exchange_rates (base, quote, rate, fetchedAt, source)
         VALUES (?, ?, ?, ?, ?)`,
        [upper, quote.toUpperCase(), rate, fetchedAt, source],
        false,
      );
    }
  });

  return entries.length;
}

export async function clear(): Promise<void> {
  await run('DELETE FROM exchange_rates');
}

/**
 * The rate taking one unit of `from` to units of `to`, or null when the cache
 * cannot answer.
 *
 * Tries the direct pair, then the inverse, then triangulates through any base
 * that quotes both currencies — so a cache holding only USD→* can still convert
 * EUR→UZS.
 */
export async function getRate(from: string, to: string): Promise<number | null> {
  const source = from.toUpperCase();
  const target = to.toUpperCase();
  if (source === target) return 1;

  const direct = await query<{ rate: number }>(
    'SELECT rate FROM exchange_rates WHERE base = ? AND quote = ?',
    [source, target],
  );
  if (direct[0]) return direct[0].rate;

  const inverse = await query<{ rate: number }>(
    'SELECT rate FROM exchange_rates WHERE base = ? AND quote = ?',
    [target, source],
  );
  if (inverse[0] && inverse[0].rate !== 0) return 1 / inverse[0].rate;

  // Triangulate: pick the freshest base quoting both sides.
  const bridged = await query<{ rate: number }>(
    `SELECT (b.rate / a.rate) AS rate
     FROM exchange_rates a
     JOIN exchange_rates b ON a.base = b.base
     WHERE a.quote = ? AND b.quote = ? AND a.rate != 0
     ORDER BY MIN(a.fetchedAt, b.fetchedAt) DESC
     LIMIT 1`,
    [source, target],
  );
  return bridged[0]?.rate ?? null;
}

/**
 * Converts `minorUnits` from one currency to another, accounting for differing
 * minor-unit exponents. Returns null when no rate is available — callers must
 * decide whether to hide the figure or show it unconverted.
 */
export async function convert(
  minorUnits: number,
  from: string,
  to: string,
): Promise<number | null> {
  if (from.toUpperCase() === to.toUpperCase()) return minorUnits;

  const rate = await getRate(from, to);
  if (rate === null) return null;

  const value = (minorUnits / 10 ** exponentOf(from)) * rate;
  return Math.round(value * 10 ** exponentOf(to));
}

export interface ConversionSummary {
  /** Sum of everything that could be converted, in `target` minor units. */
  total: number;
  /** Currencies left out because no rate was available. */
  missing: string[];
}

/**
 * Sums per-currency amounts into `target`.
 *
 * Unconvertible currencies are reported in `missing` rather than silently
 * dropped, so the UI can flag that a total is incomplete.
 */
export async function sumInto(
  amounts: { currency: string; minorUnits: number }[],
  target: string,
): Promise<ConversionSummary> {
  let total = 0;
  const missing = new Set<string>();

  for (const { currency, minorUnits } of amounts) {
    const converted = await convert(minorUnits, currency, target);
    if (converted === null) missing.add(currency.toUpperCase());
    else total += converted;
  }

  return { total, missing: [...missing] };
}
