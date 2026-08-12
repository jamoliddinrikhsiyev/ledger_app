/**
 * The single outbound network path in the app.
 *
 * Nothing else may call `fetch` directly. Every request passes the service gate
 * first, so with services closed the app provably makes no external calls.
 */

import { closedReason, resolveService, type ServiceDefinition, type ServiceId } from './config';

export type ServiceErrorCode = 'disabled' | 'offline' | 'timeout' | 'http' | 'network';

export class ServiceError extends Error {
  readonly code: ServiceErrorCode;
  /** True when retrying later could plausibly succeed. */
  readonly retryable: boolean;
  readonly status?: number;

  constructor(code: ServiceErrorCode, message: string, retryable: boolean, status?: number) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
    this.retryable = retryable;
    this.status = status;
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Serialised as JSON. Omit for GET. */
  body?: unknown;
  headers?: Record<string, string>;
  /** Appended to the query string. Undefined values are dropped. */
  searchParams?: Record<string, string | number | undefined>;
  signal?: AbortSignal;
}

/** Best-effort connectivity hint. Unreliable by design — treat as advisory. */
export function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

/**
 * Builds the full URL and auth headers for a call, honouring the user's
 * configured API-key placement.
 */
function buildRequest(
  service: ServiceDefinition,
  endpoint: string,
  options: RequestOptions,
): { url: string; headers: Record<string, string> } {
  const url = new URL(`${service.baseUrl}${endpoint}`);

  for (const [key, value] of Object.entries(options.searchParams ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
    ...options.headers,
  };

  const key = service.apiKey;
  if (key) {
    switch (service.apiKeyMode) {
      case 'bearer':
        headers.Authorization = `Bearer ${key}`;
        break;
      case 'header':
        headers[service.apiKeyName || 'X-API-Key'] = key;
        break;
      case 'query':
        url.searchParams.set(service.apiKeyName || 'apikey', key);
        break;
      default:
        // 'none' or unset: the endpoint needs no credential.
        break;
    }
  }

  return { url: url.toString(), headers };
}

/**
 * Calls `endpoint` on a service. Throws `ServiceError('disabled')` immediately
 * when the service is closed — the request is never constructed.
 */
export async function request<T>(
  serviceId: ServiceId,
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const reason = await closedReason(serviceId);
  if (reason) throw new ServiceError('disabled', reason, false);

  if (!isOnline()) {
    throw new ServiceError('offline', 'Device is offline.', true);
  }

  const service = await resolveService(serviceId);
  const { method = 'GET', body, signal } = options;
  const { url, headers } = buildRequest(service, endpoint, options);

  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), service.timeoutMs);
  // Honour a caller-supplied signal alongside our own timeout.
  const onAbort = () => timeout.abort();
  signal?.addEventListener('abort', onAbort);

  try {
    const response = await fetch(url, {
      method,
      signal: timeout.signal,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!response.ok) {
      // 4xx is our bug or bad input; only 5xx and 429 are worth retrying.
      const retryable = response.status >= 500 || response.status === 429;
      throw new ServiceError(
        'http',
        `${service.label} responded ${response.status}`,
        retryable,
        response.status,
      );
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ServiceError('timeout', `${service.label} timed out.`, true);
    }
    throw new ServiceError(
      'network',
      error instanceof Error ? error.message : 'Network request failed.',
      true,
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}
