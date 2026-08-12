/**
 * Loads the whole app state from SQLite and re-reads it after every mutation.
 *
 * A full re-read per mutation is deliberate at this size: the database is local
 * and the queries are indexed, so it costs a few milliseconds, and it removes a
 * whole class of bugs where a derived figure (a balance, a budget's progress)
 * drifts from the rows it came from.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { initialize } from '../db/bootstrap';
import type { Category } from '../domain/types';
import { formatMoney } from '../lib/money';
import * as accountsRepo from '../repositories/accounts';
import * as billsRepo from '../repositories/bills';
import * as budgetsRepo from '../repositories/budgets';
import * as categoriesRepo from '../repositories/categories';
import * as goalsRepo from '../repositories/goals';
import * as ratesRepo from '../repositories/rates';
import * as settingsRepo from '../repositories/settings';
import * as transactionsRepo from '../repositories/transactions';
import { LedgerContext, type LedgerSnapshot, type LedgerStore } from './LedgerContext';

const TOAST_MS = 2400;

/** Half-open bounds of the calendar month containing `at`. */
function monthBounds(at: number): { start: number; end: number } {
  const d = new Date(at);
  return {
    start: new Date(d.getFullYear(), d.getMonth(), 1).getTime(),
    end: new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime(),
  };
}

async function readAll(): Promise<LedgerSnapshot> {
  const settings = await settingsRepo.all();
  const currency = settings.baseCurrency;
  const { start, end } = monthBounds(Date.now());

  // Independent reads, so let them overlap rather than awaiting in sequence.
  const [
    accounts,
    netWorth,
    categories,
    transactions,
    budgets,
    goals,
    bills,
    month,
    spendingByCategory,
    monthlySpend,
    ratesAgeHours,
  ] = await Promise.all([
    accountsRepo.listWithBalances(),
    accountsRepo.netWorth(currency),
    categoriesRepo.list(),
    transactionsRepo.list({}, { limit: 200 }),
    budgetsRepo.progress({ weekStartsOn: settings.weekStartsOn }),
    goalsRepo.progress(),
    billsRepo.upcoming(),
    transactionsRepo.totals(start, end, currency),
    transactionsRepo.spendingByCategory(start, end, currency),
    transactionsRepo.monthlySpend(6, currency),
    ratesRepo.ageHours(),
  ]);

  return {
    settings,
    accounts,
    netWorth,
    categories,
    transactions,
    budgets,
    goals,
    bills,
    month,
    spendingByCategory,
    monthlySpend,
    ratesAgeHours,
  };
}

export function LedgerProvider({
  children,
  fallback,
}: {
  children: ReactNode;
  /** Rendered until the first read completes. */
  fallback: ReactNode;
}) {
  const [snapshot, setSnapshot] = useState<LedgerSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const refresh = useCallback(async () => {
    setSnapshot(await readAll());
  }, []);

  useEffect(() => {
    initialize()
      .then(refresh)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [refresh]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const flash = useCallback((message: string) => {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(''), TOAST_MS);
  }, []);

  const categoryIndex = useMemo(() => {
    const index = new Map<string, Category>();
    for (const category of snapshot?.categories ?? []) index.set(category.id, category);
    return index;
  }, [snapshot?.categories]);

  const store: LedgerStore | null = useMemo(() => {
    if (!snapshot) return null;
    return {
      ...snapshot,
      refresh,
      flash,
      toast,
      categoryOf: (id) => (id ? (categoryIndex.get(id) ?? null) : null),
      money: (minorUnits) => formatMoney(minorUnits, snapshot.settings.baseCurrency),
    };
  }, [snapshot, refresh, flash, toast, categoryIndex]);

  if (error) {
    return (
      <div style={{ padding: 40, color: 'var(--color-accent-300)', fontSize: 14 }}>
        <p style={{ marginBottom: 8 }}>The database could not be opened.</p>
        <p style={{ color: 'var(--color-neutral-600)' }}>{error}</p>
      </div>
    );
  }

  if (!store) return <>{fallback}</>;

  return <LedgerContext.Provider value={store}>{children}</LedgerContext.Provider>;
}
