import type { CalculationResults, CASParseResult, Expenses, Inputs, OneTimeExpenses } from '../types';

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

// Works both in local dev and on the deployed site, hitting a different
// implementation of the same /api/cas/parse contract in each: locally,
// server.js spawns a Python (casparser) subprocess (scripts/parse_cas.py);
// on Vercel, api/cas/parse.py runs natively as its own Python serverless
// function (Vercel's Node functions can't spawn a subprocess, but Vercel
// does run genuine Python functions — see requirements.txt at the repo
// root). Same request/response shape either way, so this call site needs no
// environment branching.
export async function parseCASStatement(fileBase64: string, password: string): Promise<CASParseResult> {
  const response = await fetch('/api/cas/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileBase64, password })
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.error || 'Failed to parse the CAS statement.';
    throw new Error(message);
  }

  return data as CASParseResult;
}
