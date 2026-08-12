/**
 * External service registry and the master kill switch.
 *
 * The app is offline-first: every screen reads from SQLite and never blocks on
 * the network. These definitions describe services the app *may* call once they
 * are turned on — today all of them are closed.
 *
 * Endpoints are resolvable at runtime: a user can point a service at their own
 * host from the Settings screen, and that override is stored in the database.
 * The built-in values below are only defaults.
 */

import * as settings from '../repositories/settings';
import type { ApiKeyMode, ServiceOverride } from '../repositories/settings';

export type ServiceId = 'sync' | 'rates' | 'bank-import' | 'backup';

export interface ServiceDefinition {
  id: ServiceId;
  label: string;
  /** Base URL, without a trailing slash. */
  baseUrl: string;
  /** Per-service gate. Closed for every service right now. */
  enabled: boolean;
  /** Whether failed calls are queued in the outbox for a later retry. */
  queueable: boolean;
  timeoutMs: number;
  /** Whether the Settings screen lets the user edit this service's endpoint. */
  userConfigurable: boolean;
  apiKey?: string;
  apiKeyMode?: ApiKeyMode;
  apiKeyName?: string;
}

export const SERVICE_DEFAULTS: Record<ServiceId, ServiceDefinition> = {
  sync: {
    id: 'sync',
    label: 'Cloud sync',
    baseUrl: 'https://api.example.invalid/ledger/v1',
    enabled: false,
    queueable: true,
    timeoutMs: 15_000,
    userConfigurable: true,
  },
  rates: {
    id: 'rates',
    label: 'Exchange rates',
    // Keyless public provider, so opening the gate works without setup. The
    // user can replace this with any provider from Settings.
    baseUrl: 'https://open.er-api.com/v6',
    enabled: false,
    // Rates are a fresh-or-nothing read; a stale queued request is worthless.
    queueable: false,
    timeoutMs: 10_000,
    userConfigurable: true,
    apiKeyMode: 'none',
  },
  'bank-import': {
    id: 'bank-import',
    label: 'Bank import',
    baseUrl: 'https://api.example.invalid/banking/v1',
    enabled: false,
    queueable: true,
    timeoutMs: 30_000,
    userConfigurable: true,
  },
  backup: {
    id: 'backup',
    label: 'Encrypted backup',
    baseUrl: 'https://api.example.invalid/backup/v1',
    enabled: false,
    queueable: true,
    timeoutMs: 60_000,
    userConfigurable: true,
  },
};

export const SERVICE_IDS = Object.keys(SERVICE_DEFAULTS) as ServiceId[];

/**
 * Build-time master gate. Defaults to closed — an unset env var must never open
 * traffic, so only the exact string "true" counts.
 *
 * This is deliberately *not* user-editable. Whatever a user turns on in
 * Settings, no request leaves the device while this is false.
 */
export const SERVICES_ENABLED = import.meta.env.VITE_SERVICES_ENABLED === 'true';

function applyOverride(base: ServiceDefinition, override: ServiceOverride): ServiceDefinition {
  const trimmed = override.baseUrl?.trim().replace(/\/+$/, '');
  return {
    ...base,
    baseUrl: trimmed || base.baseUrl,
    enabled: override.enabled ?? base.enabled,
    apiKey: override.apiKey?.trim() || base.apiKey,
    apiKeyMode: override.apiKeyMode ?? base.apiKeyMode,
    apiKeyName: override.apiKeyName?.trim() || base.apiKeyName,
  };
}

/** The effective definition for a service: built-in defaults plus user overrides. */
export async function resolveService(id: ServiceId): Promise<ServiceDefinition> {
  const overrides = await settings.get('services');
  const override = overrides[id];
  return override ? applyOverride(SERVICE_DEFAULTS[id], override) : SERVICE_DEFAULTS[id];
}

/** Every service's effective definition, for the Settings screen. */
export async function resolveAllServices(): Promise<ServiceDefinition[]> {
  const overrides = await settings.get('services');
  return SERVICE_IDS.map((id) => {
    const override = overrides[id];
    return override ? applyOverride(SERVICE_DEFAULTS[id], override) : SERVICE_DEFAULTS[id];
  });
}

export async function isServiceOpen(id: ServiceId): Promise<boolean> {
  if (!SERVICES_ENABLED) return false;
  return (await resolveService(id)).enabled;
}

/** Human-readable reason a service is closed, or null when it is open. */
export async function closedReason(id: ServiceId): Promise<string | null> {
  const service = await resolveService(id);
  if (!SERVICES_ENABLED) return 'All external services are disabled in this build.';
  if (!service.enabled) return `Service "${service.label}" is turned off in Settings.`;
  if (!service.baseUrl) return `Service "${service.label}" has no endpoint configured.`;
  return null;
}
