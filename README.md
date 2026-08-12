# Ledger

Offline-first personal finance app. Ionic React + Capacitor, TypeScript, Vite.

All data lives on the device in SQLite. The app is fully usable with no network
connection at any point — there is no login, no server dependency, and no
blocking request on any screen.

## Status

| Layer | State |
| --- | --- |
| Domain model | done |
| SQLite schema + migrations | done, SQL verified |
| Repositories (accounts, transactions, categories, budgets, rates, settings) | done |
| Base currency + FX conversion | done, cached rates, works offline |
| Service layer + kill switch + offline outbox | done, all services closed |
| UI — 11 screens, tab bar, add overlay, sheets | done, built to the Nocturne design |
| Native builds | iOS blocked upstream; Android via CI (see below) |

## The design

The interface is a port of the Nocturne "Ledger" design, read from its Claude
Design project. `src/theme/variables.css` holds Nocturne's own tokens
(`--color-*`, `--space-*`, `--radius-*`) as the source of truth and maps them
onto Ionic's variables; `src/ui/primitives.tsx` builds the system's components
from those tokens. No screen hard-codes a colour.

Two deliberate departures from the design, both forced by what this app is:

- **Onboarding does not connect a bank.** The original flow was built around
  bank sync. Every service here is closed and the data is local, so the same
  four beats set up a first account and a monthly spending plan instead.
- **Accounts are entered by hand**, and the Accounts screen says so rather than
  showing a "synced 12 minutes ago" line it cannot honour.

Icons are Phosphor and the typeface is Inter, both bundled rather than pulled
from a CDN — the app has to render identically with no connection.

## Running

```sh
npm install
npm run dev            # browser, SQLite via jeep-sqlite (wasm + IndexedDB)
npm run verify         # typecheck + both verification scripts
npm run verify:sql     # schema and aggregates against node:sqlite
npm run verify:rates   # rate-response parser against real provider payloads
npm run drive          # boots the app in a real browser and exercises it
```

`npm run drive` needs the dev server up. It walks onboarding, logs a transaction
through the keypad, creates a budget and a savings goal, visits every screen,
and reloads to prove persistence — capturing a screenshot of each into
`.screenshots/`. It fails if the page logged an error **or made any request
off-origin**; that last check is what keeps "no external calls" honest.

### The sql.js version is pinned on purpose

jeep-sqlite compiles the sql.js JS glue into its own bundle, but the matching
`sql-wasm.wasm` is fetched at runtime from `/assets/`. The two must be the same
version. `sql.js` is therefore pinned exactly in devDependencies, and
`scripts/copy-wasm.mjs` copies it on `postinstall` and warns if it drifts.

A mismatch shows up in the browser as `LinkError: function import requires a
callable` — which points nowhere near the real cause.

## Building

### Web / PWA — works

```sh
npm run build      # tsc -b && vite build  →  dist/
npm run preview    # serve dist/ locally
```

`dist/` is a static bundle: any file server will do. `postinstall` puts
`sql-wasm.wasm` in `public/assets/`, and the build copies it through — check it
landed in `dist/assets/` if the database fails to open in production.

### Native — projects generate, compile is blocked

Both platforms are added and `npx cap sync` copies the web build into them:

```sh
npm run sync       # build + cap sync (both platforms)
npm run ios        # sync + open Xcode
npm run android    # sync + open Android Studio
```

### Android APK in the cloud — no local SDK needed

`.github/workflows/android.yml` builds an installable debug APK on a GitHub
runner, which already has the JDK and Android SDK. Push the workflow, then run
it from the repo's **Actions → Android APK → Run workflow**. The APK lands in
the run's artifacts as `ledger-debug-apk`.

It regenerates `android/` with `cap add` because that directory is gitignored
while nothing native is customised. Once you commit `android/` (see
`.gitignore`), that step turns into a no-op and your native changes are kept.

Debug APKs are signed with the auto-generated debug key — installable on a
phone with USB debugging or by sideloading, but not distributable. A Play Store
build needs `assembleRelease` plus a real keystore in repository secrets.

### Local native builds

Neither compiles on this machine yet:

| Platform | State | Needed |
| --- | --- | --- |
| iOS | project generates, SPM resolves all 6 plugins, everything compiles **except** `CapacitorSQLitePlugin` | see below |
| Android | project generates | JDK 17+ and the Android SDK — neither is installed |

**The iOS blocker is upstream, not ours.** `@capacitor-community/sqlite`
declares its SPM dependency as `ZIPFoundation from: "0.9.0"`, which resolves to
0.9.20 — a package still on `swift-tools-version:5.0` with `.iOS(.v9)`. Under
the Xcode 26 toolchain that target never produces a `.swiftmodule`, so the
plugin fails with:

```
UtilsDownloadFromHTTP.swift:9:8: error: Unable to find module dependency: 'ZIPFoundation'
```

ZIPFoundation is only used by the plugin's "download a zipped database over
HTTP" helper, which this app never calls — but it cannot be excluded from an SPM
target.

