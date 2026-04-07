import { useMemo, useState } from 'react';
import { initialExpenses, initialInputs, initialOneTimeExpenses } from '../constants';
import { calculatePlan } from '../services/api';
import type { CalculationResults, Expenses, Inputs, OneTimeExpenses } from '../types';

function sumValues<T extends object>(values: T): number {
  return Object.values(values as Record<string, number>).reduce((total, value) => total + value, 0);
}

export function useFirePlanner() {
  const [inputs, setInputs] = useState<Inputs>(initialInputs);
  const [results, setResults] = useState<CalculationResults | null>(null);
  const [expenses, setExpenses] = useState<Expenses>(initialExpenses);
  const [oneTimeExpenses, setOneTimeExpenses] = useState<OneTimeExpenses>(initialOneTimeExpenses);
  const [showOneTime, setShowOneTime] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculationError, setCalculationError] = useState<string | null>(null);

  const currentMonthlyExp = useMemo(() => sumValues(expenses), [expenses]);
  const currentAnnualExp = currentMonthlyExp * 12;
  const taxDrag = inputs.applyTax ? 0.125 : 0;

  const fireNumberLakhs = useMemo(() => {
    if (currentAnnualExp === 0) {
      return 0;
    }

    return (currentAnnualExp * inputs.fireMultiplier) / (1 - taxDrag) / 100000;
  }, [currentAnnualExp, inputs.fireMultiplier, taxDrag]);

  const currentWealthLakhs = results
    ? results.summary.startWealth
    : inputs.mfCurrent + inputs.stocksIndia + inputs.usStocks + inputs.emergencyFund + inputs.epfCurrent + inputs.bondsInitial;

  const progressToFire = fireNumberLakhs > 0 ? Math.min((currentWealthLakhs / fireNumberLakhs) * 100, 100) : 0;

  const yearsToFI = useMemo(() => {
    if (!results || fireNumberLakhs <= 0) {
      return null;
    }

    for (let index = 0; index < results.fireProjections.length; index += 1) {
      if (results.fireProjections[index].total >= fireNumberLakhs) {
        return index;
      }
    }

    return null;
  }, [fireNumberLakhs, results]);

  const sampleTaxYear = results?.fireProjections.find((projection) => projection.year === inputs.retirementYear);

  const handleInput = (key: keyof Inputs, value: number | boolean) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const runCalculation = async (overrides: Partial<Inputs> = {}) => {
    const totalMonthly = sumValues(expenses);
    const totalOneTime = showOneTime ? sumValues(oneTimeExpenses) : 0;

    const payload: Partial<Inputs> = {
      ...inputs,
      monthlyExpenses: totalMonthly,
      oneTimeExpenseTotal: totalOneTime,
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
    handleInput,
    handleExpense,
    handleOneTime,
    runCalculation,
    sumExpenses: sumValues,
    initialOneTimeExpenses
  };
}

export type UseFirePlannerReturn = ReturnType<typeof useFirePlanner>;