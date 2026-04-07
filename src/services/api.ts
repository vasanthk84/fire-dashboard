import type { CalculationResults, Expenses, Inputs, OneTimeExpenses } from '../types';

export async function calculatePlan(payload: Partial<Inputs>): Promise<CalculationResults> {
  const response = await fetch('/api/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error('Failed to calculate FIRE plan');
  }

  return response.json();
}

export async function downloadPlanExcel(data: CalculationResults, expenses: Expenses, oneTimeExpenses: OneTimeExpenses, inputs: Inputs): Promise<void> {
  const response = await fetch('/api/generate-excel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, expenses, oneTimeExpenses, inputs })
  });

  if (!response.ok) {
    throw new Error('Failed to generate Excel');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'FIRE_Freedom_Plan_Pro.xlsx';
  anchor.click();
  window.URL.revokeObjectURL(url);
}
