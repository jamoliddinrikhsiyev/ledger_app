/** Savings goals: total progress, one ring per goal, and a contribution sheet. */

import { useState } from 'react';

import type { GoalProgress } from '../domain/types';
import { formatEta } from '../lib/dates';
import { formatMoney, parseAmount } from '../lib/money';
import * as goalsRepo from '../repositories/goals';
import { useLedger } from '../state/LedgerContext';
import { Sheet } from '../ui/Sheet';
import {
  EmptyState,
  Eyebrow,
  Muted,
  PrimaryButton,
  ProgressBar,
  ProgressRing,
  TextField,
} from '../ui/primitives';

const QUICK_AMOUNTS = [25, 50, 100, 250];

export function Goals() {
  const { goals, settings, money, refresh, flash } = useLedger();

  const [sheet, setSheet] = useState<'new' | 'contribute' | null>(null);
  const [target, setTarget] = useState<GoalProgress | null>(null);
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [perMonth, setPerMonth] = useState('');
  const [contribution, setContribution] = useState('');

  const saved = goals.reduce((sum, g) => sum + g.saved, 0);
  const targetTotal = goals.reduce((sum, g) => sum + g.target, 0);

  const openNew = () => {
    setName('');
    setTargetAmount('');
    setPerMonth('');
    setSheet('new');
  };

  const openContribute = (goal: GoalProgress) => {
    setTarget(goal);
    setContribution('');
    setSheet('contribute');
  };

  const saveGoal = async () => {
    const trimmed = name.trim();
    const amount = parseAmount(targetAmount, settings.baseCurrency);
    if (!trimmed || amount === null || amount <= 0) {
      flash('A goal needs a name and a target');
      return;
    }

    const monthly = parseAmount(perMonth, settings.baseCurrency);
    await goalsRepo.create({
      name: trimmed,
      icon: 'ph-flag-banner',
      target: amount,
      saved: 0,
      // With no monthly figure, assume a two-year horizon so the goal still
      // projects a finish date rather than showing nothing.
      perMonth: monthly && monthly > 0 ? monthly : Math.round(amount / 24),
      currency: settings.baseCurrency,
      sortOrder: goals.length,
    });

    setSheet(null);
    await refresh();
    flash(`${trimmed} — ${money(amount)} target set`);
  };

  const contribute = async () => {
    if (!target) return;
    const amount = parseAmount(contribution, target.currency);
    if (amount === null || amount <= 0) return;

    await goalsRepo.contribute(target.id, amount);
    setSheet(null);
    await refresh();
    flash(`${formatMoney(amount, target.currency)} into ${target.name}`);
  };

  if (goals.length === 0) {
    return (
      <div className="rise" style={{ paddingTop: 4 }}>
        <EmptyState
          icon="ph-flag-banner"
          title="No goals yet"
          body="Name something you are saving for and Ledger tracks how close you are."
          action={
            <PrimaryButton height={46} onClick={openNew}>
              New savings goal
            </PrimaryButton>
          }
        />
        <NewGoalSheet
          open={sheet === 'new'}
          onClose={() => setSheet(null)}
          name={name}
          setName={setName}
          target={targetAmount}
          setTarget={setTargetAmount}
          perMonth={perMonth}
          setPerMonth={setPerMonth}
          onSave={saveGoal}
        />
      </div>
    );
  }

  return (
    <div className="rise" style={{ paddingTop: 4, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 6 }}>
        <Eyebrow>Saved so far</Eyebrow>
        <div style={{ font: '500 34px/1 var(--font-heading)', letterSpacing: '-.025em' }}>
          {money(saved)}
        </div>
        <ProgressBar ratio={targetTotal > 0 ? saved / targetTotal : 0} />
        <Muted>
          of {money(targetTotal)} across {goals.length} goal{goals.length === 1 ? '' : 's'}
        </Muted>
      </div>

      {goals.map((goal) => (
        <button
          key={goal.id}
          type="button"
          onClick={() => openContribute(goal)}
          style={{
            border: '1px solid var(--color-neutral-800)',
            borderRadius: 'var(--radius-md)',
            padding: 16,
            display: 'flex',
            gap: 15,
            alignItems: 'center',
            background: 'transparent',
            color: 'var(--color-text)',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <ProgressRing ratio={goal.ratio}>{Math.round(goal.ratio * 100)}%</ProgressRing>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, font: '400 15px var(--font-body)' }}>
              <i className={`ph ${goal.icon ?? 'ph-flag-banner'}`} style={{ color: 'var(--color-neutral-500)' }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {goal.name}
              </span>
            </div>
            <div style={{ font: '500 18px var(--font-heading)', letterSpacing: '-.01em' }}>
              {formatMoney(goal.saved, goal.currency)}
            </div>
            <Muted>
              of {formatMoney(goal.target, goal.currency)} ·{' '}
              {goal.remaining > 0 ? `${formatMoney(goal.remaining, goal.currency)} to go` : 'funded'}
            </Muted>
            <span style={{ font: '400 12px var(--font-body)', color: 'var(--color-accent-600)' }}>
              {formatEta(goal.etaMonths)}
            </span>
          </div>
          <span style={{ color: 'var(--color-neutral-600)', fontSize: 16, flex: 'none' }}>
            <i className="ph ph-plus-circle" />
          </span>
        </button>
      ))}

      <PrimaryButton height={46} style={{ marginTop: 4 }} onClick={openNew}>
        New savings goal
      </PrimaryButton>

      <NewGoalSheet
        open={sheet === 'new'}
        onClose={() => setSheet(null)}
        name={name}
        setName={setName}
        target={targetAmount}
        setTarget={setTargetAmount}
        perMonth={perMonth}
        setPerMonth={setPerMonth}
        onSave={saveGoal}
      />

      <Sheet
        open={sheet === 'contribute'}
        title={`Add to ${target?.name ?? ''}`}
        subtitle={
          target
            ? `${formatMoney(target.saved, target.currency)} of ${formatMoney(target.target, target.currency)}`
            : undefined
        }
        onClose={() => setSheet(null)}
      >
        <div
          style={{
            font: '500 40px/1 var(--font-heading)',
            letterSpacing: '-.03em',
            color: contribution ? 'var(--color-text)' : 'var(--color-neutral-800)',
            padding: '6px 0',
          }}
        >
          {formatMoney(
            parseAmount(contribution || '0', target?.currency ?? settings.baseCurrency) ?? 0,
            target?.currency ?? settings.baseCurrency,
          )}
        </div>
        <TextField
          value={contribution}
          onChange={setContribution}
          inputMode="decimal"
          placeholder="Amount"
        />
        <div style={{ display: 'flex', gap: 7 }}>
          {QUICK_AMOUNTS.map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => setContribution(String(amount))}
              style={{
                flex: 1,
                height: 38,
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-neutral-800)',
                background: 'transparent',
                color: 'var(--color-neutral-500)',
                font: '400 13px var(--font-body)',
                cursor: 'pointer',
              }}
            >
              {formatMoney(amount * 100, target?.currency ?? settings.baseCurrency, { compact: true })}
            </button>
          ))}
        </div>
        <PrimaryButton height={48} onClick={contribute} disabled={!contribution.trim()}>
          Move to savings
        </PrimaryButton>
      </Sheet>
    </div>
  );
}

function NewGoalSheet({
  open,
  onClose,
  name,
  setName,
  target,
  setTarget,
  perMonth,
  setPerMonth,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  setName: (v: string) => void;
  target: string;
  setTarget: (v: string) => void;
  perMonth: string;
  setPerMonth: (v: string) => void;
  onSave: () => void;
}) {
  return (
    <Sheet open={open} title="What are you saving for?" onClose={onClose}>
      <TextField value={name} onChange={setName} placeholder="Goal, e.g. Deposit on a flat" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <TextField
          label="Target"
          value={target}
          onChange={setTarget}
          inputMode="decimal"
          placeholder="10000"
        />
        <TextField
          label="Per month"
          value={perMonth}
          onChange={setPerMonth}
          inputMode="decimal"
          placeholder="auto"
        />
      </div>
      <PrimaryButton height={48} onClick={onSave} disabled={!name.trim() || !target.trim()}>
        Set target
      </PrimaryButton>
    </Sheet>
  );
}
