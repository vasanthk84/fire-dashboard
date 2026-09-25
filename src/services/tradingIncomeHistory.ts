/**
 * Read-only history of the automatic monthly assumed-vs-actual capture (see
 * api/monthly-income-snapshot.js). No auth needed for reads — same
 * "aggregate P&L only, not sensitive" precedent as tradingIncome.ts.
 */
export interface TradingIncomeSnapshotEntry {
  month: string; // "YYYY-MM", the calendar month the capture ran
  capturedAt: string;
  assumedPortfolioLakhs: number;
  assumedYieldPct: number; // already ×100 — a percentage, not a 0-1 fraction
  actualAnnualizedPct: number;
  totalPnlSinceStart: number; // ₹, gross F&O, since the wheeling strategy started
  monthsOfData: number;
  diverges: boolean;
}

export interface TradingIncomeHistoryResponse {
  configured: boolean;
  error?: string;
  history: TradingIncomeSnapshotEntry[];
}

export async function fetchTradingIncomeHistory(): Promise<TradingIncomeHistoryResponse> {
  const response = await fetch('/api/monthly-income-snapshot');
  if (!response.ok) throw new Error('Could not reach /api/monthly-income-snapshot.');
  return response.json();
}
