/**
 * TEMPORARY dev harness.
 *
 * This screen exists so the stack can actually be launched and driven before
 * the design is imported: it boots the database, exercises a write, and reports
 * the live state of the data and service layers. The real tabbed UI replaces it
 * once the design lands — nothing else imports this file.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  IonApp,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/react';

import { initialize } from './db/bootstrap';
import { LATEST_VERSION } from './db/schema';
import { CURRENCIES } from './lib/currencies';
import { formatMoney } from './lib/money';
import * as accountsRepo from './repositories/accounts';
import * as categoriesRepo from './repositories/categories';
import * as ratesRepo from './repositories/rates';
import * as settingsRepo from './repositories/settings';
import * as transactionsRepo from './repositories/transactions';
import { SERVICES_ENABLED, resolveAllServices, type ServiceDefinition } from './services/config';
import * as ratesService from './services/rates';
import { pendingCount } from './services/outbox';

interface Snapshot {
  baseCurrency: string;
  categories: number;
  accounts: accountsRepo.NetWorth;
  balances: { id: string; name: string; currency: string; balance: number }[];
  transactions: number;
  services: ServiceDefinition[];
  outbox: number;
  rateCount: number;
  rateAge: number | null;
}

export default function App() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const settings = await settingsRepo.all();
    const [categories, netWorth, balances, transactions, services, outbox, rates, rateAge] =
      await Promise.all([
        categoriesRepo.list(),
        accountsRepo.netWorth(settings.baseCurrency),
        accountsRepo.listWithBalances(),
        transactionsRepo.count(),
        resolveAllServices(),
        pendingCount(),
        ratesRepo.all(),
        ratesRepo.ageHours(),
      ]);

    setSnapshot({
      baseCurrency: settings.baseCurrency,
      categories: categories.length,
      accounts: netWorth,
      balances: balances.map((a) => ({
        id: a.id,
        name: a.name,
        currency: a.currency,
        balance: a.balance,
      })),
      transactions,
      services,
      outbox,
      rateCount: rates.length,
      rateAge,
    });
  }, []);

  useEffect(() => {
    initialize()
      .then(load)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [load]);

  /** Writes a real account and transaction, then re-reads derived balances. */
  const addSample = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const settings = await settingsRepo.all();
      const account = await accountsRepo.create({
        name: `Account ${Math.floor(performance.now()) % 1000}`,
        kind: 'cash',
        currency: settings.baseCurrency,
        openingBalance: 100_00,
        color: null,
        icon: null,
        last4: null,
        archived: false,
        sortOrder: 0,
      });
      const [category] = await categoriesRepo.list('expense');
      await transactionsRepo.create({
        kind: 'expense',
        amount: 12_34,
        currency: settings.baseCurrency,
        accountId: account.id,
        counterAccountId: null,
        categoryId: category?.id ?? null,
        payee: 'Smoke test',
        note: null,
        occurredAt: Date.now(),
        pending: false,
      });
      setMessage('Wrote 1 account + 1 transaction.');
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const changeCurrency = async (code: string) => {
    await settingsRepo.setBaseCurrency(code);
    await load();
  };

  /** Expected to report 'skipped' while the service gates are closed. */
  const tryRates = async () => {
    setBusy(true);
    const result = await ratesService.refresh({ force: true });
    setMessage(`rates refresh → ${result.status}${result.reason ? `: ${result.reason}` : ''}`);
    setBusy(false);
    await load();
  };

  return (
    <IonApp>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Ledger — system status</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        {error && (
          <IonCard color="danger">
            <IonCardHeader>
              <IonCardTitle>Startup failed</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>{error}</IonCardContent>
          </IonCard>
        )}

        {!snapshot && !error && (
          <div className="ion-text-center ion-padding">
            <IonSpinner /> <p>Opening database…</p>
          </div>
        )}

        {snapshot && (
          <>
            <IonCard>
              <IonCardHeader>
                <IonCardTitle>Storage</IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <IonList inset>
                  <IonItem>
                    <IonLabel>Schema version</IonLabel>
                    <IonNote slot="end">{LATEST_VERSION}</IonNote>
                  </IonItem>
                  <IonItem>
                    <IonLabel>Seeded categories</IonLabel>
                    <IonNote slot="end">{snapshot.categories}</IonNote>
                  </IonItem>
                  <IonItem>
                    <IonLabel>Accounts</IonLabel>
                    <IonNote slot="end">{snapshot.balances.length}</IonNote>
                  </IonItem>
                  <IonItem>
                    <IonLabel>Transactions</IonLabel>
                    <IonNote slot="end">{snapshot.transactions}</IonNote>
                  </IonItem>
                </IonList>
                <IonButton expand="block" onClick={addSample} disabled={busy}>
                  Write sample data
                </IonButton>
              </IonCardContent>
            </IonCard>

            <IonCard>
              <IonCardHeader>
                <IonCardTitle>
                  Net worth ·{' '}
                  {formatMoney(snapshot.accounts.total, snapshot.accounts.currency)}
                </IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <IonItem>
                  <IonSelect
                    label="Base currency"
                    value={snapshot.baseCurrency}
                    onIonChange={(e) => changeCurrency(e.detail.value)}
                  >
                    {CURRENCIES.map((c) => (
                      <IonSelectOption key={c.code} value={c.code}>
                        {c.code} — {c.name}
                      </IonSelectOption>
                    ))}
                  </IonSelect>
                </IonItem>

                {snapshot.accounts.missing.length > 0 && (
                  <IonNote color="warning">
                    Not converted (no cached rate): {snapshot.accounts.missing.join(', ')}
                  </IonNote>
                )}

                <IonList inset>
                  {snapshot.balances.length === 0 && (
                    <IonItem>
                      <IonLabel color="medium">No accounts yet</IonLabel>
                    </IonItem>
                  )}
                  {snapshot.balances.map((a) => (
                    <IonItem key={a.id}>
                      <IonLabel>{a.name}</IonLabel>
                      <IonNote slot="end">{formatMoney(a.balance, a.currency)}</IonNote>
                    </IonItem>
                  ))}
                </IonList>
              </IonCardContent>
            </IonCard>

            <IonCard>
              <IonCardHeader>
                <IonCardTitle>External services</IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <IonNote>
                  Build gate VITE_SERVICES_ENABLED ={' '}
                  <strong>{String(SERVICES_ENABLED)}</strong>
                </IonNote>
                <IonList inset>
                  {snapshot.services.map((s) => (
                    <IonItem key={s.id}>
                      <IonLabel>
                        <h3>{s.label}</h3>
                        <p>{s.baseUrl}</p>
                      </IonLabel>
                      <IonNote slot="end" color={SERVICES_ENABLED && s.enabled ? 'success' : 'medium'}>
                        {SERVICES_ENABLED && s.enabled ? 'open' : 'closed'}
                      </IonNote>
                    </IonItem>
                  ))}
                  <IonItem>
                    <IonLabel>Outbox queue</IonLabel>
                    <IonNote slot="end">{snapshot.outbox}</IonNote>
                  </IonItem>
                  <IonItem>
                    <IonLabel>Cached rates</IonLabel>
                    <IonNote slot="end">
                      {snapshot.rateCount}
                      {snapshot.rateAge === null ? '' : ` · ${snapshot.rateAge.toFixed(1)}h old`}
                    </IonNote>
                  </IonItem>
                </IonList>
                <IonButton expand="block" fill="outline" onClick={tryRates} disabled={busy}>
                  Try rates refresh
                </IonButton>
              </IonCardContent>
            </IonCard>

            {message && (
              <IonNote className="ion-padding" id="status-message">
                {message}
              </IonNote>
            )}
          </>
        )}
      </IonContent>
    </IonApp>
  );
}
