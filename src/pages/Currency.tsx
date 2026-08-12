/**
 * Base-currency picker, plus the state of the rate cache.
 *
 * Changing the currency only changes the unit totals are reported in — every
 * account and transaction keeps its own. Conversion uses cached rates, so the
 * screen is honest about how stale they are and about the fact that the rates
 * service is closed.
 */

import { useEffect, useState } from 'react';

import { CURRENCIES, searchCurrencies } from '../lib/currencies';
import * as settingsRepo from '../repositories/settings';
import { closedReason } from '../services/config';
import * as ratesService from '../services/rates';
import { useLedger } from '../state/LedgerContext';
import { Muted, PrimaryButton, Rule, TextField } from '../ui/primitives';

export function Currency() {
  const { settings, netWorth, ratesAgeHours, refresh, flash } = useLedger();
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [gateReason, setGateReason] = useState<string | null>(null);

  // The gate reads user-editable overrides from the database, so ask it rather
  // than hard-coding a message that could go out of date.
  useEffect(() => {
    let live = true;
    closedReason('rates').then((reason) => {
      if (live) setGateReason(reason);
    });
    return () => {
      live = false;
    };
  }, []);

  const results = search.trim() ? searchCurrencies(search) : CURRENCIES;

  const pick = async (code: string) => {
    if (code === settings.baseCurrency) return;
    await settingsRepo.setBaseCurrency(code);
    await refresh();
    flash(`Now reporting in ${code}`);
  };

  const refreshRates = async () => {
    setBusy(true);
    const result = await ratesService.refresh({ force: true });
    setBusy(false);
    await refresh();

    if (result.status === 'updated') flash(`${result.count} rates updated`);
    else flash(result.reason ?? `Rates: ${result.status}`);
  };

  return (
    <div className="rise" style={{ paddingTop: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <TextField value={search} onChange={setSearch} placeholder="Search currencies" />

      {results.map((currency) => {
        const active = currency.code === settings.baseCurrency;
        return (
          <button
            key={currency.code}
            type="button"
            onClick={() => pick(currency.code)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 13,
              padding: 14,
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-surface)',
              border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-neutral-900)'}`,
              color: active ? 'var(--color-accent-300)' : 'var(--color-text)',
              font: '400 15px var(--font-body)',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span
              style={{
                width: 34,
                height: 34,
                flex: 'none',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-accent-900)',
                color: 'var(--color-accent-400)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                // "so'm" and "CHF" are symbols too; step the size down rather
                // than letting them spill out of the tile.
                font: `500 ${currency.symbol.length > 2 ? 10 : 15}px var(--font-heading)`,
              }}
            >
              {currency.symbol}
            </span>
            <span style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span>{currency.name}</span>
              <Muted>{currency.code}</Muted>
            </span>
            {active && (
              <span style={{ color: 'var(--color-accent-400)', fontSize: 16 }}>
                <i className="ph-fill ph-check-circle" />
              </span>
            )}
          </button>
        );
      })}

      <Rule margin="18px 0 10px" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ font: '500 15px var(--font-heading)' }}>Exchange rates</div>
        <Muted>
          {ratesAgeHours === null
            ? 'No rates cached. Accounts in other currencies are left out of your net worth.'
            : `Cached ${ratesAgeHours < 1 ? 'less than an hour' : `${Math.round(ratesAgeHours)} hours`} ago.`}
        </Muted>
        {netWorth.missing.length > 0 && (
          <Muted>Not converted: {netWorth.missing.join(', ')}</Muted>
        )}
        {gateReason && <Muted>{gateReason}</Muted>}
        <PrimaryButton height={44} onClick={refreshRates} disabled={busy}>
          {busy ? 'Checking…' : 'Refresh rates'}
        </PrimaryButton>
      </div>
    </div>
  );
}
