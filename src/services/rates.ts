/**
 * Exchange-rate refresh.
 *
 * The provider is whatever the user configured in Settings — endpoint, path
 * template and API key all live in the database. The response parser is
 * deliberately tolerant so common providers work without a code change.
 *
 * This service is closed. Every entry point below returns a `skipped` result
 * instead of touching the network until both gates in `services/config` open.
 * Conversion itself never calls this: it reads the cached rates in
 * `repositories/rates`, which is why the app converts fine offline.
 */

import { buildRatesPath, extractBase, extractRates } from '../lib/rate-parsing';
import * as ratesRepo from '../repositories/rates';
import * as settings from '../repositories/settings';
import { closedReason, resolveService } from './config';
import { ServiceError, request } from './http';

export type RefreshStatus = 'updated' | 'fresh' | 'skipped' | 'failed';

export interface RefreshResult {
  status: RefreshStatus;
  /** Number of rates written. Zero unless status is 'updated'. */
  count: number;
  base: string;
  /** Why the refresh did not happen, for display in Settings. */
  reason?: string;
  fetchedAt?: number;
}

/**
 * Fetches rates for `base` and replaces the cache.
 *
 * `force` skips the freshness check but not the service gate — nothing can make
 * this call out while the service is closed.
 */
export async function refresh(
  options: { base?: string; force?: boolean } = {},
): Promise<RefreshResult> {
  const config = await settings.all();
  const base = (options.base ?? config.baseCurrency).toUpperCase();

  const reason = await closedReason('rates');
  if (reason) return { status: 'skipped', count: 0, base, reason };

  if (!options.force && config.ratesMaxAgeHours > 0) {
    const age = await ratesRepo.ageHours();
    if (age !== null && age < config.ratesMaxAgeHours) {
      return { status: 'fresh', count: 0, base };
    }
  }

  const service = await resolveService('rates');
  const path = buildRatesPath(config.ratesPathTemplate, base);

  try {
    const payload = await request<unknown>('rates', path);
    const rates = extractRates(payload);

    if (!rates) {
      return {
        status: 'failed',
        count: 0,
        base,
        reason: 'Response did not contain a recognisable rates map.',
      };
    }

    // Trust the provider's own base over ours — a misconfigured path template
    // can silently return rates against a different currency.
    const effectiveBase = extractBase(payload) ?? base;
    const fetchedAt = Date.now();
    const count = await ratesRepo.replaceForBase(
      effectiveBase,
      rates,
      service.baseUrl,
      fetchedAt,
    );

    return { status: 'updated', count, base: effectiveBase, fetchedAt };
  } catch (error) {
    return {
      status: 'failed',
      count: 0,
      base,
      reason: error instanceof ServiceError ? error.message : String(error),
    };
  }
}

/**
 * Refreshes if the cache is stale. Safe to call on app resume — with the
 * service closed it returns immediately without a request.
 */
export async function refreshIfStale(): Promise<RefreshResult> {
  return refresh({ force: false });
}

/** One-shot connectivity check for the Settings screen's "Test" button. */
export async function testProvider(base: string): Promise<RefreshResult> {
  return refresh({ base, force: true });
}
