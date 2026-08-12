/**
 * Onboarding.
 *
 * The design's flow was built around connecting a bank. This app holds its own
 * data and every service is closed, so there is nothing to connect to — the
 * same four beats now set up a first account and a monthly plan instead. The
 * visual language is unchanged; only the promise is honest.
 */

import { useState } from 'react';

import type { AccountKind } from '../domain/types';
import { CURRENCIES } from '../lib/currencies';
import { parseAmount } from '../lib/money';
import * as accountsRepo from '../repositories/accounts';
import * as settingsRepo from '../repositories/settings';
import { useLedger } from '../state/LedgerContext';
import { Chip, ChipRow, Muted, PrimaryButton, TextField } from '../ui/primitives';

const KINDS: { kind: AccountKind; label: string; icon: string }[] = [
  { kind: 'cash', label: 'Cash', icon: 'ph-money' },
  { kind: 'card', label: 'Card', icon: 'ph-credit-card' },
  { kind: 'bank', label: 'Bank', icon: 'ph-bank' },
  { kind: 'savings', label: 'Savings', icon: 'ph-vault' },
];

export function Onboarding({ onDone }: { onDone: () => void }) {
  const { settings, refresh } = useLedger();

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<AccountKind>('cash');
  const [currency, setCurrency] = useState(settings.baseCurrency);
  const [balance, setBalance] = useState('');
  const [plan, setPlan] = useState('');
  const [saving, setSaving] = useState(false);

  const finish = async (withSetup: boolean) => {
    setSaving(true);

    if (withSetup) {
      const opening = parseAmount(balance || '0', currency) ?? 0;
      await accountsRepo.create({
        name: name.trim() || 'Everyday',
        kind,
        currency,
        openingBalance: opening,
        color: null,
        icon: KINDS.find((k) => k.kind === kind)?.icon ?? 'ph-bank',
        last4: null,
        archived: false,
        sortOrder: 0,
      });

      // The account's currency becomes the reporting unit: on a fresh install
      // it is the only one there is, so anything else would show a zero total.
      if (currency !== settings.baseCurrency) {
        await settingsRepo.setBaseCurrency(currency);
      }

      const monthly = parseAmount(plan, currency);
      if (monthly !== null && monthly > 0) {
        await settingsRepo.set('monthlyPlan', monthly);
      }
    }

    await settingsRepo.set('onboarded', true);
    await refresh();
    setSaving(false);
    onDone();
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'var(--color-bg)',
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 'max(96px, calc(env(safe-area-inset-top) + 60px))',
        paddingLeft: 26,
        paddingRight: 26,
        paddingBottom: 'max(44px, env(safe-area-inset-bottom))',
      }}
    >
      {step === 0 && (
        <>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 20 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-accent-700)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-accent-400)',
                fontSize: 26,
              }}
            >
              <i className="ph ph-chart-donut" />
            </div>
            <div
              style={{
                font: '500 38px/1.08 var(--font-heading)',
                letterSpacing: '-.02em',
                textWrap: 'pretty',
              }}
            >
              Every account.
              <br />
              One running total.
            </div>
            <div
              style={{
                font: '400 15px/1.55 var(--font-body)',
                color: 'var(--color-neutral-500)',
                maxWidth: 300,
                textWrap: 'pretty',
              }}
            >
              Ledger keeps your accounts, sorts what you spend, and tells you what is safe to spend
              today. Everything stays on this device — no account, no connection needed.
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <PrimaryButton onClick={() => setStep(1)}>Set up an account</PrimaryButton>
            <button
              type="button"
              onClick={() => finish(false)}
              style={{
                height: 44,
                borderRadius: 'var(--radius-md)',
                background: 'transparent',
                border: 0,
                color: 'var(--color-neutral-600)',
                font: '400 14px var(--font-body)',
                cursor: 'pointer',
              }}
            >
              Look around first
            </button>
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <div style={{ font: '500 27px/1.15 var(--font-heading)', letterSpacing: '-.02em', marginBottom: 6 }}>
            Your first account
          </div>
          <Muted>Where your money sits today. You can add more later.</Muted>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1, marginTop: 22 }}>
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
              label="Balance today"
              value={balance}
              onChange={setBalance}
              inputMode="decimal"
              placeholder="0"
            />
          </div>

          <PrimaryButton onClick={() => setStep(2)} disabled={!name.trim()}>
            Continue
          </PrimaryButton>
        </>
      )}

      {step === 2 && (
        <>
          <div style={{ font: '500 27px/1.15 var(--font-heading)', letterSpacing: '-.02em', marginBottom: 6 }}>
            What do you plan to spend?
          </div>
          <Muted>
            A rough monthly figure is enough. Ledger divides what is left by the days remaining, so
            you always know what today can take. Skip it and this stays hidden.
          </Muted>

          <div style={{ flex: 1, marginTop: 22 }}>
            <TextField
              label={`Per month in ${currency}`}
              value={plan}
              onChange={setPlan}
              inputMode="decimal"
              placeholder="0"
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <PrimaryButton onClick={() => finish(true)} disabled={saving}>
              {saving ? 'Setting up…' : 'Open Ledger'}
            </PrimaryButton>
            <button
              type="button"
              onClick={() => { setPlan(''); finish(true); }}
              disabled={saving}
              style={{
                height: 44,
                borderRadius: 'var(--radius-md)',
                background: 'transparent',
                border: 0,
                color: 'var(--color-neutral-600)',
                font: '400 14px var(--font-body)',
                cursor: 'pointer',
              }}
            >
              Skip for now
            </button>
          </div>
        </>
      )}
    </div>
  );
}
