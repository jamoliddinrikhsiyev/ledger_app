/**
 * Money helpers. Amounts are integer minor units everywhere in the app;
 * they become decimals only at the formatting boundary.
 */

import type { CurrencyCode } from '../domain/types';

/** Currencies whose minor unit is not 1/100. Anything absent uses 2 decimals. */
const EXPONENTS: Record<string, number> = {
  JPY: 0,
  KRW: 0,
  VND: 0,
  CLP: 0,
  ISK: 0,
  BHD: 3,
  KWD: 3,
  OMR: 3,
  TND: 3,
};

export function exponentOf(currency: CurrencyCode): number {
  return EXPONENTS[currency.toUpperCase()] ?? 2;
}

/** "12.34" → 1234 for a 2-decimal currency. Returns null if unparseable. */
export function parseAmount(input: string, currency: CurrencyCode): number | null {
  const normalized = input.replace(/\s/g, '').replace(',', '.');
  if (!/^-?\d*\.?\d*$/.test(normalized) || normalized === '' || normalized === '.') return null;

  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;

  // Round rather than truncate so 0.1 + 0.2 style float error cannot lose a cent.
  return Math.round(value * 10 ** exponentOf(currency));
}

/** 1234 → "$12.34". */
export function formatMoney(
  minorUnits: number,
  currency: CurrencyCode,
  options: { signDisplay?: 'auto' | 'never' | 'always'; compact?: boolean } = {},
): string {
  const exponent = exponentOf(currency);
  const value = minorUnits / 10 ** exponent;

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: options.compact ? 0 : exponent,
      maximumFractionDigits: options.compact ? 0 : exponent,
      signDisplay: options.signDisplay ?? 'auto',
    }).format(value);
  } catch {
    // Intl throws on codes it does not know; fall back to a plain rendering.
    return `${value.toFixed(exponent)} ${currency}`;
  }
}

/** Signed effect of a transaction on `accountId`, in minor units. */
export function signedEffect(
  kind: 'expense' | 'income' | 'transfer',
  amount: number,
  accountId: string,
  txAccountId: string,
): number {
  if (kind === 'income') return amount;
  if (kind === 'expense') return -amount;
  // A transfer leaves the source and lands in the destination.
  return accountId === txAccountId ? -amount : amount;
}
