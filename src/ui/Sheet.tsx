/**
 * Bottom sheet: dimmed backdrop, panel rising from the bottom edge.
 *
 * The backdrop above the panel is the dismiss target, matching the design —
 * tapping the panel itself must not close it.
 */

import type { ReactNode } from 'react';
import { IconButton } from './primitives';

export function Sheet({
  open,
  title,
  subtitle,
  onClose,
  children,
}: {
  open: boolean;
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 30,
        background: 'rgba(14,15,24,.66)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
    >
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onClose}
        style={{ flex: 1, background: 'transparent', border: 0, cursor: 'default' }}
      />
      <div
        className="rise"
        style={{
          background: 'var(--color-surface)',
          borderTop: '1px solid var(--color-neutral-700)',
          borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          boxShadow: '0 -16px 40px rgba(0,0,0,.65)',
          // Sheets can hold a keyboard-driven form; cap the height so a long
          // one scrolls instead of pushing its action button off-screen.
          maxHeight: '82%',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ font: '500 18px var(--font-heading)' }}>{title}</div>
            {subtitle && (
              <div style={{ font: '400 12px var(--font-body)', color: 'var(--color-neutral-600)' }}>
                {subtitle}
              </div>
            )}
          </div>
          <IconButton icon="ph-x" onClick={onClose} label="Close" />
        </div>
        {children}
      </div>
    </div>
  );
}
