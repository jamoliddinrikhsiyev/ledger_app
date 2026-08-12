/**
 * Exercises the rate-response parser against the shapes real providers return.
 *
 *   node --experimental-strip-types scripts/verify-rates.mjs
 */

import { extractRates, extractBase, buildRatesPath } from '../src/lib/rate-parsing.ts';

let failures = 0;

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `${ok ? 'OK  ' : 'FAIL'} ${label}` +
      (ok ? '' : `\n       got      ${JSON.stringify(actual)}\n       expected ${JSON.stringify(expected)}`),
  );
}

// open.er-api.com/v6/latest/USD
check(
  'open.er-api.com',
  extractRates({
    result: 'success',
    base_code: 'USD',
    time_last_update_unix: 1_700_000_000,
    rates: { USD: 1, EUR: 0.92, UZS: 12800 },
  }),
  { USD: 1, EUR: 0.92, UZS: 12800 },
);

// v6.exchangerate-api.com/v6/KEY/latest/USD
check(
  'exchangerate-api.com',
  extractRates({ result: 'success', base_code: 'USD', conversion_rates: { EUR: 0.92, GBP: 0.79 } }),
  { EUR: 0.92, GBP: 0.79 },
);

// api.exchangerate.host / exchangeratesapi.io / fixer.io
check(
  'exchangerate.host',
  extractRates({ success: true, base: 'EUR', date: '2026-08-12', rates: { USD: 1.09, RUB: 98.2 } }),
  { USD: 1.09, RUB: 98.2 },
);

// currencyapi.com nests each rate as { code, value }
check(
  'currencyapi.com',
  extractRates({ data: { EUR: { code: 'EUR', value: 0.92 }, JPY: { code: 'JPY', value: 151.3 } } }),
  { EUR: 0.92, JPY: 151.3 },
);

// currencylayer / apilayer key `quotes` by concatenated pair.
check(
  'currencylayer quotes',
  extractRates({ success: true, source: 'USD', quotes: { USDEUR: 0.92, USDUZS: 12800 } }),
  { EUR: 0.92, UZS: 12800 },
);

// Without a base echoed back, a pair key cannot be split safely.
check('pair keys without a base', extractRates({ quotes: { USDEUR: 0.92 } }), null);

// Metadata sitting alongside rates must not become a currency.
check(
  'metadata is filtered out',
  extractRates({ rates: { EUR: 0.92, timestamp: 1_700_000_000, ok: true } }),
  { EUR: 0.92 },
);

check('non-positive rates dropped', extractRates({ rates: { EUR: 0, GBP: -1, USD: 1 } }), { USD: 1 });
check('unrecognised payload', extractRates({ foo: 'bar' }), null);
check('null payload', extractRates(null), null);
check('array payload', extractRates([1, 2, 3]), null);

// --- base extraction ---
check('base from base_code', extractBase({ base_code: 'usd' }), 'USD');
check('base from base', extractBase({ base: 'EUR' }), 'EUR');
check('base absent', extractBase({ rates: {} }), null);
check('base ignores non-code strings', extractBase({ base: 'not-a-code' }), null);

// --- path templates ---
check('default template', buildRatesPath('/latest/{base}', 'uzs'), '/latest/UZS');
check('query template', buildRatesPath('/latest?base={base}', 'EUR'), '/latest?base=EUR');
check('template without placeholder', buildRatesPath('/live', 'EUR'), '/live');
check('empty template falls back', buildRatesPath('   ', 'EUR'), '/latest/EUR');

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
