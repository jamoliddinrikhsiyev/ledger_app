/** Date helpers shared by the screens. All arithmetic is in local time. */

const DAY_MS = 86_400_000;

export function startOfDay(at: number): number {
  const d = new Date(at);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function startOfMonth(at: number): number {
  const d = new Date(at);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

/** Whole days from `at` to the end of its month, including today. */
export function daysLeftInMonth(at = Date.now()): number {
  const d = new Date(at);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return lastDay - d.getDate() + 1;
}

/** "Today", "Yesterday", else "Mon 9 Aug" — the design's day headings. */
export function formatDayHeading(day: number, now = Date.now()): string {
  const today = startOfDay(now);
  if (day === today) return 'Today';
  if (day === today - DAY_MS) return 'Yesterday';

  const date = new Date(day);
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** "Due Fri 14 Aug", or "Due today" / "Due tomorrow" when it is imminent. */
export function formatDueDate(dueAt: number, now = Date.now()): string {
  const days = Math.round((startOfDay(dueAt) - startOfDay(now)) / DAY_MS);
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';

  return `Due ${new Date(dueAt).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })}`;
}

/** Short month label for the insights bar chart. */
export function formatMonthShort(at: number): string {
  return new Date(at).toLocaleDateString(undefined, { month: 'short' });
}

/** "on pace for Mar 2027", the projected finish for a savings goal. */
export function formatEta(months: number | null, now = Date.now()): string {
  if (months === null) return 'goal reached';
  const d = new Date(now);
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  return `on pace for ${target.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`;
}
