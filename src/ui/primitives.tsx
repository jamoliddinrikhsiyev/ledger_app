/**
 * Nocturne primitives.
 *
 * Every value here traces back to a token in `theme/variables.css`; nothing
 * hard-codes a hex. Screens compose these rather than restyling from scratch,
 * so a change to the system lands everywhere at once.
 */

import type { CSSProperties, ReactNode } from 'react';

/* — icons — */

/** Rounded tile holding a Phosphor glyph, the design's recurring row marker. */
export function IconBadge({
  icon,
  size = 34,
  color = 'var(--color-accent-400)',
  background = 'var(--color-surface)',
}: {
  icon: string;
  size?: number;
  color?: string;
  background?: string;
}) {
  return (
    <span
      style={{
        width: size,
        height: size,
        flex: 'none',
        borderRadius: 'var(--radius-md)',
        background,
        color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.round(size * 0.47),
      }}
    >
      <i className={`ph ${icon}`} />
    </span>
  );
}

/* — text — */

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        font: '400 12px/1 var(--font-body)',
        color: 'var(--color-neutral-600)',
        letterSpacing: '.06em',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </div>
  );
}

export function SectionHeading({ title, action }: { title: ReactNode; action?: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        margin: '26px 0 10px',
      }}
    >
      <div style={{ font: '500 16px var(--font-heading)' }}>{title}</div>
      {action}
    </div>
  );
}

/** Freestanding rule that fades at both ends — a Nocturne signature. */
export function Rule({ margin = '20px 0' }: { margin?: string }) {
  return <div className="rule" style={{ margin }} />;
}

export function Muted({ children, size = 12 }: { children: ReactNode; size?: number }) {
  return (
    <span style={{ font: `400 ${size}px var(--font-body)`, color: 'var(--color-neutral-600)' }}>
      {children}
    </span>
  );
}

/* — buttons — */

export function PrimaryButton({
  children,
  onClick,
  disabled,
  height = 50,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  height?: number;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        height,
        borderRadius: 'var(--radius-md)',
        background: 'transparent',
        border: '1px solid var(--color-accent)',
        color: 'var(--color-accent-300)',
        font: '500 15px var(--font-heading)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        // The design dims rather than greys out, keeping the button readable.
        opacity: disabled ? 0.45 : 1,
        width: '100%',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function TextButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'transparent',
        border: 0,
        color: 'var(--color-accent)',
        font: '400 13px var(--font-body)',
        cursor: 'pointer',
        padding: 0,
      }}
    >
      {children}
    </button>
  );
}

/** Square outlined control used for header actions and row affordances. */
export function IconButton({
  icon,
  onClick,
  size = 30,
  label,
}: {
  icon: string;
  onClick?: () => void;
  size?: number;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        width: size,
        height: size,
        flex: 'none',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-neutral-800)',
        background: 'transparent',
        color: 'var(--color-neutral-400)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        fontSize: Math.round(size * 0.5),
      }}
    >
      <i className={`ph ${icon}`} />
    </button>
  );
}

/* — chips — */

export function Chip({
  label,
  icon,
  active,
  onClick,
}: {
  label: ReactNode;
  icon?: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: icon ? '8px 12px' : '7px 13px',
        borderRadius: 999,
        border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-neutral-800)'}`,
        background: active ? 'color-mix(in srgb, var(--color-accent) 14%, transparent)' : 'transparent',
        color: active ? 'var(--color-accent-300)' : 'var(--color-neutral-500)',
        font: '400 13px var(--font-body)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {icon && <i className={`ph ${icon}`} />}
      {label}
    </button>
  );
}

/** Horizontally scrolling chip strip. */
export function ChipRow({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 14 }}>{children}</div>
  );
}

/* — meters — */

export function ProgressBar({
  ratio,
  height = 5,
  fill = 'var(--color-accent)',
}: {
  /** 0..1; values outside are clamped. */
  ratio: number;
  height?: number;
  fill?: string;
}) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <div
      style={{
        height,
        borderRadius: 3,
        background: 'var(--color-neutral-900)',
        overflow: 'hidden',
      }}
    >
      <div style={{ height: '100%', width: `${pct}%`, background: fill }} />
    </div>
  );
}

