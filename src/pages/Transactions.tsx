/** The full transaction ledger: filter chips over day-grouped rows. */

import { useMemo, useState } from 'react';

import { groupByDay } from '../repositories/transactions';
import { formatDayHeading } from '../lib/dates';
import { useLedger } from '../state/LedgerContext';
import { Chip, ChipRow, EmptyState } from '../ui/primitives';
import { TransactionRow } from './TransactionRow';

/** `All` and `Income` are special; every other filter is a category id. */
type Filter = { kind: 'all' } | { kind: 'income' } | { kind: 'category'; id: string };

export function Transactions() {
  const { transactions, categories } = useLedger();
  const [filter, setFilter] = useState<Filter>({ kind: 'all' });

  const filtered = useMemo(() => {
    if (filter.kind === 'all') return transactions;
    if (filter.kind === 'income') return transactions.filter((t) => t.kind === 'income');
    return transactions.filter((t) => t.categoryId === filter.id);
  }, [transactions, filter]);

  const groups = useMemo(() => groupByDay(filtered), [filtered]);

  return (
    <div className="rise" style={{ paddingTop: 4 }}>
      <ChipRow>
        <Chip label="All" active={filter.kind === 'all'} onClick={() => setFilter({ kind: 'all' })} />
        <Chip
          label="Income"
          active={filter.kind === 'income'}
          onClick={() => setFilter({ kind: 'income' })}
        />
        {categories.map((category) => (
          <Chip
            key={category.id}
            label={category.name}
            active={filter.kind === 'category' && filter.id === category.id}
            onClick={() => setFilter({ kind: 'category', id: category.id })}
          />
        ))}
      </ChipRow>

      {groups.length === 0 ? (
        <EmptyState
          icon="ph-list-magnifying-glass"
          title="Nothing here"
          body={
            filter.kind === 'all'
              ? 'Transactions you add will show up here, newest first.'
              : 'No transactions match this filter yet.'
          }
        />
      ) : (
        groups.map((group) => (
          <div key={group.day} style={{ marginBottom: 18 }}>
            <div
              style={{
                font: '400 11px var(--font-body)',
                letterSpacing: '.08em',
                textTransform: 'uppercase',
                color: 'var(--color-neutral-600)',
                padding: '6px 0',
              }}
            >
              {formatDayHeading(group.day)}
            </div>
            {group.items.map((transaction) => (
              <TransactionRow key={transaction.id} transaction={transaction} />
            ))}
          </div>
        ))
      )}
    </div>
  );
}
