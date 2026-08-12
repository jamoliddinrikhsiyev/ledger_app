/**
 * Accounts. The design showed bank-synced balances; here every account is
 * entered by hand, because the app holds its own data and syncing is closed.
 */

import { useState } from 'react';

import type { AccountKind } from '../domain/types';
import { formatMoney, parseAmount } from '../lib/money';
import * as accountsRepo from '../repositories/accounts';
import { CURRENCIES } from '../lib/currencies';
import { useLedger } from '../state/LedgerContext';
import { Sheet } from '../ui/Sheet';
import {
  Chip,
  ChipRow,
  EmptyState,
  IconBadge,
  Muted,
  PrimaryButton,
  TextField,
} from '../ui/primitives';

const KINDS: { kind: AccountKind; label: string; icon: string }[] = [
  { kind: 'cash', label: 'Cash', icon: 'ph-money' },
  { kind: 'card', label: 'Card', icon: 'ph-credit-card' },
  { kind: 'bank', label: 'Bank', icon: 'ph-bank' },
  { kind: 'savings', label: 'Savings', icon: 'ph-vault' },
  { kind: 'credit', label: 'Credit', icon: 'ph-credit-card' },
  { kind: 'investment', label: 'Investment', icon: 'ph-chart-line-up' },
];

function iconForKind(kind: AccountKind): string {
  return KINDS.find((k) => k.kind === kind)?.icon ?? 'ph-bank';
}

export function Accounts() {
  const { accounts, settings, refresh, flash } = useLedger();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<AccountKind>('cash');
  const [currency, setCurrency] = useState(settings.baseCurrency);
  const [balance, setBalance] = useState('');

  const save = async () => {
    const trimmed = name.trim();
    const opening = parseAmount(balance || '0', currency);
    if (!trimmed || opening === null) {
      flash('An account needs a name and a starting balance');
      return;
    }

    await accountsRepo.create({
      name: trimmed,
      kind,
      currency,
      openingBalance: opening,
      color: null,
      icon: iconForKind(kind),
      last4: null,
      archived: false,
      sortOrder: accounts.length,
    });

    setOpen(false);
    setName('');
    setBalance('');
    await refresh();
    flash(`${trimmed} added`);
  };

  return (
    <div className="rise" style={{ paddingTop: 4, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {accounts.length === 0 ? (
        <EmptyState
          icon="ph-bank"
          title="No accounts yet"
          body="Add the accounts you actually use. Balances are worked out from the transactions you log."
          action={
            <PrimaryButton height={46} onClick={() => setOpen(true)}>
              Add an account
            </PrimaryButton>
          }
        />
      ) : (
        <>
          <Muted>Stored on this device · nothing is synced</Muted>
          {accounts.map((account) => (
            <div
              key={account.id}
              style={{
                border: '1px solid var(--color-neutral-800)',
                borderRadius: 'var(--radius-md)',
                padding: 15,
                display: 'flex',
                alignItems: 'center',
                gap: 13,
              }}
            >
              <IconBadge
                icon={account.icon ?? iconForKind(account.kind)}
                size={38}
                background="var(--color-accent-900)"
              />
              <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span
                  style={{
                    font: '400 15px var(--font-body)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {account.name}
                </span>
                <Muted>
                  {KINDS.find((k) => k.kind === account.kind)?.label ?? account.kind} ·{' '}
                  {account.currency}
                </Muted>
              </span>
              <span
                style={{
                  font: '500 16px var(--font-heading)',
                  color: account.balance < 0 ? 'var(--color-accent-300)' : 'var(--color-text)',
                  flex: 'none',
                }}
              >
                {formatMoney(account.balance, account.currency)}
              </span>
            </div>
          ))}
          <PrimaryButton height={46} style={{ marginTop: 6 }} onClick={() => setOpen(true)}>
            Add another account
          </PrimaryButton>
        </>
      )}

      <Sheet open={open} title="New account" onClose={() => setOpen(false)}>
        <TextField value={name} onChange={setName} placeholder="Name, e.g. Everyday" />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Muted>Type</Muted>
          <ChipRow>
            {KINDS.map((option) => (
              <Chip
                key={option.kind}
                label={option.label}
                icon={option.icon}
                active={kind === option.kind}
                onClick={() => setKind(option.kind)}
              />
            ))}
          </ChipRow>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Muted>Currency</Muted>
          <ChipRow>
            {CURRENCIES.slice(0, 8).map((option) => (
              <Chip
                key={option.code}
                label={option.code}
                active={currency === option.code}
                onClick={() => setCurrency(option.code)}
              />
            ))}
          </ChipRow>
        </div>

        <TextField
          label="Starting balance"
          value={balance}
          onChange={setBalance}
          inputMode="decimal"
          placeholder="0"
        />

        <PrimaryButton height={48} onClick={save} disabled={!name.trim()}>
          Add account
        </PrimaryButton>
      </Sheet>
    </div>
  );
}
