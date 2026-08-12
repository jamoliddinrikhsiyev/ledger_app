/**
 * Settings.
 *
 * The design showed a signed-in profile; there is no account here, so the
 * header is a local display name and the rows say plainly where data lives.
 */

import { useState } from 'react';
import { useHistory } from 'react-router-dom';

import { parseAmount } from '../lib/money';
import * as settingsRepo from '../repositories/settings';
import type { AppSettings } from '../repositories/settings';
import { SERVICES_ENABLED } from '../services/config';
import { useLedger } from '../state/LedgerContext';
import { Sheet } from '../ui/Sheet';
import { Muted, PrimaryButton, TextField } from '../ui/primitives';

function Toggle({
  name,
  sub,
  value,
  onChange,
}: {
  name: string;
  sub: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 2px',
        borderBottom: '1px solid var(--color-neutral-900)',
      }}
    >
      <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span style={{ font: '400 15px var(--font-body)' }}>{name}</span>
        <Muted>{sub}</Muted>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={name}
        onClick={() => onChange(!value)}
        style={{
          width: 44,
          height: 26,
          flex: 'none',
          borderRadius: 999,
          border: `1px solid ${value ? 'var(--color-accent)' : 'var(--color-neutral-800)'}`,
          background: value
            ? 'color-mix(in srgb, var(--color-accent) 35%, transparent)'
            : 'var(--color-neutral-900)',
          position: 'relative',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: value ? 20 : 2,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: value ? 'var(--color-accent-300)' : 'var(--color-neutral-600)',
            transition: 'left .18s ease',
          }}
        />
      </button>
    </div>
  );
}

export function Settings() {
  const history = useHistory();
  const { settings, categories, goals, accounts, money, refresh, flash } = useLedger();

  const [planOpen, setPlanOpen] = useState(false);
  const [plan, setPlan] = useState('');
  const [nameOpen, setNameOpen] = useState(false);
  const [name, setName] = useState(settings.displayName);

  const setFlag = async (key: keyof AppSettings, value: boolean) => {
    await settingsRepo.set(key, value as never);
    await refresh();
  };

  const savePlan = async () => {
    const amount = parseAmount(plan, settings.baseCurrency);
    if (amount === null || amount < 0) {
      flash('Enter a monthly amount');
      return;
    }
    await settingsRepo.set('monthlyPlan', amount);
    setPlanOpen(false);
    await refresh();
    flash(amount > 0 ? `Monthly plan set to ${money(amount)}` : 'Monthly plan cleared');
  };

  const saveName = async () => {
    await settingsRepo.set('displayName', name.trim());
    setNameOpen(false);
    await refresh();
  };

  const initials = settings.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  const rows = [
    { name: 'Monthly plan', detail: settings.monthlyPlan > 0 ? money(settings.monthlyPlan) : 'not set', go: () => { setPlan(''); setPlanOpen(true); } },
    { name: 'Currency', detail: settings.baseCurrency, go: () => history.push('/currency') },
    { name: 'Categories', detail: `${categories.length}`, go: () => history.push('/categories') },
    { name: 'Savings goals', detail: `${goals.length}`, go: () => history.push('/goals') },
    { name: 'Accounts', detail: `${accounts.length}`, go: () => history.push('/accounts') },
  ];

  return (
    <div className="rise" style={{ paddingTop: 4, display: 'flex', flexDirection: 'column', gap: 22 }}>
      <button
        type="button"
        onClick={() => { setName(settings.displayName); setNameOpen(true); }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 13,
          background: 'transparent',
          border: 0,
          padding: 0,
          color: 'var(--color-text)',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div
          style={{
            width: 46,
            height: 46,
            flex: 'none',
            borderRadius: '50%',
            background: 'var(--color-accent-900)',
            color: 'var(--color-accent-400)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            font: '500 16px var(--font-heading)',
            fontSize: initials ? 16 : 20,
          }}
        >
          {initials || <i className="ph ph-user" />}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ font: '400 15px var(--font-body)' }}>
            {settings.displayName || 'Add your name'}
          </span>
          <Muted>Stored on this device · no account</Muted>
        </div>
      </button>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <Toggle
          name="Spending alerts"
          sub="When a category passes 80% of its cap"
          value={settings.spendingAlerts}
          onChange={(v) => setFlag('spendingAlerts', v)}
        />
        <Toggle
          name="Require device unlock"
          sub="On every launch"
          value={settings.biometricLock}
          onChange={(v) => setFlag('biometricLock', v)}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {rows.map((row) => (
          <button
            key={row.name}
            type="button"
            onClick={row.go}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '14px 2px',
              background: 'transparent',
              border: 0,
              borderBottom: '1px solid var(--color-neutral-900)',
              color: 'var(--color-text)',
              font: '400 15px var(--font-body)',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{ flex: 1 }}>{row.name}</span>
            <span style={{ color: 'var(--color-neutral-600)', font: '400 13px var(--font-body)' }}>
              {row.detail}
            </span>
            <span style={{ color: 'var(--color-neutral-700)', fontSize: 14 }}>
              <i className="ph ph-caret-right" />
            </span>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 8 }}>
        <div style={{ font: '500 15px var(--font-heading)' }}>Data and privacy</div>
        <Muted>
          Everything lives in a database on this device. Ledger works with no connection and has no
          account to sign in to.
        </Muted>
        <Muted>
          {SERVICES_ENABLED
            ? 'External services are available in this build.'
            : 'External services are switched off in this build — nothing leaves the device.'}
        </Muted>
      </div>

      <Sheet open={planOpen} title="Monthly spending plan" onClose={() => setPlanOpen(false)}>
        <Muted>
          What you intend to spend in a month. Ledger divides what is left by the days remaining to
          work out the safe-to-spend figure. Zero hides that card.
        </Muted>
        <TextField
          label={settings.baseCurrency}
          value={plan}
          onChange={setPlan}
          inputMode="decimal"
          placeholder="0"
        />
        <PrimaryButton height={48} onClick={savePlan}>
          Save plan
        </PrimaryButton>
      </Sheet>

      <Sheet open={nameOpen} title="Your name" onClose={() => setNameOpen(false)}>
        <TextField value={name} onChange={setName} placeholder="Name" />
        <PrimaryButton height={48} onClick={saveName}>
          Save
        </PrimaryButton>
      </Sheet>
    </div>
  );
}
