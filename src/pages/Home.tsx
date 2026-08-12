/**
 * Home: net worth, what is safe to spend today, upcoming bills, recent activity.
 */

import { useHistory } from 'react-router-dom';

import { daysLeftInMonth, formatDueDate } from '../lib/dates';
import { formatMoney } from '../lib/money';
import { useLedger } from '../state/LedgerContext';
import {
  Eyebrow,
  EmptyState,
  IconBadge,
  Muted,
  Panel,
  PrimaryButton,
  ProgressBar,
  Rule,
  SectionHeading,
  SurfaceRow,
  TextButton,
} from '../ui/primitives';
import { TransactionRow } from './TransactionRow';

function StatTile({
  icon,
  label,
  value,
  onClick,
}: {
  icon: string;
  label: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: '1px solid var(--color-neutral-800)',
        borderRadius: 'var(--radius-md)',
        padding: 14,
        background: 'transparent',
        color: 'var(--color-text)',
        textAlign: 'left',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <span style={{ color: 'var(--color-accent-400)', fontSize: 17 }}>
        <i className={`ph ${icon}`} />
      </span>
      <span style={{ font: '400 12px var(--font-body)', color: 'var(--color-neutral-500)' }}>
        {label}
      </span>
      <span style={{ font: '500 19px var(--font-heading)' }}>{value}</span>
    </button>
  );
}

export function Home() {
  const history = useHistory();
  const store = useLedger();
  const { settings, netWorth, month, bills, transactions, budgets, money } = store;

  const daysLeft = daysLeftInMonth();
  const plan = settings.monthlyPlan;
  const remaining = Math.max(0, plan - month.expense);
  // Spread what is left over the days that are left, rather than showing the
  // whole remainder as if it were spendable today.
  const safeToday = plan > 0 ? Math.floor(remaining / daysLeft) : 0;

  const onTrack = budgets.filter((b) => b.ratio < 1).length;
  const billsInBase = bills.filter((b) => b.currency === settings.baseCurrency);
  const billsTotal = billsInBase.reduce((sum, b) => sum + b.amount, 0);
  const recent = transactions.slice(0, 5);

  return (
    <div className="rise">
      <div style={{ paddingTop: 4 }}>
        <Eyebrow>Net worth</Eyebrow>
      </div>
      <div style={{ font: '500 44px/1 var(--font-heading)', letterSpacing: '-.025em', marginTop: 8 }}>
        {money(netWorth.total)}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginTop: 8,
          font: '400 13px var(--font-body)',
          color: 'var(--color-accent-400)',
        }}
      >
        <i className={`ph ${month.net >= 0 ? 'ph-trend-up' : 'ph-trend-down'}`} />
        <span>
          {month.net >= 0 ? '+' : '−'}
          {money(Math.abs(month.net))} this month
        </span>
      </div>

      {netWorth.missing.length > 0 && (
        <div style={{ marginTop: 8, font: '400 12px/1.5 var(--font-body)', color: 'var(--color-accent-300)' }}>
          {netWorth.missing.join(', ')} not included — no exchange rate cached.
        </div>
      )}

      <Rule />

      {plan > 0 ? (
        <Panel>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={{ font: '400 12px var(--font-body)', color: 'var(--color-neutral-500)' }}>
              Safe to spend today
            </span>
            <Muted size={11}>{daysLeft} days left</Muted>
          </div>
          <div
            style={{
              font: '500 30px/1 var(--font-heading)',
              letterSpacing: '-.02em',
              color: 'var(--color-accent-300)',
            }}
          >
            {money(safeToday)}
          </div>
          <ProgressBar ratio={month.expense / plan} />
          <Muted>
            {money(month.expense)} of {money(plan)} planned
          </Muted>
        </Panel>
      ) : (
        <Panel>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={{ font: '400 12px var(--font-body)', color: 'var(--color-neutral-500)' }}>
              Safe to spend today
            </span>
          </div>
          <Muted>
            Set a monthly spending plan and Ledger works out what is safe to spend each day.
          </Muted>
          <PrimaryButton height={42} onClick={() => history.push('/settings')}>
            Set a monthly plan
          </PrimaryButton>
        </Panel>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
        <StatTile
          icon="ph-chart-donut"
          label="Spent this month"
          value={money(month.expense)}
          onClick={() => history.push('/insights')}
        />
        <StatTile
          icon="ph-target"
          label="Budgets on track"
          value={budgets.length ? `${onTrack} of ${budgets.length}` : '—'}
          onClick={() => history.push('/budgets')}
        />
      </div>

      {billsInBase.length > 0 && (
        <>
          <SectionHeading title="Upcoming bills" action={<Muted>{money(billsTotal)} due</Muted>} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {billsInBase.slice(0, 4).map((bill) => (
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
              </SurfaceRow>
            ))}
          </div>
        </>
      )}

      <SectionHeading
        title="Recent"
        action={<TextButton onClick={() => history.push('/transactions')}>See all</TextButton>}
      />
      {recent.length === 0 ? (
        <EmptyState
          icon="ph-receipt"
          title="Nothing logged yet"
          body="Tap Add to record your first transaction. Everything stays on this device."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {recent.map((transaction) => (
            <TransactionRow key={transaction.id} transaction={transaction} />
          ))}
        </div>
      )}
    </div>
  );
}