/** Conic-gradient ring with a value in the middle, used by savings goals. */
export function ProgressRing({
  ratio,
  size = 62,
  children,
}: {
  ratio: number;
  size?: number;
  children: ReactNode;
}) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  const inner = Math.round(size * 0.77);
  return (
    <div
      style={{
        width: size,
        height: size,
        flex: 'none',
        borderRadius: '50%',
        background: `conic-gradient(var(--color-accent) 0 ${pct}%, var(--color-neutral-900) ${pct}% 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: inner,
          height: inner,
          borderRadius: '50%',
          background: 'var(--color-bg)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          font: '500 13px var(--font-heading)',
          color: 'var(--color-accent-300)',
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* — rows and containers — */

/** Bordered panel, the design's "outlined card". */
export function Panel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        border: '1px solid var(--color-neutral-800)',
        borderRadius: 'var(--radius-md)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Filled panel on the surface colour, used for list items that are tappable. */
export function SurfaceRow({
  children,
  onClick,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  style?: CSSProperties;
}) {
  const shared: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 14px',
    borderRadius: 'var(--radius-md)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    textAlign: 'left',
    width: '100%',
    ...style,
  };

  if (!onClick) return <div style={shared}>{children}</div>;
  return (
    <button type="button" onClick={onClick} style={{ ...shared, border: 0, cursor: 'pointer' }}>
      {children}
    </button>
  );
}

/**
 * The transaction/category row: icon, stacked name + subtitle, trailing value.
 * Separated by a hairline rather than a fading rule, since it repeats.
 */
export function ListRow({
  icon,
  iconColor,
  title,
  subtitle,
  value,
  valueColor = 'var(--color-text)',
  trailing,
  onClick,
}: {
  icon?: string;
  iconColor?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  value?: ReactNode;
  valueColor?: string;
  trailing?: ReactNode;
  onClick?: () => void;
}) {
  const content = (
    <>
      {icon && <IconBadge icon={icon} color={iconColor} />}
      <span style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span
          style={{
            font: '400 14px var(--font-body)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </span>
        {subtitle && (
          <span
            style={{
              font: '400 12px var(--font-body)',
              color: 'var(--color-neutral-600)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {subtitle}
          </span>
        )}
      </span>
      {value !== undefined && (
        <span style={{ font: '500 14px var(--font-heading)', color: valueColor, flex: 'none' }}>
          {value}
        </span>
      )}
      {trailing}
    </>
  );

  const shared: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '11px 0',
    borderBottom: '1px solid var(--color-neutral-900)',
    width: '100%',
    textAlign: 'left',
    color: 'var(--color-text)',
  };

  if (!onClick) return <div style={shared}>{content}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ ...shared, background: 'transparent', border: 0, borderBottom: shared.borderBottom, cursor: 'pointer' }}
    >
      {content}
    </button>
  );
}

/** Shown where a list would otherwise be empty, so a screen is never blank. */
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: string;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        padding: '48px 20px',
        textAlign: 'center',
      }}
    >
      <span style={{ color: 'var(--color-neutral-700)', fontSize: 30 }}>
        <i className={`ph ${icon}`} />
      </span>
      <div style={{ font: '500 17px var(--font-heading)' }}>{title}</div>
      {body && (
        <div
          style={{
            font: '400 13px/1.55 var(--font-body)',
            color: 'var(--color-neutral-600)',
            maxWidth: 260,
            textWrap: 'pretty',
          }}
        >
          {body}
        </div>
      )}
      {action && <div style={{ marginTop: 6, width: '100%' }}>{action}</div>}
    </div>
  );
}

/** Text field styled to the design's sheet inputs. */
export function TextField({
  value,
  onChange,
  placeholder,
  inputMode,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: 'text' | 'numeric' | 'decimal';
  label?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      {label && <Muted>{label}</Muted>}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        style={{
          width: '100%',
          minWidth: 0,
          height: 46,
          padding: '0 13px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--color-bg)',
          border: '1px solid var(--color-neutral-800)',
          color: 'var(--color-text)',
          font: '400 15px var(--font-body)',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}
