/**
 * Actual realized options/F&O P&L, proxied server-side from trade-analytics
 * (see api/trading-income.js — the Bearer token stays server-side, this
 * client call is unauthenticated same-origin, same pattern as cloudSync.ts).
 */
export interface TradingIncomeFY {
  fy: string;
  foNet: number;
  eqNet: number;
  combinedNet: number;
  foTrades: number;
  eqTrades: number;
}

export interface TradingIncomeResponse {
  configured: boolean;
  error?: string;
  asOf?: string;
  currentFY?: TradingIncomeFY;
  allTime?: Omit<TradingIncomeFY, 'fy'>;
}

export async function fetchTradingIncome(): Promise<TradingIncomeResponse> {
  const response = await fetch('/api/trading-income');
  if (!response.ok) throw new Error('Could not reach /api/trading-income.');
  return response.json();
}
