/** Recurring bills. Each stores a day of the month; the next date is derived. */

import { useState } from 'react';

import { formatDueDate } from '../lib/dates';
import { formatMoney, parseAmount } from '../lib/money';
import * as billsRepo from '../repositories/bills';
import { useLedger } from '../state/LedgerContext';
import { Sheet } from '../ui/Sheet';
import {
  Chip,
  ChipRow,
  EmptyState,
  IconBadge,
  Muted,
  PrimaryButton,
  SurfaceRow,
  TextField,
} from '../ui/primitives';

const BILL_ICONS = ['ph-house-line', 'ph-lightning', 'ph-wifi-high', 'ph-phone', 'ph-receipt', 'ph-television'];

export function Bills() {
  const { bills, settings, categories, refresh, flash } = useLedger();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDay, setDueDay] = useState('1');
  const [icon, setIcon] = useState(BILL_ICONS[0]);
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const expenseCategories = categories.filter((c) => c.kind === 'expense');

  const save = async () => {
    const trimmed = name.trim();
    const value = parseAmount(amount, settings.baseCurrency);
    const day = Number.parseInt(dueDay, 10);

    if (!trimmed || value === null || value <= 0 || !Number.isFinite(day) || day < 1 || day > 31) {
      flash('A bill needs a name, an amount and a day from 1 to 31');
      return;
    }

    await billsRepo.create({
      name: trimmed,
      icon,
      amount: value,
      currency: settings.baseCurrency,
      dueDay: day,
      categoryId,
      accountId: null,
    });

    setOpen(false);
    setName('');
    setAmount('');
    await refresh();
    flash(`${trimmed} added`);
  };

  const remove = async (id: string, label: string) => {
    await billsRepo.remove(id);
    await refresh();
    flash(`${label} removed`);
  };

  return (
    <div className="rise" style={{ paddingTop: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {bills.length === 0 ? (
        <EmptyState
          icon="ph-receipt"
          title="No bills yet"
          body="Add what repeats every month — rent, utilities, subscriptions — and Ledger shows what is due next."
          action={
            <PrimaryButton height={46} onClick={() => setOpen(true)}>
              Add a bill
            </PrimaryButton>
          }
        />
      ) : (
        <>
          {bills.map((bill) => (
            <SurfaceRow key={bill.id}>
              <IconBadge
                icon={bill.icon ?? 'ph-receipt'}
                size={32}
                background="var(--color-accent-900)"
              />
              <span style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ font: '400 14px var(--font-body)' }}>{bill.name}</span>
                <Muted>{formatDueDate(bill.dueAt)}</Muted>
              </span>
              <span style={{ font: '500 14px var(--font-heading)', color: 'var(--color-neutral-300)' }}>
                {formatMoney(bill.amount, bill.currency)}
              </span>
              <button
                type="button"
                onClick={() => remove(bill.id, bill.name)}
                aria-label={`Delete ${bill.name}`}
                style={{
                  width: 26,
                  height: 26,
                  flex: 'none',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-neutral-800)',
                  background: 'transparent',
                  color: 'var(--color-neutral-500)',
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                <i className="ph ph-trash" />
              </button>
            </SurfaceRow>
          ))}
          <PrimaryButton height={46} style={{ marginTop: 6 }} onClick={() => setOpen(true)}>
            Add a bill
          </PrimaryButton>
        </>
      )}

      <Sheet open={open} title="New bill" onClose={() => setOpen(false)}>
        <TextField value={name} onChange={setName} placeholder="Name, e.g. Rent" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <TextField
            label={`Amount in ${settings.baseCurrency}`}
            value={amount}
            onChange={setAmount}
            inputMode="decimal"
            placeholder="0"
          />
          <TextField
            label="Day of month"
            value={dueDay}
            onChange={(v) => setDueDay(v.replace(/[^0-9]/g, '').slice(0, 2))}
            inputMode="numeric"
            placeholder="1"
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Muted>Icon</Muted>
          <ChipRow>
            {BILL_ICONS.map((option) => (
              <Chip
                key={option}
                label=""
                icon={option}
                active={icon === option}
                onClick={() => setIcon(option)}
              />
            ))}
          </ChipRow>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Muted>Category (optional)</Muted>
          <ChipRow>
            {expenseCategories.map((category) => (
              <Chip
                key={category.id}
                label={category.name}
                active={categoryId === category.id}
                onClick={() => setCategoryId(categoryId === category.id ? null : category.id)}
              />
            ))}
          </ChipRow>
        </div>

        <PrimaryButton height={48} onClick={save} disabled={!name.trim() || !amount.trim()}>
          Add bill
        </PrimaryButton>
      </Sheet>
    </div>
  );
}
