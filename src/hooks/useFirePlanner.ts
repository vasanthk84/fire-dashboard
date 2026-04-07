import { useMemo, useState } from 'react';
import { initialExpenses, initialInputs, initialOneTimeExpenses } from '../constants';
import { calculatePlan } from '../services/api';
import type { CalculationResults, Expenses, Inputs, OneTimeExpenses } from '../types';

function sumValues<T extends object>(values: T): number {
  return Object.values(values as Record<string, number>).reduce((total, value) => total + value, 0);
}

function findNegativeEntry(values: Record<string, number>): string | null {
  const match = Object.entries(values).find(([, value]) => value < 0);
  return match ? match[0] : null;
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
  const totalOneTime = useMemo(() => (showOneTime ? sumValues(oneTimeExpenses) : 0), [oneTimeExpenses, showOneTime]);

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

  const validation = useMemo(() => {
    const blocking: string[] = [];
    const advisory: string[] = [];

    if (inputs.retirementYear <= inputs.startYear) {
      blocking.push('Retirement year must be after start year.');
    }

    if (inputs.returnYear < inputs.startYear) {
      blocking.push('Return-to-India year cannot be before the start year.');
    }

    if (inputs.withdraw401kYear < inputs.startYear) {
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
  }, [currentMonthlyExp, expenses, inputs, oneTimeExpenses, showOneTime, totalOneTime]);

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
    sumExpenses: sumValues,
    initialOneTimeExpenses
  };
}

export type UseFirePlannerReturn = ReturnType<typeof useFirePlanner>;