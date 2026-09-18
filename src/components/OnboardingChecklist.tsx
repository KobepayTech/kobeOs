import { useCallback, useEffect, useState } from 'react';
import { Check, ChevronRight, X } from 'lucide-react';
import {
  OnboardingState,
  OnboardingStepState,
  STEP_COPY,
  dismissOnboarding,
  fetchOnboarding,
  skipOnboardingStep,
} from '@/lib/onboarding';

/**
 * First-run checklist for a new account.
 *
 * Deliberately a panel and not a blocking wizard: KobeOS runs offline on a
 * shop counter, and a setup screen that cannot reach the server would lock
 * someone out of their own till. Anything that fails here simply hides the
 * checklist.
 *
 * Progress comes from the server, which derives it from the real records, so
 * a step completed anywhere else in KobeOS shows as done here without the
 * checklist being told about it.
 */
export default function OnboardingChecklist({ onNavigate }: { onNavigate?: (href: string) => void }) {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setState(await fetchOnboarding());
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Re-read when the window regains focus: the usual way a step gets done is
  // the user going off to another app and coming back.
  useEffect(() => {
    const onFocus = () => { void load(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  if (!state || state.completed) return null;

  const act = async (run: () => Promise<OnboardingState | null>) => {
    setBusy(true);
    const next = await run();
    if (next) setState(next);
    setBusy(false);
  };

  const go = (href: string) => {
    if (onNavigate) onNavigate(href);
    else window.location.assign(href);
  };

  const pending = state.steps.filter((step) => !step.done && !step.skipped);

  return (
    <section
      aria-label="Set up KobeOS"
      className="rounded-xl border border-slate-700 bg-slate-900/95 p-4 text-slate-100 shadow-xl w-[22rem]"
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold">Finish setting up</h2>
          <p className="text-xs text-slate-400">
            {state.completedCount} of {state.totalCount} done
            {pending.length ? ` · ${pending.length} left` : ''}
          </p>
        </div>
        <button
          type="button"
          aria-label="Dismiss setup checklist"
          disabled={busy}
          onClick={() => act(dismissOnboarding)}
          className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-slate-100 disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div
        className="mt-3 h-1 w-full overflow-hidden rounded bg-slate-800"
        role="progressbar"
        aria-valuenow={state.completedCount}
        aria-valuemin={0}
        aria-valuemax={state.totalCount}
      >
        <div
          className="h-full bg-emerald-500 transition-all"
          style={{ width: `${Math.round((state.completedCount / Math.max(1, state.totalCount)) * 100)}%` }}
        />
      </div>

      <ul className="mt-3 space-y-2">
        {state.steps.map((step) => (
          <StepRow key={step.step} step={step} busy={busy} onGo={go} onSkip={() => act(() => skipOnboardingStep(step.step))} />
        ))}
      </ul>
    </section>
  );
}

function StepRow({
  step, busy, onGo, onSkip,
}: {
  step: OnboardingStepState;
  busy: boolean;
  onGo: (href: string) => void;
  onSkip: () => void;
}) {
  const copy = STEP_COPY[step.step];
  if (!copy) return null;

  return (
    <li className={`rounded-lg border p-2.5 ${step.done ? 'border-emerald-700/50 bg-emerald-950/30' : 'border-slate-700 bg-slate-800/40'}`}>
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden
          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
            step.done ? 'border-emerald-500 bg-emerald-500 text-slate-900' : 'border-slate-600'
          }`}
        >
          {step.done ? <Check className="h-3 w-3" /> : null}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-semibold ${step.done ? 'text-emerald-300 line-through' : ''}`}>
            {copy.title}
            {step.skipped && !step.done ? <span className="ml-1 font-normal text-slate-500">· skipped</span> : null}
          </p>
          {!step.done ? <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{copy.detail}</p> : null}
        </div>
      </div>

      {!step.done ? (
        <div className="mt-2 flex items-center gap-2 pl-[26px]">
          <button
            type="button"
            onClick={() => onGo(copy.href)}
            className="inline-flex items-center gap-1 rounded bg-indigo-600 px-2 py-1 text-[11px] font-bold hover:bg-indigo-500"
          >
            {copy.action} <ChevronRight className="h-3 w-3" />
          </button>
          {!step.skipped ? (
            <button
              type="button"
              disabled={busy}
              onClick={onSkip}
              className="rounded px-2 py-1 text-[11px] text-slate-400 hover:text-slate-200 disabled:opacity-50"
            >
              Skip
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
