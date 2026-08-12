/**
 * Routes and the top-level shell.
 *
 * The add-transaction overlay lives here rather than on a route: it sits above
 * the tab bar in the design and has to be reachable from every screen without
 * losing the one underneath it.
 */

import { useState } from 'react';
import { IonApp } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Redirect, Route, Switch } from 'react-router-dom';

import { Accounts } from './pages/Accounts';
import { AddTransaction } from './pages/AddTransaction';
import { Bills } from './pages/Bills';
import { Budgets } from './pages/Budgets';
import { Categories } from './pages/Categories';
import { Currency } from './pages/Currency';
import { Goals } from './pages/Goals';
import { Home } from './pages/Home';
import { Insights } from './pages/Insights';
import { More } from './pages/More';
import { Onboarding } from './pages/Onboarding';
import { Settings } from './pages/Settings';
import { Transactions } from './pages/Transactions';
import { LedgerProvider } from './state/LedgerProvider';
import { useLedger } from './state/LedgerContext';
import { AppShell } from './ui/AppShell';

/** Shown while the database opens — matches the app ground, so no white flash. */
function Splash() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'var(--color-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: 46,
          height: 46,
          borderRadius: '50%',
          border: '1px solid var(--color-accent-800)',
          borderTopColor: 'var(--color-accent)',
          animation: 'spin 1.1s linear infinite',
        }}
      />
    </div>
  );
}

function Routes() {
  const { settings } = useLedger();
  // `skipped` lets "Look around first" through without marking onboarding done,
  // so the user is offered setup again next launch.
  const [skipped, setSkipped] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  if (!settings.onboarded && !skipped) {
    return <Onboarding onDone={() => setSkipped(true)} />;
  }

  return (
    <>
      <AppShell onAdd={() => setAddOpen(true)} addOpen={addOpen}>
        <Switch>
          <Route exact path="/" component={Home} />
          <Route exact path="/transactions" component={Transactions} />
          <Route exact path="/insights" component={Insights} />
          <Route exact path="/budgets" component={Budgets} />
          <Route exact path="/accounts" component={Accounts} />
          <Route exact path="/goals" component={Goals} />
          <Route exact path="/bills" component={Bills} />
          <Route exact path="/categories" component={Categories} />
          <Route exact path="/currency" component={Currency} />
          <Route exact path="/more" component={More} />
          <Route exact path="/settings" component={Settings} />
          <Redirect to="/" />
        </Switch>
      </AppShell>
      <AddTransaction open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}

export default function App() {
  return (
    <IonApp>
      <IonReactRouter>
        <LedgerProvider fallback={<Splash />}>
          <Routes />
        </LedgerProvider>
      </IonReactRouter>
    </IonApp>
  );
}
