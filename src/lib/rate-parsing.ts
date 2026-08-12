/**
 * Provider-response parsing for exchange rates.
 *
 * Kept dependency-free so it can be exercised without a database or a WebView.
 * Providers disagree on the wrapper key and on whether each value is a plain
 * number or an object, so probe the known shapes rather than committing to one.
 */

/** Wrapper keys used by the providers we expect people to point the app at. */
const RATE_KEYS = ['rates', 'conversion_rates', 'data', 'quotes'] as const;

/** Keys under which a provider echoes back the base currency it quoted. */
const BASE_KEYS = ['base_code', 'base', 'source'] as const;

/**
 * Normalises one key from a provider's rate map to a bare currency code.
 *
 * currencylayer and apilayer key their `quotes` map by concatenated pair —
 * `USDEUR` — so the base prefix is stripped when it matches.
 */
function normalizeCode(key: string, base: string | null): string | null {
  const upper = key.toUpperCase();
  if (/^[A-Z]{3,4}$/.test(upper)) return upper;
  if (base && upper.length === 6 && upper.startsWith(base) && /^[A-Z]{6}$/.test(upper)) {
    return upper.slice(3);
  }
  return null;
}

function toRate(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  // currencyapi.com nests each rate as { code, value }.
  if (value && typeof value === 'object') {
    const nested = (value as { value?: unknown }).value;
    if (typeof nested === 'number' && Number.isFinite(nested) && nested > 0) return nested;
  }
  return null;
}

/**
 * Pulls a `{ CODE: rate }` map out of a provider response, or null when the
 * payload holds nothing recognisable.
 */
export function extractRates(payload: unknown): Record<string, number> | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const root = payload as Record<string, unknown>;
  const base = extractBase(payload);

  for (const key of RATE_KEYS) {
    const candidate = root[key];
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;

    const parsed: Record<string, number> = {};
    for (const [rawCode, value] of Object.entries(candidate as Record<string, unknown>)) {
      // Skip stray metadata fields sitting in the same object as the rates.
      const code = normalizeCode(rawCode, base);
      if (!code) continue;

      const rate = toRate(value);
      if (rate !== null) parsed[code] = rate;
    }

    if (Object.keys(parsed).length > 0) return parsed;
  }

  return null;
}

/** Provider-reported base currency, when it echoes one back. */
export function extractBase(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const root = payload as Record<string, unknown>;

  for (const key of BASE_KEYS) {
    const value = root[key];
    if (typeof value === 'string' && /^[A-Za-z]{3,4}$/.test(value.trim())) {
      return value.trim().toUpperCase();
    }
  }
  return null;
}

/**
 * Fills `{base}` in a user-supplied path template.
 *
 * A template with no placeholder is returned unchanged — some providers take
 * the base as a fixed query parameter or ignore it entirely.
 */
export function buildRatesPath(template: string, base: string): string {
  const path = template.trim() || '/latest/{base}';
  return path.replaceAll('{base}', encodeURIComponent(base.toUpperCase()));
}
