/**
 * Shape of the app-wide store. Split from the provider so components can import
 * the hook without pulling the provider's dependency graph into their module.
 */

import { createContext, useContext } from 'react';
import type {
  AccountWithBalance,
  BudgetProgress,
  Category,
  GoalProgress,
  Transaction,
  UpcomingBill,
} from '../domain/types';
import type { NetWorth } from '../repositories/accounts';
import type { CategoryTotal, MonthlySpend } from '../repositories/transactions';
import type { AppSettings } from '../repositories/settings';

export interface LedgerSnapshot {
  settings: AppSettings;
  accounts: AccountWithBalance[];
  netWorth: NetWorth;
  categories: Category[];
  transactions: Transaction[];
  budgets: BudgetProgress[];
  goals: GoalProgress[];
  bills: UpcomingBill[];
  /** Income/expense totals for the current calendar month. */
  month: { income: number; expense: number; net: number };
  spendingByCategory: CategoryTotal[];
  monthlySpend: MonthlySpend[];
  /** Age of the FX cache in hours, or null when it is empty. */
  ratesAgeHours: number | null;
}

export interface LedgerStore extends LedgerSnapshot {
  /** Re-reads everything from SQLite. Called after every mutation. */
  refresh: () => Promise<void>;
  /** Shows a transient confirmation, matching the design's toast. */
  flash: (message: string) => void;
  toast: string;
  /** Resolves a category by id, falling back to a placeholder for orphans. */
  categoryOf: (id: string | null) => Category | null;
  /** Formats minor units in the base currency. */
  money: (minorUnits: number) => string;
}

export const LedgerContext = createContext<LedgerStore | null>(null);

export function useLedger(): LedgerStore {
  const store = useContext(LedgerContext);
  if (!store) throw new Error('useLedger must be used inside <LedgerProvider>.');
  return store;
}