The fix when native builds are picked up: regenerate the iOS project with
CocoaPods instead of SPM. The plugin's podspec sets `swift_version = '5.1'` and
`ios.deployment_target = '15.0'` explicitly and pulls ZIPFoundation from trunk,
which sidesteps the SPM manifest entirely.

```sh
brew install cocoapods
rm -rf ios && npx cap add ios      # CocoaPods is the default package manager
```

Deferred deliberately: the UI is still a dev harness, so there is nothing to
ship natively yet.

## Architecture

### Storage

`src/db/` owns the database. The same SQL runs everywhere: native uses the
platform SQLite through `@capacitor-community/sqlite`, the browser uses that
plugin backed by `jeep-sqlite` (sql.js compiled to wasm, persisted to
IndexedDB). No code branches on platform outside `src/db/sqlite.ts`.

Migrations in `src/db/schema.ts` are forward-only and keyed to `user_version`.
**Append new migrations; never edit an existing one** — devices in the field
have already run it.

`src/repositories/` is the only thing that touches SQL. Pages call repositories.

Money is stored as integer minor units (cents) throughout; it becomes a decimal
only in `formatMoney`. Account balances are *derived* from transactions on every
read rather than cached on the row, so an edited or deleted transaction can
never leave a stale balance behind.

### Currency

Each account and transaction carries its own currency; nothing is rewritten when
the user changes their mind. `settings.baseCurrency` is only the *reporting*
unit — the currency dashboard totals and net worth are expressed in. Changing it
via `settings.setBaseCurrency()` is always safe and reversible.

Cached FX rates live in `exchange_rates` and drive `repositories/rates`:

- `getRate` tries the direct pair, then the inverse, then triangulates through
  any base quoting both sides — so a USD-only cache still answers EUR→UZS.
- `convert` accounts for differing minor-unit exponents (UZS and JPY are not
  1/100 currencies).
- `accounts.netWorth` sums every account into the base currency and returns a
  `missing` list of currencies no cached rate could reach, so the UI can flag an
  incomplete total instead of quietly under-reporting.

**Conversion never makes a network call.** It reads the cache, which is why the
app converts fine with no connection; rates simply go stale, and `ageHours()`
tells the UI how stale.

### Exchange-rate provider

The provider is user-configurable from Settings, stored in the database, no
rebuild needed:

| Setting | Meaning |
| --- | --- |
| `services.rates.baseUrl` | Provider host, e.g. `https://open.er-api.com/v6` |
| `ratesPathTemplate` | Path appended to it; `{base}` is substituted |
| `services.rates.apiKey` | Credential, if the provider needs one |
| `services.rates.apiKeyMode` | `none` \| `bearer` \| `header` \| `query` |
| `services.rates.apiKeyName` | Header or query-param name for the key |
| `ratesMaxAgeHours` | Refresh threshold; `0` disables auto-refresh |

`extractRates` parses the response shape rather than requiring one. Verified
against open.er-api.com, exchangerate-api.com, exchangerate.host / fixer,
currencyapi.com and currencylayer — see `npm run verify:rates`.

The default is `https://open.er-api.com/v6` with `/latest/{base}`: keyless, so
opening the gate works with no further setup.

### External services

The app may eventually call out — sync, exchange rates, bank import, backup —
but **every service is closed right now**.

`src/services/http.ts` is the single outbound network path; nothing else in the
app calls `fetch`. Two gates must both pass before a request is constructed:

1. `VITE_SERVICES_ENABLED=true` in the environment (see `.env.example`) — a
   build-time flag, deliberately **not** user-editable, and
2. the service's own `enabled` flag: the default in `src/services/config.ts`,
   overridable per-service by the user from Settings.

Both are currently false, so `request()` throws `ServiceError('disabled')`
before building a URL. Whatever a user turns on in Settings, no request leaves
the device while gate 1 is false — and a stray edit to one gate cannot start
traffic on its own.

Work that must eventually reach a server goes through `src/services/outbox.ts`,
a durable SQLite-backed queue with exponential backoff. The UI never blocks on
it. With services closed `drain()` skips every entry, so nothing leaves the
device.

To open a service later: flip its `enabled`, set the env var, point `baseUrl` at
a real host. No other code changes.

## Layout

```
src/
  domain/types.ts        Account, Transaction, Category, Budget
  db/
    schema.ts            DDL + forward-only migrations
    sqlite.ts            connection, migrations, transact/query/run helpers
    bootstrap.ts         first-run init and category seeding
  repositories/
    accounts.ts          balances, net worth across currencies
    transactions.ts      filtering, paging, period totals
    categories.ts        + the seeded defaults
    budgets.ts           recurring periods and progress
    rates.ts             cached FX rates and conversion
    settings.ts          base currency, service overrides
  services/
    config.ts            service registry, kill switch, runtime overrides
    http.ts              the single outbound network path
    outbox.ts            durable retry queue
    rates.ts             provider refresh (closed)
  lib/
    money.ts             minor-unit parsing and formatting
    currencies.ts        picker list
    rate-parsing.ts      provider-agnostic response parsing
    id.ts                UUID generation
scripts/
  verify-sql.mjs         schema + aggregates against node:sqlite
  verify-rates.mjs       parser against real provider payloads
```
