import { useEffect, useState } from 'react';
import { calculatePlan } from '../services/api';
import type { CalculationResults, Inputs } from '../types';

type SensitivityTone = 'success' | 'warning' | 'danger';

export interface SensitivityScenario {
  key: 'inflation' | 'returns' | 'expenses' | 'fx';
  label: string;
  assumption: string;
  tone: SensitivityTone;
  finalWealth: number;
  wealthDelta: number;
  coverage: number | null;
  fireYear: number | null;
  summary: string;
}

interface UseSensitivitySummaryArgs {
  inputs: Inputs;
  results: CalculationResults | null;
  currentMonthlyExp: number;
  oneTimeExpenseTotal: number;
  enabled: boolean;
}

function computeCoverage(result: CalculationResults, retirementYear: number): number | null {
  const retirementProjection = result.fireProjections.find((projection) => projection.year === retirementYear);

  if (!retirementProjection || !retirementProjection.calculatedMonthlyExpense) {
    return null;
  }

  return (retirementProjection.passiveIncomeMonthly / retirementProjection.calculatedMonthlyExpense) * 100;
}

function computeFireYear(result: CalculationResults, currentMonthlyExp: number, inputs: Inputs): number | null {
  if (currentMonthlyExp <= 0) {
    return null;
  }

  const taxDrag = inputs.applyTax ? 0.125 : 0;
  const fireTargetLakhs = ((currentMonthlyExp * 12) * inputs.fireMultiplier) / (1 - taxDrag) / 100000;
  const match = result.fireProjections.find((projection) => projection.total >= fireTargetLakhs);
  return match?.year ?? null;
}

function toneFromCoverage(coverage: number | null, retirementYear: number, fireYear: number | null): SensitivityTone {
  if (coverage !== null && coverage >= 100 && (fireYear === null || fireYear <= retirementYear)) {
    return 'success';
  }

  if (coverage !== null && coverage >= 85) {
    return 'warning';
  }

  return 'danger';
}

function buildSummary(coverage: number | null, retirementYear: number, fireYear: number | null): string {
  if (coverage !== null && coverage >= 100) {
    return fireYear && fireYear <= retirementYear
      ? `Still covers retirement expenses and reaches FIRE by ${fireYear}.`
      : `Still covers retirement expenses under this stress case.`;
  }

  if (fireYear && fireYear > retirementYear) {
    return `FIRE moves to ${fireYear}, later than the planned retirement year.`;
  }

  if (coverage !== null) {
    return `Retirement coverage drops to ${coverage.toFixed(0)}% of projected expenses.`;
  }

  return 'Not enough expense data to rate this stress case.';
}

export function useSensitivitySummary({ inputs, results, currentMonthlyExp, oneTimeExpenseTotal, enabled }: UseSensitivitySummaryArgs) {
  const [scenarios, setScenarios] = useState<SensitivityScenario[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !results) {
      setScenarios([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    const run = async () => {
      setIsLoading(true);
      setError(null);

      const basePayload: Partial<Inputs> = {
        ...inputs,
        monthlyExpenses: currentMonthlyExp,
        oneTimeExpenseTotal
      };

      try {
        const [inflationResult, returnsResult, shockResult, fxResult] = await Promise.all([
          calculatePlan({ ...basePayload, inflationRate: inputs.inflationRate + 0.02 }),
          calculatePlan({
            ...basePayload,
            mfRate: Math.max(0, inputs.mfRate - 0.02),
            stocksRate: Math.max(0, inputs.stocksRate - 0.02),
            usRate: Math.max(0, inputs.usRate - 0.02)
          }),
          calculatePlan({
            ...basePayload,
            mfCurrent: inputs.mfCurrent * 0.7,
            stocksIndia: inputs.stocksIndia * 0.7,
            usStocks: inputs.usStocks * 0.7
          }),
          calculatePlan({
            ...basePayload,
            usdExchangeRate: inputs.usdExchangeRate * 0.85
          })
        ]);

        const nextScenarios = [
          {
            key: 'returns',
            label: 'Low returns',
            assumption: 'Equity CAGR −2%',
            finalWealth: returnsResult.summary.finalWealth,
            wealthDelta: returnsResult.summary.finalWealth - results.summary.finalWealth,
            coverage: computeCoverage(returnsResult, inputs.retirementYear),
            fireYear: computeFireYear(returnsResult, currentMonthlyExp, inputs),
            tone: 'warning',
            summary: ''
          },
          {
            key: 'inflation',
            label: 'High inflation',
            assumption: 'Inflation +2%',
            finalWealth: inflationResult.summary.finalWealth,
            wealthDelta: inflationResult.summary.finalWealth - results.summary.finalWealth,
            coverage: computeCoverage(inflationResult, inputs.retirementYear),
            fireYear: computeFireYear(inflationResult, currentMonthlyExp, inputs),
            tone: 'warning',
            summary: ''
          },
          {
            key: 'expenses',
            label: 'Market shock',
            assumption: 'Equity −30% today',
            finalWealth: shockResult.summary.finalWealth,
            wealthDelta: shockResult.summary.finalWealth - results.summary.finalWealth,
            coverage: computeCoverage(shockResult, inputs.retirementYear),
            fireYear: computeFireYear(shockResult, currentMonthlyExp, inputs),
            tone: 'danger',
            summary: ''
          },
          {
            key: 'fx',
            label: 'Rupee strengthens',
            assumption: '₹/$ −15%',
            finalWealth: fxResult.summary.finalWealth,
            wealthDelta: fxResult.summary.finalWealth - results.summary.finalWealth,
            coverage: computeCoverage(fxResult, inputs.retirementYear),
            fireYear: computeFireYear(fxResult, currentMonthlyExp, inputs),
            tone: 'warning',
            summary: ''
          }
        ].map((scenario) => ({
          ...scenario,
          tone: toneFromCoverage(scenario.coverage, inputs.retirementYear, scenario.fireYear),
          summary: buildSummary(scenario.coverage, inputs.retirementYear, scenario.fireYear)
        })) as SensitivityScenario[];

        if (!cancelled) {
          setScenarios(nextScenarios);
        }
      } catch (scenarioError) {
        if (!cancelled) {
          const message = scenarioError instanceof Error ? scenarioError.message : 'Failed to calculate sensitivity summary';
          setError(message);
          setScenarios([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [currentMonthlyExp, enabled, inputs, oneTimeExpenseTotal, results]);

  return {
    scenarios,
    isLoading,
    error
  };
}