import { useEffect, useMemo, useRef, useState } from 'react';
import { initialExpenses, initialInputs, initialOneTimeExpenses } from '../constants';
import { calculatePlan } from '../services/api';
import { clearPersistedPlan, loadPersistedPlan, mergeWithDefaults, savePersistedPlan } from '../utils/persistence';
import { estimateTaxDragApprox } from '../utils/taxModel';
import type { CalculationResults, Expenses, Inputs, OneTimeExpenses } from '../types';

function sumValues<T extends object>(values: T): number {
  return Object.values(values as Record<string, number>).reduce((total, value) => total + value, 0);
}

function findNegativeEntry(values: Record<string, number>): string | null {
  const match = Object.entries(values).find(([, value]) => value < 0);
  return match ? match[0] : null;
}

export function useFirePlanner() {
  // Restore a previously saved plan (if any) so a page reload doesn't reset
  // everything back to the built-in defaults. Missing/new fields fall back to
  // the current code defaults rather than becoming undefined.
  const [inputs, setInputs] = useState<Inputs>(() => mergeWithDefaults(initialInputs, loadPersistedPlan()?.inputs));
  const [results, setResults] = useState<CalculationResults | null>(null);
  const [expenses, setExpenses] = useState<Expenses>(() => mergeWithDefaults(initialExpenses, loadPersistedPlan()?.expenses));
  const [oneTimeExpenses, setOneTimeExpenses] = useState<OneTimeExpenses>(() =>
    mergeWithDefaults(initialOneTimeExpenses, loadPersistedPlan()?.oneTimeExpenses)
  );
  const [showOneTime, setShowOneTime] = useState(() => loadPersistedPlan()?.showOneTime ?? true);
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculationError, setCalculationError] = useState<string | null>(null);

  // Autosave, debounced so a dragged slider doesn't hammer localStorage with a
  // write on every intermediate value.
  const saveTimeoutRef = useRef<number | null>(null);
  useEffect(() => {
    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = window.setTimeout(() => {
      savePersistedPlan({ inputs, expenses, oneTimeExpenses, showOneTime });
    }, 300);

    return () => {
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [inputs, expenses, oneTimeExpenses, showOneTime]);

  const currentMonthlyExp = useMemo(() => sumValues(expenses), [expenses]);
  const currentAnnualExp = currentMonthlyExp * 12;
  const taxDrag = estimateTaxDragApprox(inputs);
  const totalOneTime = useMemo(() => (showOneTime ? sumValues(oneTimeExpenses) : 0), [oneTimeExpenses, showOneTime]);

  const fireNumberLakhs = useMemo(() => {
    if (currentAnnualExp === 0) {
      return 0;
    }

    return (currentAnnualExp * inputs.fireMultiplier) / (1 - taxDrag) / 100000;
  }, [currentAnnualExp, inputs.fireMultiplier, taxDrag]);

  const currentWealthLakhs = results
    ? results.summary.startWealth
    : inputs.mfCurrent + inputs.stocksIndia + inputs.usStocks + inputs.epfCurrent + inputs.ppfCurrent +
      inputs.fdCurrent + inputs.npsCurrent + inputs.bondsInitial + inputs.optionsPortfolioValue +
      inputs.apartmentCurrent;

  const progressToFire = fireNumberLakhs > 0 ? Math.min((currentWealthLakhs / fireNumberLakhs) * 100, 100) : 0;

  const yearsToFI = useMemo(() => {
    if (!results || fireNumberLakhs <= 0) {
      return null;
    }

    const hit = results.fireProjections.find((projection) => projection.total >= fireNumberLakhs);
    return hit ? hit.year - inputs.startYear : null;
  }, [fireNumberLakhs, inputs.startYear, results]);

  const sampleTaxYear = results?.fireProjections.find((projection) => projection.year === inputs.retirementYear);

  const validation = useMemo(() => {
    const blocking: string[] = [];
    const advisory: string[] = [];

    if (inputs.retirementYear <= inputs.startYear) {
      blocking.push('Retirement year must be after start year.');
    }

    if (inputs.returnYear >= 2000 && inputs.returnYear < inputs.startYear) {
      blocking.push('Return-to-India year cannot be before the start year.');
    }

    if (inputs.withdraw401kYear >= 2000 && inputs.withdraw401kYear < inputs.startYear) {
      blocking.push('401k withdrawal year cannot be before the start year.');
    }

    if (inputs.usdExchangeRate <= 0) {
      blocking.push('USD exchange rate must be greater than zero.');
    }

    if (inputs.fireMultiplier <= 0) {
      blocking.push('FIRE multiplier must be greater than zero.');
    }

    const negativeInput = findNegativeEntry(inputs as unknown as Record<string, number>);
    if (negativeInput) {
      blocking.push(`Negative values are not allowed for ${negativeInput}.`);
    }

    const negativeExpense = findNegativeEntry(expenses as unknown as Record<string, number>);
    if (negativeExpense) {
      blocking.push(`Negative expense values are not allowed for ${negativeExpense}.`);
    }

    if (showOneTime) {
      const negativeOneTime = findNegativeEntry(oneTimeExpenses as unknown as Record<string, number>);
      if (negativeOneTime) {
        blocking.push(`Negative one-time expense values are not allowed for ${negativeOneTime}.`);
      }
    }

    if (currentMonthlyExp === 0) {
      advisory.push('Monthly expenses are still zero, so the FIRE target will not represent your actual lifestyle requirement.');
    } else if (fireNumberLakhs > 0 && currentWealthLakhs >= fireNumberLakhs) {
      advisory.push(`Your FIRE target (${fireNumberLakhs.toFixed(1)}L) is already below your current wealth (${currentWealthLakhs.toFixed(1)}L) — "Years to FIRE" will show 0. Double-check that all your monthly expenses are filled in on the Expenses tab; an incomplete list understates your real target.`);
    }

    if (showOneTime && totalOneTime === 0) {
      advisory.push('Return-to-India setup costs are enabled, but all one-time expense fields are still zero.');
    }

    if (inputs.mfPrincipal > inputs.mfCurrent) {
      advisory.push('MF principal is higher than current MF value, so withdrawal tax estimates may be misleading.');
    }

    if (inputs.withdraw401kYear < inputs.retirementYear) {
      advisory.push('401k withdrawal is scheduled before retirement, which can materially change the accumulation path.');
    }

    if (inputs.fireMultiplier < 25) {
      advisory.push('A FIRE multiplier below 25 implies a relatively aggressive withdrawal assumption.');
    }

    if (inputs.inflationRate >= inputs.mfRate && inputs.inflationRate >= inputs.stocksRate) {
      advisory.push('Inflation is at or above the main growth assumptions, which makes the plan structurally hard to sustain.');
    }

    return {
      blocking,
      advisory,
      hasBlocking: blocking.length > 0,
      hasAdvisory: advisory.length > 0
    };
  }, [currentMonthlyExp, currentWealthLakhs, expenses, fireNumberLakhs, inputs, oneTimeExpenses, showOneTime, totalOneTime]);

  const handleInput = (key: keyof Inputs, value: number | boolean) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const runCalculation = async (overrides: Partial<Inputs> = {}) => {
    const totalMonthly = sumValues(expenses);
    const nextOneTimeTotal = showOneTime ? sumValues(oneTimeExpenses) : 0;

    if (validation.hasBlocking) {
      setCalculationError(validation.blocking.join(' '));
      return null;
    }

    const payload: Partial<Inputs> = {
      ...inputs,
      monthlyExpenses: totalMonthly,
      oneTimeExpenseTotal: nextOneTimeTotal,
      ...overrides
    };

    setIsCalculating(true);
    setCalculationError(null);

    try {
      const data = await calculatePlan(payload);
      setResults(data);
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to calculate FIRE plan';
      setCalculationError(message);
      throw error;
    } finally {
      setIsCalculating(false);
    }
  };

  const handleExpense = async (key: keyof Expenses, value: string) => {
    const next = { ...expenses, [key]: Number(value) || 0 };
    setExpenses(next);

    if (results) {
      await runCalculation({ monthlyExpenses: sumValues(next) });
    }
  };

  const handleOneTime = async (key: keyof OneTimeExpenses, value: string) => {
    const next = { ...oneTimeExpenses, [key]: Number(value) || 0 };
    setOneTimeExpenses(next);

    if (results && showOneTime) {
      await runCalculation({ oneTimeExpenseTotal: sumValues(next) });
    }
  };

  // Clears the saved plan and restores the app's built-in defaults. Snapshots
  // (a separate feature/localStorage key) are untouched.
  const resetToDefaults = async () => {
    clearPersistedPlan();
    setInputs(initialInputs);
    setExpenses(initialExpenses);
    setOneTimeExpenses(initialOneTimeExpenses);
    setShowOneTime(false);
    setCalculationError(null);
    setIsCalculating(true);

    try {
      const data = await calculatePlan({ ...initialInputs, monthlyExpenses: 0, oneTimeExpenseTotal: 0 });
      setResults(data);
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to calculate FIRE plan';
      setCalculationError(message);
      return null;
    } finally {
      setIsCalculating(false);
    }
  };

  // Runs the villa-year projection twice — once keeping the existing
  // apartment as a second property, once selling it to fund the down
  // payment — without touching the live `results`/`inputs.apartmentSellAtVilla`
  // state, so the user can see the corpus-at-retirement delta between the two
  // paths without committing to either one first.
  const compareApartmentScenarios = async (): Promise<{ keep: number; sell: number } | null> => {
    if (validation.hasBlocking) {
      return null;
    }

    const basePayload: Partial<Inputs> = {
      ...inputs,
      monthlyExpenses: sumValues(expenses),
      oneTimeExpenseTotal: showOneTime ? sumValues(oneTimeExpenses) : 0,
      villaEnabled: true
    };

    const [keepData, sellData] = await Promise.all([
      calculatePlan({ ...basePayload, apartmentSellAtVilla: false }),
      calculatePlan({ ...basePayload, apartmentSellAtVilla: true })
    ]);

    return { keep: keepData.summary.finalWealth, sell: sellData.summary.finalWealth };
  };

  return {
    inputs,
    setInputs,
    results,
    setResults,
    expenses,
    setExpenses,
    oneTimeExpenses,
    setOneTimeExpenses,
    showOneTime,
    setShowOneTime,
    isCalculating,
    calculationError,
    currentMonthlyExp,
    fireNumberLakhs,
    currentWealthLakhs,
    progressToFire,
    yearsToFI,
    sampleTaxYear,
    validation,
    handleInput,
    handleExpense,
    handleOneTime,
    runCalculation,
    compareApartmentScenarios,
    resetToDefaults,
    sumExpenses: sumValues,
    initialOneTimeExpenses
  };
}

export type UseFirePlannerReturn = ReturnType<typeof useFirePlanner>;