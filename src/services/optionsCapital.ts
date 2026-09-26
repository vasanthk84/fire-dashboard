/**
 * Actual capital deployed in open CC/CSP wheel cycles, proxied server-side
 * from oi-analyzer (see api/options-capital.js — the Bearer token stays
 * server-side, this client call is unauthenticated same-origin, same
 * pattern as cloudSync.ts and tradingIncome.ts).
 */
export interface OptionsCapitalResponse {
  configured: boolean;
  error?: string;
  asOf?: string;
  openingBalanceRupees?: number;
  availableMarginRupees?: number;
  blockedMarginRupees?: number;
}

export async function fetchOptionsCapital(): Promise<OptionsCapitalResponse> {
  const response = await fetch('/api/options-capital');
  if (!response.ok) throw new Error('Could not reach /api/options-capital.');
  return response.json();
}
