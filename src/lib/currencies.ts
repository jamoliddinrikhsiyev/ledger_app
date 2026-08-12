/**
 * Currency registry for the picker.
 *
 * This is a display list, not a validation whitelist — a user may hold an
 * account in a currency we do not list here and everything still works, since
 * amounts are stored as minor units with the code alongside them.
 */

import { exponentOf } from './money';

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
}

/** Ordered so the most likely picks sit at the top of the list. */
export const CURRENCIES: CurrencyInfo[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'UZS', name: 'Uzbekistani Som', symbol: "so'm" },
  { code: 'RUB', name: 'Russian Ruble', symbol: '₽' },
  { code: 'KZT', name: 'Kazakhstani Tenge', symbol: '₸' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
  { code: 'PLN', name: 'Polish Zloty', symbol: 'zł' },
  { code: 'UAH', name: 'Ukrainian Hryvnia', symbol: '₴' },
  { code: 'GEL', name: 'Georgian Lari', symbol: '₾' },
  { code: 'KGS', name: 'Kyrgyzstani Som', symbol: 'с' },
  { code: 'TJS', name: 'Tajikistani Somoni', symbol: 'SM' },
  { code: 'AZN', name: 'Azerbaijani Manat', symbol: '₼' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
  { code: 'MXN', name: 'Mexican Peso', symbol: '$' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
];

const BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));

export function currencyInfo(code: string): CurrencyInfo {
  const upper = code.toUpperCase();
  // Unlisted codes still render; the code doubles as its own symbol.
  return BY_CODE.get(upper) ?? { code: upper, name: upper, symbol: upper };
}

export function isKnownCurrency(code: string): boolean {
  return BY_CODE.has(code.toUpperCase());
}

/** Case-insensitive search over code and name, for the picker's search field. */
export function searchCurrencies(term: string): CurrencyInfo[] {
  const needle = term.trim().toLowerCase();
  if (!needle) return CURRENCIES;
  return CURRENCIES.filter(
    (c) => c.code.toLowerCase().includes(needle) || c.name.toLowerCase().includes(needle),
  );
}

/** Re-exported so callers need only one import when working with amounts. */
export { exponentOf };
