import type { Expenses, Inputs, OneTimeExpenses } from '../types';

const STORAGE_KEY = 'fire-planner-plan-v1';

export interface PersistedPlan {
  inputs: Partial<Inputs>;
  expenses: Partial<Expenses>;
  oneTimeExpenses: Partial<OneTimeExpenses>;
  showOneTime: boolean;
}

/**
 * Reads the saved plan from localStorage, if any. Never throws — a missing key,
 * corrupted JSON, or unavailable storage (private browsing, quota) all just
 * result in `null`, so the caller falls back to the app's built-in defaults.
 */
export function loadPersistedPlan(): PersistedPlan | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as PersistedPlan;
  } catch {
    return null;
  }
}

/**
 * Persists the plan to localStorage. Never throws — if storage is unavailable
 * the app keeps working from in-memory state, it just won't survive a reload.
 */
export function savePersistedPlan(plan: PersistedPlan): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
  } catch {
    // ignore — private browsing, quota exceeded, or storage disabled
  }
}

export function clearPersistedPlan(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Merges saved values over the current code defaults, field by field. This is
 * the important bit for forward-compatibility: when a new field is added to
 * Inputs (as happens whenever this app grows), an older saved blob simply
 * won't have it — spreading defaults first and the saved partial second means
 * new fields fall back to their code default instead of becoming `undefined`
 * (which would silently turn into NaN in downstream calculations).
 */
export function mergeWithDefaults<T extends object>(defaults: T, saved: Partial<T> | undefined | null): T {
  return { ...defaults, ...(saved ?? {}) };
}
