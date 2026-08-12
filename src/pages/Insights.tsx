/** Insights: category donut, six-month bars, and one observation worth acting on. */

import { useMemo } from 'react';

import { formatMonthShort } from '../lib/dates';
import { exponentOf, formatMoney } from '../lib/money';
import { useLedger } from '../state/LedgerContext';
import { EmptyState, Rule } from '../ui/primitives';

const BAR_MAX_HEIGHT = 108;

export function Insights() {
  const { spendingByCategory, monthlySpend, month, categoryOf, money, settings } = useLedger();

  const total = spendingByCategory.reduce((sum, row) => sum + row.total, 0);

  const shares = useMemo(
    () =>
      spendingByCategory
        .map((row) => {
          const category = categoryOf(row.categoryId);
          return {
            id: row.categoryId ?? 'uncategorised',
            name: category?.name ?? 'Uncategorised',
            color: category?.color ?? 'var(--color-neutral-700)',
            value: row.total,
            pct: total > 0 ? Math.round((row.total / total) * 100) : 0,
          };
        })
        .filter((row) => row.value > 0),
    [spendingByCategory, categoryOf, total],
  );

  // One conic-gradient stop per slice, walking the circle in share order.
  const donut = useMemo(() => {
    if (shares.length === 0) return 'var(--color-neutral-900)';
    let cursor = 0;
    const stops = shares.map((share) => {
      const start = cursor;
      cursor += (share.value / total) * 100;
      return `${share.color} ${start.toFixed(1)}% ${cursor.toFixed(1)}%`;
    });
    return `conic-gradient(${stops.join(',')})`;
  }, [shares, total]);

  const peak = Math.max(1, ...monthlySpend.map((m) => m.total));

  /** Compares this month against the average of the months before it. */
  const observation = useMemo(() => {
    const past = monthlySpend.slice(0, -1).filter((m) => m.total > 0);
    if (past.length < 2 || month.expense === 0) return null;

    const average = past.reduce((sum, m) => sum + m.total, 0) / past.length;
    const delta = Math.round(((month.expense - average) / average) * 100);
    if (Math.abs(delta) < 10) return null;

    return delta > 0
      ? `Spending is up ${delta}% against your ${past.length}-month average. The largest share is ${shares[0]?.name.toLowerCase() ?? 'uncategorised'}.`
      : `Spending is down ${Math.abs(delta)}% against your ${past.length}-month average — ${money(Math.round(average - month.expense))} below your usual pace.`;
  }, [monthlySpend, month.expense, shares, money]);

  if (total === 0 && monthlySpend.every((m) => m.total === 0)) {
    return (
      <EmptyState
        icon="ph-chart-donut"
        title="No spending to chart"
        body="Once you log a few expenses, this is where the breakdown by category and month appears."
      />
    );
  }

  return (
    <div className="rise" style={{ paddingTop: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
        <div
          style={{
            width: 132,
            height: 132,
            borderRadius: '50%',
            flex: 'none',
            background: donut,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: 92,
              height: 92,
              borderRadius: '50%',
              background: 'var(--color-bg)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
            }}
          >
            <span
              style={{
                font: '400 10px var(--font-body)',
                color: 'var(--color-neutral-600)',
                letterSpacing: '.06em',
                textTransform: 'uppercase',
              }}
            >
              {new Date().toLocaleDateString(undefined, { month: 'long' })}
            </span>
            <span style={{ font: '500 18px var(--font-heading)' }}>{money(month.expense)}</span>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 9, minWidth: 0 }}>
          {shares.slice(0, 5).map((share) => (
            <div key={share.id} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: share.color,
                  flex: 'none',
                }}
              />
              <span
                style={{
                  flex: 1,
                  font: '400 13px var(--font-body)',
                  color: 'var(--color-neutral-300)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {share.name}
              </span>
              <span style={{ font: '400 12px var(--font-body)', color: 'var(--color-neutral-600)' }}>
                {share.pct}%
              </span>
            </div>
          ))}
        </div>
      </div>

      <Rule margin="24px 0 18px" />

      <div style={{ font: '500 16px var(--font-heading)', marginBottom: 14 }}>Last 6 months</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 150 }}>
        {monthlySpend.map((entry, index) => {
          const isCurrent = index === monthlySpend.length - 1;
          return (
            <div
              key={entry.monthStart}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                height: '100%',
                justifyContent: 'flex-end',
              }}
            >
              <span style={{ font: '400 10px var(--font-body)', color: 'var(--color-neutral-600)' }}>
                {formatMonthShort(entry.monthStart)}
              </span>
              <div
                style={{
                  width: '100%',
                  // Empty months keep a 2px sliver so the axis stays readable.
                  height: Math.max(2, Math.round((entry.total / peak) * BAR_MAX_HEIGHT)),
                  borderRadius: 4,
                  background: isCurrent ? 'var(--color-accent)' : 'var(--color-neutral-800)',
                }}
              />
              <span style={{ font: '400 11px var(--font-body)', color: 'var(--color-neutral-500)' }}>
                {compact(entry.total, settings.baseCurrency)}
              </span>
            </div>
          );
        })}
      </div>

      {observation && (
        <div
          style={{
            marginTop: 26,
            border: '1px solid var(--color-neutral-800)',
            borderRadius: 'var(--radius-md)',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: 'var(--color-accent-400)',
              font: '400 12px var(--font-body)',
              letterSpacing: '.06em',
              textTransform: 'uppercase',
            }}
          >
            <i className="ph ph-lightbulb" />
            <span>Noticed</span>
          </div>
          <div
            style={{
              font: '400 14px/1.55 var(--font-body)',
              color: 'var(--color-neutral-300)',
              textWrap: 'pretty',
            }}
          >
            {observation}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * "$3.2k" — the bar labels have no room for full precision.
 *
 * Uses the currency's own exponent, so a UZS or JPY figure is not divided by
 * 100 as if it were dollars.
 */
function compact(minorUnits: number, currency: string): string {
  const major = minorUnits / 10 ** exponentOf(currency);
  if (major >= 1_000_000) return `${(major / 1_000_000).toFixed(1)}m`;
  if (major >= 1000) return `${(major / 1000).toFixed(1)}k`;
  return formatMoney(minorUnits, currency, { compact: true });
}
