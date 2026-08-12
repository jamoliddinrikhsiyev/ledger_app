/** Categories: what each has cost this month, plus creation and removal. */

import { useState } from 'react';

import { formatMoney, parseAmount } from '../lib/money';
import * as budgetsRepo from '../repositories/budgets';
import * as categoriesRepo from '../repositories/categories';
import { CATEGORY_ICONS, CATEGORY_RAMP } from '../repositories/categories';
import { useLedger } from '../state/LedgerContext';
import { Sheet } from '../ui/Sheet';
import { IconBadge, Muted, PrimaryButton, TextField } from '../ui/primitives';

export function Categories() {
  const { categories, spendingByCategory, budgets, settings, refresh, flash, money } = useLedger();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(CATEGORY_ICONS[0]);
  const [cap, setCap] = useState('');

  const spentOf = (id: string) =>
    spendingByCategory.find((row) => row.categoryId === id)?.total ?? 0;
  const capOf = (id: string) => budgets.find((b) => b.categoryId === id) ?? null;

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      flash('Give it a name that is not taken');
      return;
    }

    const category = await categoriesRepo.create({
      name: trimmed,
      kind: 'expense',
      icon,
      color: CATEGORY_RAMP[categories.length % CATEGORY_RAMP.length],
      parentId: null,
      sortOrder: categories.length,
    });

    const limit = parseAmount(cap, settings.baseCurrency);
    if (limit !== null && limit > 0) {
      await budgetsRepo.create({
        categoryId: category.id,
        limit,
        currency: settings.baseCurrency,
        period: 'monthly',
      });
    }

    setOpen(false);
    setName('');
    setCap('');
    await refresh();
    flash(limit && limit > 0 ? `${trimmed} added with a ${money(limit)} cap` : `${trimmed} added`);
  };

  const remove = async (id: string, label: string) => {
    await categoriesRepo.remove(id);
    await refresh();
    // Transactions survive with a null categoryId — say so, since deleting a
    // category looks destructive.
    flash(`${label} removed · its transactions were kept`);
  };

  return (
    <div className="rise" style={{ paddingTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {categories.map((category) => {
        const budget = capOf(category.id);
        return (
          <div
            key={category.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '13px 0',
              borderBottom: '1px solid var(--color-neutral-900)',
            }}
          >
            <IconBadge
              icon={category.icon ?? 'ph-tag'}
              color={category.color ?? 'var(--color-accent-400)'}
            />
            <span style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span style={{ font: '400 15px var(--font-body)' }}>{category.name}</span>
              <Muted>
                {formatMoney(spentOf(category.id), settings.baseCurrency)} this month ·{' '}
                {budget ? `${formatMoney(budget.limit, budget.currency)} cap` : 'no cap'}
              </Muted>
            </span>
            <button
              type="button"
              onClick={() => remove(category.id, category.name)}
              aria-label={`Delete ${category.name}`}
              style={{
                width: 28,
                height: 28,
                flex: 'none',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-neutral-800)',
                background: 'transparent',
                color: 'var(--color-neutral-500)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
              }}
            >
              <i className="ph ph-trash" />
            </button>
          </div>
        );
      })}

      <PrimaryButton height={46} style={{ marginTop: 16 }} onClick={() => setOpen(true)}>
        New category
      </PrimaryButton>

      <Sheet open={open} title="New category" onClose={() => setOpen(false)}>
        <TextField value={name} onChange={setName} placeholder="Name, e.g. Coffee" />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {CATEGORY_ICONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setIcon(option)}
              aria-label={option}
              style={{
                width: 40,
                height: 40,
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${icon === option ? 'var(--color-accent)' : 'var(--color-neutral-800)'}`,
                background: 'transparent',
                color: icon === option ? 'var(--color-accent-300)' : 'var(--color-neutral-500)',
                fontSize: 17,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <i className={`ph ${option}`} />
            </button>
          ))}
        </div>
        <TextField
          label="Monthly cap (optional)"
          value={cap}
          onChange={setCap}
          inputMode="decimal"
          placeholder="0"
        />
        <PrimaryButton height={48} onClick={save} disabled={!name.trim()}>
          Add category
        </PrimaryButton>
      </Sheet>
    </div>
  );
}
