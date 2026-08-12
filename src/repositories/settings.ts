/**
 * Key/value app settings, stored in SQLite alongside the ledger so a single
 * database file holds all state.
 *
 * Service endpoints live here rather than in code so the user can point the app
 * at their own provider from the Settings screen without a rebuild.
 */

import { query, run } from '../db/sqlite';

/** How an API key is attached to a request, if at all. */
export type ApiKeyMode = 'none' | 'bearer' | 'header' | 'query';

/** User-supplied overrides for one external service. */
export interface ServiceOverride {
  /** Replaces the built-in base URL. Trailing slashes are trimmed on read. */
  baseUrl?: string;
  apiKey?: string;
  apiKeyMode?: ApiKeyMode;
  /** Header or query-parameter name carrying the key. Ignored for other modes. */
  apiKeyName?: string;
  /**
   * User's own on/off switch. This is in addition to the build-time gate —
   * turning it on cannot open traffic while `VITE_SERVICES_ENABLED` is false.
   */
  enabled?: boolean;
}

export interface AppSettings {
  /**
   * Currency used for dashboard totals and as the default for new accounts.
   * Balances held in other currencies are converted into it for net worth.
   */
  baseCurrency: string;
  theme: 'dark' | 'light' | 'system';
  /** 0 = Sunday, 1 = Monday. Drives weekly budget periods. */
  weekStartsOn: 0 | 1;
  /** Require device auth on launch. Enforced by the UI shell. */
  biometricLock: boolean;
  /** True once default categories have been seeded. */
  seeded: boolean;
  /** Per-service endpoint and credential overrides, keyed by service id. */
  services: Record<string, ServiceOverride>;
  /** Refresh cached FX rates if the newest is older than this. 0 disables. */
  ratesMaxAgeHours: number;
  /**
   * Path appended to the rates service base URL. `{base}` is replaced with the
   * base currency code, so most providers work by editing this string alone:
   *
   *   open.er-api.com/v6      → /latest/{base}
   *   api.exchangerate.host   → /latest?base={base}
   *   v6.exchangerate-api.com → /latest/{base}   (key goes in the path or header)
   */
  ratesPathTemplate: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  baseCurrency: 'USD',
  theme: 'dark',
  weekStartsOn: 1,
  biometricLock: false,
  seeded: false,
  services: {},
  ratesMaxAgeHours: 12,
  ratesPathTemplate: '/latest/{base}',
};

/** Reads all settings, filling gaps from `DEFAULT_SETTINGS`. */
export async function all(): Promise<AppSettings> {
  const rows = await query<{ key: string; value: string }>('SELECT key, value FROM settings');
  const stored = new Map(rows.map((row) => [row.key, row.value]));

  const result = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[]) {
    const raw = stored.get(key);
    if (raw === undefined) continue;
    try {
      // Values round-trip as JSON, so booleans, numbers and objects survive.
      (result as Record<string, unknown>)[key] = JSON.parse(raw);
    } catch {
      // A corrupt row falls back to its default rather than breaking startup.
    }
  }
  return result;
}

export async function get<K extends keyof AppSettings>(key: K): Promise<AppSettings[K]> {
  const rows = await query<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  if (!rows[0]) return DEFAULT_SETTINGS[key];
  try {
    return JSON.parse(rows[0].value) as AppSettings[K];
  } catch {
    return DEFAULT_SETTINGS[key];
  }
}

export async function set<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K],
): Promise<void> {
  await run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [
    key,
    JSON.stringify(value),
  ]);
}

export async function setMany(patch: Partial<AppSettings>): Promise<void> {
  for (const [key, value] of Object.entries(patch)) {
    await run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [
      key,
      JSON.stringify(value),
    ]);
  }
}

/**
 * Changes the currency that totals are reported in.
 *
 * Existing accounts and transactions keep their own currencies untouched — only
 * the reporting unit changes, so this is always safe and reversible.
 */
export async function setBaseCurrency(code: string): Promise<void> {
  await set('baseCurrency', code.toUpperCase());
}

/** Merges a patch into one service's overrides, leaving the others alone. */
export async function setServiceOverride(
  serviceId: string,
  patch: ServiceOverride,
): Promise<void> {
  const services = await get('services');
  await set('services', {
    ...services,
    [serviceId]: { ...services[serviceId], ...patch },
  });
}

export async function clearServiceOverride(serviceId: string): Promise<void> {
  const services = await get('services');
  const next = { ...services };
  delete next[serviceId];
  await set('services', next);
}
