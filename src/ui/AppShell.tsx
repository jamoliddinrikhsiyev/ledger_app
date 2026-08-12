/**
 * The app chrome: fixed header, scrolling content, tab bar, toast.
 *
 * The design was drawn inside a 402×874 phone frame with hard-coded 56px of
 * status-bar padding. Here that becomes `env(safe-area-inset-*)` with the
 * design's value as the fallback, so the layout holds on a notched device, a
 * flat one, and a desktop browser alike.
 */

import type { ReactNode } from 'react';
import { useHistory, useLocation } from 'react-router-dom';

import { useLedger } from '../state/LedgerContext';
import { IconButton } from './primitives';

interface TabDef {
  path: string;
  icon: string;
  label: string;
}

const TABS: TabDef[] = [
  { path: '/', icon: 'ph-house', label: 'Home' },
  { path: '/insights', icon: 'ph-chart-donut', label: 'Insights' },
  { path: '/add', icon: 'ph-plus', label: 'Add' },
  { path: '/budgets', icon: 'ph-target', label: 'Budgets' },
  { path: '/more', icon: 'ph-dots-three-outline', label: 'More' },
];

const TITLES: Record<string, string> = {
  '/': 'Ledger',
  '/transactions': 'Transactions',
  '/insights': 'Insights',
  '/budgets': 'Budgets',
  '/accounts': 'Accounts',
  '/goals': 'Savings goals',
  '/categories': 'Categories',
  '/currency': 'Currency',
  '/bills': 'Bills',
  '/more': 'More',
  '/settings': 'Settings',
};

/** Screens reached from a menu rather than the tab bar get a back arrow. */
const BACK_FROM = new Set([
  '/transactions',
  '/accounts',
  '/goals',
  '/categories',
  '/currency',
  '/bills',
  '/settings',
]);

function TabBar({ onAdd, addOpen }: { onAdd: () => void; addOpen: boolean }) {
  const history = useHistory();
  const { pathname } = useLocation();

  return (
    <nav
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingTop: 8,
        paddingLeft: 12,
        paddingRight: 12,
        paddingBottom: 'max(26px, env(safe-area-inset-bottom))',
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        alignItems: 'center',
        background: 'color-mix(in srgb, var(--color-bg) 92%, transparent)',
        backdropFilter: 'blur(14px)',
        borderTop: '1px solid var(--color-neutral-900)',
        zIndex: 6,
      }}
    >
      {TABS.map((tab) => {
        const isAdd = tab.path === '/add';
        const active = isAdd ? addOpen : pathname === tab.path;
        return (
          <button
            key={tab.path}
            type="button"
            onClick={() => (isAdd ? onAdd() : history.push(tab.path))}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              background: 'transparent',
              border: 0,
              color: active ? 'var(--color-accent-300)' : 'var(--color-neutral-600)',
              cursor: 'pointer',
              padding: '6px 0',
            }}
          >
            <span
              style={{
                fontSize: isAdd ? 20 : 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: isAdd ? 38 : 30,
                height: isAdd ? 38 : 30,
                borderRadius: 999,
                border: `1px solid ${isAdd ? 'var(--color-accent)' : 'transparent'}`,
              }}
            >
              <i className={`ph ${tab.icon}`} />
            </span>
            <span style={{ font: '400 10px var(--font-body)' }}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function Toast({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div
      className="rise"
      role="status"
      style={{
        position: 'absolute',
        left: 20,
        right: 20,
        bottom: 98,
        zIndex: 40,
        padding: '13px 15px',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-accent-900)',
        border: '1px solid var(--color-accent-700)',
        color: 'var(--color-accent-200)',
        font: '400 13px var(--font-body)',
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        boxShadow: '0 16px 40px rgba(0,0,0,.65)',
      }}
    >
      <i className="ph-fill ph-check-circle" />
      <span>{message}</span>
    </div>
  );
}

export function AppShell({
  children,
  onAdd,
  addOpen,
}: {
  children: ReactNode;
  onAdd: () => void;
  addOpen: boolean;
}) {
  const history = useHistory();
  const { pathname } = useLocation();
  const { toast } = useLedger();

  const title = TITLES[pathname] ?? 'Ledger';
  const showBack = BACK_FROM.has(pathname);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: 'var(--color-bg)' }}>
      <header
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          paddingTop: 'max(56px, calc(env(safe-area-inset-top) + 20px))',
          paddingLeft: 20,
          paddingRight: 20,
          paddingBottom: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          // Fades into the content rather than sitting on a hard edge, so rows
          // scrolling underneath dissolve instead of being clipped.
          background: 'linear-gradient(var(--color-bg) 70%, transparent)',
          zIndex: 5,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {showBack && (
            <IconButton icon="ph-arrow-left" label="Back" onClick={() => history.push('/')} />
          )}
          <div
            style={{
              font: '500 19px var(--font-heading)',
              letterSpacing: '-.01em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </div>
        </div>
        <IconButton icon="ph-gear-six" label="Settings" onClick={() => history.push('/settings')} />
      </header>

      <main
        style={{
          position: 'absolute',
          top: 'var(--chrome-top)',
          bottom: 'var(--chrome-bottom)',
          left: 0,
          right: 0,
          overflowY: 'auto',
          padding: '0 20px 28px',
        }}
      >
        {children}
      </main>

      <TabBar onAdd={onAdd} addOpen={addOpen} />
      <Toast message={toast} />
    </div>
  );
}
