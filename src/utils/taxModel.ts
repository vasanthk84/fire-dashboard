import type { CalculationResults, Inputs } from '../types';
import { fmtL } from './formatters';

// Shared constants/helpers for the app's per-bucket India tax model (FY2025-26/
// 26-27 rules), mirrored from api/calculate.js — the backend is the source of
// truth for the actual projections; this file only backs the lightweight
// pre-calculation estimates the UI shows before a server round-trip completes.
//   EPF / PPF                         -> 0% (EEE, tax-free withdrawal)
//   Equity MF + direct Indian stocks  -> 12.5% LTCG on the GAIN portion only,
//                                        above a Rs 1.25L/yr exemption (Sec 112A)
//   US stocks / Bonds / FD / NPS      -> your India income-tax slab rate
//                                        (debt-taxed assets get no LTCG/
//                                        indexation benefit)
export const LTCG_EXEMPTION_LAKHS = 1.25;
export const LTCG_RATE = 0.125;

export interface BucketComposition {
  taxFreeBase: number;
  equityBase: number;
  slabBase: number;
  liquidTotal: number;
  equityShare: number;
  slabShare: number;
  taxFreeShare: number;
}

export function bucketComposition(
  epf: number,
  ppf: number,
  mf: number,
  stocksIndia: number,
  usStocks: number,
  bonds: number,
  fd: number,
  nps: number
): BucketComposition {
  const taxFreeBase = epf + ppf;
  const equityBase = mf + stocksIndia;
  const slabBase = usStocks + bonds + fd + nps;
  const liquidTotal = taxFreeBase + equityBase + slabBase;

  return {
    taxFreeBase,
    equityBase,
    slabBase,
    liquidTotal,
    equityShare: liquidTotal > 0 ? equityBase / liquidTotal : 0,
    slabShare: liquidTotal > 0 ? slabBase / liquidTotal : 0,
    taxFreeShare: liquidTotal > 0 ? taxFreeBase / liquidTotal : 0
  };
}

// Approximate fraction of the equity bucket that is unrealized GAIN (vs
// principal), derived from your entered MF cost basis — the only principal
// figure tracked (no per-unit lot tracking). Applied uniformly to the whole
// equity bucket (MF + direct stocks) as a simplifying assumption.
export function equityGainFraction(mfCurrent: number, mfPrincipal: number): number {
  if (mfCurrent <= 0) return 0.5;
  return Math.max(0, Math.min(1, (mfCurrent - mfPrincipal) / mfCurrent));
}

// Quick pre-calculation estimate of the blended effective tax rate on
// withdrawals, used to gross up the FIRE target before a full server-side
// calculation is available. Ignores the Rs 1.25L/yr exemption, since it's
// small relative to a whole-corpus estimate — the real per-year exemption is
// applied server-side in api/calculate.js.
export function estimateTaxDragApprox(inputs: Inputs): number {
  if (!inputs.applyTax) return 0;

  const comp = bucketComposition(
    inputs.epfCurrent,
    inputs.ppfCurrent,
    inputs.mfCurrent,
    inputs.stocksIndia,
    inputs.usStocks,
    inputs.bondsInitial,
    inputs.fdCurrent,
    inputs.npsCurrent
  );

  if (comp.liquidTotal <= 0) return 0;

  const gainFrac = equityGainFraction(inputs.mfCurrent, inputs.mfPrincipal);
  return comp.equityShare * gainFrac * LTCG_RATE + comp.slabShare * (inputs.indiaSlabRatePct / 100);
}

export interface TaxChecklistItem {
  title: string;
  detail: string;
}

// Plain-language, legal tax-reduction techniques for post-retirement MF/SWP
// withdrawal, with the user's own numbers plugged in wherever the app already
// has them. Deliberately generic advice (not personalized tax planning) for
// the harder judgment calls — sequencing across multiple financial years,
// clubbing-of-income rules, etc. — where a real CA should have the final say.
export function buildTaxChecklist(results: CalculationResults, inputs: Inputs, rateLabel: string): TaxChecklistItem[] {
  const tm = results.summary.taxModel;
  const scenario = results.withdrawalScenarios[rateLabel] ?? [];
  const first = scenario[0];
  if (!tm || !first) return [];

  const annualGross = first.grossWithdrawalMonthly * 12;
  const equityWithdrawalAnnual = annualGross * tm.equityShareAtRetirement;
  const equityGainAnnual = equityWithdrawalAnnual * tm.equityGainFractionAtRetirement;
  const exemptionUsed = Math.min(equityGainAnnual, tm.ltcgExemptionLakhs);
  const exemptionHeadroom = Math.max(0, tm.ltcgExemptionLakhs - equityGainAnnual);

  const items: TaxChecklistItem[] = [];

  items.push({
    title: 'Use your full ₹1.25L LTCG exemption every year',
    detail: exemptionHeadroom > 0.01
      ? `At ${rateLabel} SWR you're realizing ~${fmtL(equityGainAnnual)}/yr of equity gain, using ${fmtL(exemptionUsed)} of the ₹1.25L exemption — ${fmtL(exemptionHeadroom)}/yr of tax-free headroom is going unused. Book (and immediately reinvest) gains up to the full exemption each FY even in years you don't need the cash — it resets your cost basis higher, tax-free, and shrinks future taxable gains.`
      : `At ${rateLabel} SWR you're already realizing ~${fmtL(equityGainAnnual)}/yr of equity gain, above the ₹1.25L exemption. For any large one-off equity sale, consider splitting it across two financial years (see below) instead of realizing it all at once.`
  });

  items.push({
    title: 'Tax-loss harvest in down years',
    detail: `India has no wash-sale rule — you can sell a losing equity position to book the capital loss, then immediately rebuy the same fund or stock. Losses offset gains realized in the same FY (short-term losses offset both short- and long-term gains; long-term losses only offset long-term gains), and unused losses carry forward up to 8 assessment years.`
  });

  items.push({
    title: 'Sequence withdrawals by tax bucket',
    detail: `Your retirement corpus is roughly ${(tm.taxFreeShareAtRetirement * 100).toFixed(0)}% tax-free (EPF/PPF), ${(tm.equityShareAtRetirement * 100).toFixed(0)}% equity (12.5% LTCG above the exemption), and ${(tm.slabShareAtRetirement * 100).toFixed(0)}% debt-taxed (FD/bonds/NPS/US stocks) at your ${inputs.indiaSlabRatePct}% slab rate. Lean on EPF/PPF and the equity exemption first; save FD/bond/NPS withdrawals for years your other income is already low, since that bucket is taxed in full at your slab rate with no exemption.`
  });

  items.push({
    title: 'Split large withdrawals across the FY boundary',
    detail: `If you ever need a lump sum bigger than one year's exemption can absorb, splitting the sale across late March and early April uses two financial years' ₹1.25L exemptions instead of one.`
  });

  items.push({
    title: 'Spousal income-splitting — know the limits',
    detail: `Investing in a non-earning spouse's name to get a second ₹1.25L exemption only works tax-free if the money is genuinely theirs (their own savings, inheritance, or gifts already taxed). Simply transferring your own funds to them triggers Section 64 clubbing rules, which tax the resulting gains back to you anyway.`
  });

  return items;
}
