/**
 * One transaction row, shared by Home and the Transactions list so the two
 * cannot drift apart.
 */

import type { Transaction } from '../domain/types';
import { formatMoney } from '../lib/money';
import { useLedger } from '../state/LedgerContext';
import { ListRow } from '../ui/primitives';

export function TransactionRow({
  transaction,
  onClick,
}: {
  transaction: Transaction;
  onClick?: () => void;
}) {
  const { categoryOf, accounts } = useLedger();

  const category = categoryOf(transaction.categoryId);
  const account = accounts.find((a) => a.id === transaction.accountId);
  const isIncome = transaction.kind === 'income';

  const icon = transaction.kind === 'transfer'
    ? 'ph-arrows-left-right'
    : (category?.icon ?? 'ph-tag');

  const subtitle = [category?.name ?? (transaction.kind === 'transfer' ? 'Transfer' : 'Uncategorised'), account?.name]
    .filter(Boolean)
    .join(' · ');

  return (
    <ListRow
      icon={icon}
      iconColor={category?.color ?? 'var(--color-neutral-500)'}
      title={transaction.payee || category?.name || 'Transaction'}
      subtitle={subtitle}
      value={`${isIncome ? '+' : '−'}${formatMoney(transaction.amount, transaction.currency)}`}
      // Income is the only figure that earns the accent; everything else stays
      // in the text colour so the list does not read as a scoreboard.
      valueColor={isIncome ? 'var(--color-accent-400)' : 'var(--color-text)'}
      onClick={onClick}
    />
  );
}
