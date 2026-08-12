/** The "More" menu — everything not worth a tab of its own. */

import { useHistory } from 'react-router-dom';

import { useLedger } from '../state/LedgerContext';

interface MenuItem {
  path: string;
  icon: string;
  name: string;
  detail: string;
}

export function More() {
  const history = useHistory();
  const { accounts, transactions, goals, categories, bills, settings } = useLedger();

  const items: MenuItem[] = [
    { path: '/accounts', icon: 'ph-bank', name: 'Accounts', detail: `${accounts.length}` },
    {
      path: '/transactions',
      icon: 'ph-list-bullets',
      name: 'All transactions',
      detail: `${transactions.length}`,
    },
    {
      path: '/goals',
      icon: 'ph-flag-banner',
      name: 'Savings goals',
      detail: goals.length ? `${goals.length} active` : 'none',
    },
    { path: '/bills', icon: 'ph-receipt', name: 'Bills', detail: `${bills.length}` },
    { path: '/categories', icon: 'ph-tag', name: 'Categories', detail: `${categories.length}` },
    {
      path: '/currency',
      icon: 'ph-currency-circle-dollar',
      name: 'Currency',
      detail: settings.baseCurrency,
    },
    { path: '/settings', icon: 'ph-gear-six', name: 'Settings', detail: '' },
  ];

  return (
    <div className="rise" style={{ paddingTop: 4, display: 'flex', flexDirection: 'column' }}>
      {items.map((item) => (
        <button
          key={item.path}
          type="button"
          onClick={() => history.push(item.path)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 13,
            padding: '16px 2px',
            background: 'transparent',
            border: 0,
            borderBottom: '1px solid var(--color-neutral-900)',
            color: 'var(--color-text)',
            font: '400 15px var(--font-body)',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <span style={{ color: 'var(--color-neutral-500)', fontSize: 18 }}>
            <i className={`ph ${item.icon}`} />
          </span>
          <span style={{ flex: 1 }}>{item.name}</span>
          <span style={{ color: 'var(--color-neutral-600)', font: '400 14px var(--font-body)' }}>
            {item.detail}
          </span>
          <span style={{ color: 'var(--color-neutral-700)', fontSize: 14 }}>
            <i className="ph ph-caret-right" />
          </span>
        </button>
      ))}
    </div>
  );
}
