/** Budgets: one card per capped category, with spend against its cap. */

import { useState } from 'react';

import * as budgetsRepo from '../repositories/budgets';
import { formatMoney, parseAmount } from '../lib/money';
import { useLedger } from '../state/LedgerContext';
import { Sheet } from '../ui/Sheet';
import {
  Chip,
  ChipRow,
  EmptyState,
  IconBadge,
  Muted,
  PrimaryButton,
  ProgressBar,
  TextButton,
  TextField,
} from '../ui/primitives';

export function Budgets() {
  const { budgets, categories, settings, categoryOf, money, refresh, flash } = useLedger();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [cap, setCap] = useState('');

  const onTrack = budgets.filter((b) => b.ratio < 1).length;
  // Only expense categories without a budget can take a new one.
  const available = categories.filter(
    (c) => c.kind === 'expense' && !budgets.some((b) => b.categoryId === c.id),
  );

  const openSheet = () => {
    setCategoryId(available[0]?.id ?? null);
    setCap('');
    setSheetOpen(true);
  };

  const save = async () => {
    const limit = parseAmount(cap, settings.baseCurrency);
    if (!categoryId || limit === null || limit <= 0) {
      flash('Pick a category and a cap above zero');
      return;
    }

    await budgetsRepo.create({
      categoryId,
      limit,
      currency: settings.baseCurrency,
      period: 'monthly',
    });
    setSheetOpen(false);
    await refresh();
    flash(`${categoryOf(categoryId)?.name ?? 'Budget'} capped at ${money(limit)}`);
  };

  const removeBudget = async (id: string, name: string) => {
    await budgetsRepo.remove(id);
    await refresh();
    flash(`${name} budget removed`);
  };

  return (
    <div className="rise" style={{ paddingTop: 4, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {budgets.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <span style={{ font: '400 13px var(--font-body)', color: 'var(--color-neutral-500)' }}>
            {onTrack} of {budgets.length} categories under cap
          </span>
          <TextButton onClick={openSheet}>Add</TextButton>
        </div>
      )}

      {budgets.length === 0 ? (
        <EmptyState
          icon="ph-target"
          title="No budgets yet"
          body="Cap a category and Ledger tracks how much of it you have used this month."
          action={
            available.length > 0 ? (
              <PrimaryButton height={46} onClick={openSheet}>
                Set a budget
              </PrimaryButton>
            ) : undefined
          }
        />
      ) : (
        budgets.map((budget) => {
          const category = categoryOf(budget.categoryId);
          const over = budget.spent > budget.limit;
          return (
            <div
              key={budget.id}
              style={{
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface)',
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <IconBadge
                  icon={category?.icon ?? 'ph-tag'}
                  size={30}
                  color={over ? 'var(--color-accent-300)' : (category?.color ?? 'var(--color-accent-400)')}
                  background="var(--color-accent-900)"
                />
                <span style={{ flex: 1, font: '400 15px var(--font-body)' }}>
                  {category?.name ?? 'Uncategorised'}
                </span>
                <span
                  style={{
                    font: '500 14px var(--font-heading)',
                    // Over-cap reads brighter, not red: Nocturne has no alarm colour.
                    color: over ? 'var(--color-accent-300)' : 'var(--color-neutral-500)',
                  }}
                >
                  {over
                    ? `${formatMoney(budget.spent - budget.limit, budget.currency)} over`
                    : `${formatMoney(budget.remaining, budget.currency)} left`}
                </span>
              </div>
              <ProgressBar
                ratio={budget.ratio}
                height={6}
                fill={over ? 'var(--color-accent-300)' : (category?.color ?? 'var(--color-accent)')}
              />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  font: '400 12px var(--font-body)',
                  color: 'var(--color-neutral-600)',
                }}
              >
                <span>{formatMoney(budget.spent, budget.currency)} spent</span>
                <button
                  type="button"
                  onClick={() => removeBudget(budget.id, category?.name ?? 'Budget')}
                  style={{
                    background: 'transparent',
                    border: 0,
                    padding: 0,
                    color: 'var(--color-neutral-600)',
                    font: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  of {formatMoney(budget.limit, budget.currency)}
                </button>
              </div>
            </div>
          );
        })
      )}

      <Sheet open={sheetOpen} title="New budget" onClose={() => setSheetOpen(false)}>
        {available.length === 0 ? (
          <Muted>Every expense category already has a cap.</Muted>
        ) : (
          <>
            <ChipRow>
              {available.map((category) => (
                <Chip
                  key={category.id}
                  label={category.name}
                  icon={category.icon ?? undefined}
                  active={categoryId === category.id}
                  onClick={() => setCategoryId(category.id)}
                />
              ))}
            </ChipRow>
            <TextField
              label={`Monthly cap in ${settings.baseCurrency}`}
              value={cap}
              onChange={setCap}
              inputMode="decimal"
              placeholder="0"
            />
            <PrimaryButton height={48} onClick={save} disabled={!cap.trim() || !categoryId}>
              Set cap
            </PrimaryButton>
          </>
        )}
      </Sheet>
    </div>
  );
}
