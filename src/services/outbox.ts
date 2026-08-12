/**
 * Durable queue for outbound requests.
 *
 * The app never blocks the UI on a service call. Work that must eventually
 * reach a server is enqueued here and survives restarts in SQLite. With every
 * service closed the queue simply accumulates — `drain` is a no-op until a gate
 * opens, so nothing leaves the device.
 */

import { query, run } from '../db/sqlite';
import { newId } from '../lib/id';
import { isServiceOpen, type ServiceId } from './config';
import { ServiceError, isOnline, request } from './http';

export interface OutboxEntry {
  id: string;
  service: ServiceId;
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  payload: string | null;
  attempts: number;
  lastError: string | null;
  createdAt: number;
  nextAttempt: number;
}

const MAX_ATTEMPTS = 8;
const BASE_BACKOFF_MS = 30_000;

/** Exponential backoff, capped at ~4 hours so a stuck entry still retries. */
function backoffFor(attempts: number): number {
  return Math.min(BASE_BACKOFF_MS * 2 ** attempts, 4 * 60 * 60 * 1000);
}

export async function enqueue(
  service: ServiceId,
  endpoint: string,
  method: OutboxEntry['method'],
  payload?: unknown,
): Promise<string> {
  const id = newId();
  await run(
    `INSERT INTO outbox (id, service, endpoint, method, payload, attempts, createdAt, nextAttempt)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
    [
      id,
      service,
      endpoint,
      method,
      payload === undefined ? null : JSON.stringify(payload),
      Date.now(),
      Date.now(),
    ],
  );
  return id;
}

export async function pending(): Promise<OutboxEntry[]> {
  return query<OutboxEntry>('SELECT * FROM outbox ORDER BY createdAt ASC');
}

export async function pendingCount(): Promise<number> {
  const rows = await query<{ n: number }>('SELECT COUNT(*) AS n FROM outbox');
  return rows[0]?.n ?? 0;
}

export async function remove(id: string): Promise<void> {
  await run('DELETE FROM outbox WHERE id = ?', [id]);
}

export async function clear(): Promise<void> {
  await run('DELETE FROM outbox');
}

export interface DrainResult {
  sent: number;
  failed: number;
  /** Entries skipped because their service is closed or backoff has not elapsed. */
  skipped: number;
}

/**
 * Attempts every due entry once. Safe to call on app resume or on a timer —
 * with services closed every entry is skipped and no request is made.
 */
export async function drain(): Promise<DrainResult> {
  const result: DrainResult = { sent: 0, failed: 0, skipped: 0 };
  if (!isOnline()) return result;

  const now = Date.now();
  const entries = await pending();

  for (const entry of entries) {
    if (entry.nextAttempt > now || !(await isServiceOpen(entry.service))) {
      result.skipped += 1;
      continue;
    }

    try {
      await request(entry.service, entry.endpoint, {
        method: entry.method,
        body: entry.payload === null ? undefined : JSON.parse(entry.payload),
      });
      await remove(entry.id);
      result.sent += 1;
    } catch (error) {
      const attempts = entry.attempts + 1;
      const permanent =
        (error instanceof ServiceError && !error.retryable) || attempts >= MAX_ATTEMPTS;

      if (permanent) {
        // Dropping beats retrying forever; the local record is unaffected.
        await remove(entry.id);
      } else {
        await run('UPDATE outbox SET attempts = ?, lastError = ?, nextAttempt = ? WHERE id = ?', [
          attempts,
          error instanceof Error ? error.message : String(error),
          now + backoffFor(attempts),
          entry.id,
        ]);
      }
      result.failed += 1;
    }
  }

  return result;
}
