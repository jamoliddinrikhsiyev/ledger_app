/**
 * Domain model for the Ledger app.
 *
 * Money is stored as integer minor units (cents/tiyin) to avoid float drift.
 * Every record carries `updatedAt` so a future sync service can resolve
 * conflicts without a schema change.
 */

export type Id = string;

/** ISO-4217 code, e.g. "USD", "UZS", "EUR". */
export type CurrencyCode = string;

/** Milliseconds since epoch. */
export type Timestamp = number;

export type AccountKind = 'cash' | 'card' | 'bank' | 'savings' | 'credit' | 'investment';

export interface Account {
  id: Id;
  name: string;
  kind: AccountKind;
  currency: CurrencyCode;
  /** Balance the account started with, in minor units. */
  openingBalance: number;
  /** Free-form colour token resolved by the theme, e.g. "accent-mint". */
  color: string | null;
  icon: string | null;
  /** Last four digits for cards; purely cosmetic. */
  last4: string | null;
  archived: boolean;
  sortOrder: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** An account plus its derived balance. Never persisted. */
export interface AccountWithBalance extends Account {
  /** openingBalance + sum of posted transaction effects, in minor units. */
  balance: number;
}

export type TransactionKind = 'expense' | 'income' | 'transfer';

export interface Transaction {
  id: Id;
  kind: TransactionKind;
  /** Always positive, in minor units. Direction is carried by `kind`. */
  amount: number;
  currency: CurrencyCode;
  /** Source for expense/transfer, destination for income. */
  accountId: Id;
  /** Destination account for transfers; null otherwise. */
  counterAccountId: Id | null;
  categoryId: Id | null;
  /** Merchant or payer name shown as the row title. */
  payee: string;
  note: string | null;
  occurredAt: Timestamp;
  /** Pending transactions are excluded from balances. */
  pending: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type CategoryKind = 'expense' | 'income';

export interface Category {
  id: Id;
  name: string;
  kind: CategoryKind;
  icon: string | null;
  color: string | null;
  /** Null for top-level categories. */
  parentId: Id | null;
  sortOrder: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Budget period; budgets recur until deleted. */
export type BudgetPeriod = 'weekly' | 'monthly' | 'yearly';

export interface Budget {
  id: Id;
  categoryId: Id;
  /** Cap for one period, in minor units. */
  limit: number;
  currency: CurrencyCode;
  period: BudgetPeriod;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** A budget joined with spending for the current period. Never persisted. */
export interface BudgetProgress extends Budget {
  spent: number;
  remaining: number;
  /** 0..1, clamped — spending past the cap still reports 1. */
  ratio: number;
  periodStart: Timestamp;
  periodEnd: Timestamp;
}

/** Draft passed to repository `create` methods; ids and stamps are assigned there. */
export type New<T extends { id: Id; createdAt: Timestamp; updatedAt: Timestamp }> = Omit<
  T,
  'id' | 'createdAt' | 'updatedAt'
>;
