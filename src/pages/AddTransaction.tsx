/**
 * The add-transaction overlay: a keypad, a category strip and an account picker.
 *
 * It uses its own keypad rather than a text input so the amount is unambiguous
 * on a phone and the layout does not jump when a system keyboard appears.
 */

import { useMemo, useState } from 'react';

import type { TransactionKind } from '../domain/types';
import { exponentOf, formatMoney, parseAmount } from '../lib/money';
import * as transactionsRepo from '../repositories/transactions';
import { useLedger } from '../state/LedgerContext';
import { Chip, ChipRow, IconButton, PrimaryButton, TextField } from '../ui/primitives';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

export function AddTransaction({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { accounts, categories, settings, refresh, flash } = useLedger();

  const [kind, setKind] = useState<TransactionKind>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accountIndex, setAccountIndex] = useState(0);
  const [payee, setPayee] = useState('');

  const account = accounts[accountIndex];
  const currency = account?.currency ?? settings.baseCurrency;
  const relevant = useMemo(
    () => categories.filter((c) => c.kind === (kind === 'income' ? 'income' : 'expense')),
    [categories, kind],
  );

  const parsed = parseAmount(amount || '0', currency) ?? 0;
  const canSave = parsed > 0 && Boolean(account);

  const press = (key: string) => {
    setAmount((current) => {
      if (key === '⌫') return current.slice(0, -1);
      if (key === '.') {
        // A zero-decimal currency has nothing to type after the point.
        if (exponentOf(currency) === 0 || current.includes('.')) return current;
        return current === '' ? '0.' : `${current}.`;
      }
      // Cap the decimals at what the currency actually has.
      const [, decimals] = current.split('.');
      if (decimals !== undefined && decimals.length >= exponentOf(currency)) return current;
      if (current.replace('.', '').length > 9) return current;
      return current + key;
    });
  };

  const reset = () => {
    setAmount('');
    setPayee('');
    setKind('expense');
    setCategoryId(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const save = async () => {
    if (!canSave || !account) return;

    await transactionsRepo.create({
      kind,
      amount: parsed,
      currency,
      accountId: account.id,
      counterAccountId: null,
      categoryId,
      payee: payee.trim() || (kind === 'income' ? 'Income' : 'Manual entry'),
      note: null,
      occurredAt: Date.now(),
      pending: false,
    });

    close();
    await refresh();
    flash(`${formatMoney(parsed, currency)} logged`);
  };

  if (!open) return null;

  return (
    <div
      className="rise"
      style={{
        position: 'absolute',
        inset: 0,
        background: 'var(--color-bg)',
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 'max(56px, calc(env(safe-area-inset-top) + 20px))',
        paddingLeft: 20,
        paddingRight: 20,
        paddingBottom: 'max(30px, env(safe-area-inset-bottom))',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <IconButton icon="ph-x" label="Close" size={32} onClick={close} />
        <div style={{ font: '500 16px var(--font-heading)' }}>Add manually</div>
        <div style={{ width: 32 }} />
      </div>

      <div style={{ display: 'flex', gap: 7, marginBottom: 10 }}>
        <Chip
          label="Expense"
          active={kind === 'expense'}
          onClick={() => { setKind('expense'); setCategoryId(null); }}
        />
        <Chip
          label="Income"
          active={kind === 'income'}
          onClick={() => { setKind('income'); setCategoryId(null); }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 0 16px' }}>
        <div
          style={{
            font: '400 11px var(--font-body)',
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            color: 'var(--color-neutral-600)',
          }}
        >
          Amount
        </div>
        <div
          style={{
            font: '500 52px/1 var(--font-heading)',
            letterSpacing: '-.03em',
            color: amount ? 'var(--color-text)' : 'var(--color-neutral-800)',
          }}
        >
          {formatMoney(parsed, currency)}
        </div>
      </div>

      <ChipRow>
        {relevant.map((category) => (
          <Chip
            key={category.id}
            label={category.name}
            icon={category.icon ?? undefined}
            active={categoryId === category.id}
            onClick={() => setCategoryId(categoryId === category.id ? null : category.id)}
          />
        ))}
      </ChipRow>

      <div style={{ marginBottom: 10 }}>
        <TextField value={payee} onChange={setPayee} placeholder="Who or what (optional)" />
      </div>

      <button
        type="button"
        onClick={() => setAccountIndex((i) => (i + 1) % Math.max(1, accounts.length))}
        disabled={accounts.length === 0}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '13px 14px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--color-surface)',
          border: 0,
          color: 'var(--color-text)',
          font: '400 14px var(--font-body)',
          cursor: accounts.length ? 'pointer' : 'not-allowed',
          marginBottom: 14,
        }}
      >
        <span style={{ color: 'var(--color-accent-400)', fontSize: 16 }}>
          <i className="ph ph-bank" />
        </span>
        <span style={{ flex: 1, textAlign: 'left' }}>
          {account ? `${account.name} · ${account.currency}` : 'No accounts yet — add one first'}
        </span>
        {accounts.length > 1 && (
          <span style={{ color: 'var(--color-neutral-600)', fontSize: 13 }}>
            <i className="ph ph-caret-up-down" />
          </span>
        )}
      </button>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, minHeight: 200 }}>
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => press(key)}
            style={{
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-surface)',
              border: 0,
              color: 'var(--color-text)',
              font: '400 24px var(--font-body)',
              cursor: 'pointer',
            }}
          >
            {key}
          </button>
        ))}
      </div>

      <PrimaryButton height={52} style={{ marginTop: 12 }} onClick={save} disabled={!canSave}>
        {accounts.length === 0 ? 'Add an account first' : 'Save transaction'}
      </PrimaryButton>
    </div>
  );
}
