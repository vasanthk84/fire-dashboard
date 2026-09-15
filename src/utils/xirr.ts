/**
 * XIRR (extended internal rate of return) and related mutual-fund analytics.
 *
 * XIRR annualizes a return across irregularly-dated cash flows — exactly what
 * SIPs, lump sums, switches and redemptions produce. Convention used here
 * (matches CAMS/KFintech CAS statements and every MF tracker): purchases /
 * SIP installments / switch-ins are NEGATIVE cash flows (money leaving your
 * pocket into the fund); redemptions, switch-outs and the fund's current
 * value (treated as a hypothetical redemption "today") are POSITIVE.
 */

export interface CashFlow {
  date: Date;
  amount: number;
}

const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;

function npv(rate: number, flows: CashFlow[], t0: number): number {
  return flows.reduce((sum, cf) => {
    const years = (cf.date.getTime() - t0) / MS_PER_YEAR;
    return sum + cf.amount / Math.pow(1 + rate, years);
  }, 0);
}

function dNpv(rate: number, flows: CashFlow[], t0: number): number {
  return flows.reduce((sum, cf) => {
    const years = (cf.date.getTime() - t0) / MS_PER_YEAR;
    if (years === 0) return sum;
    return sum - (years * cf.amount) / Math.pow(1 + rate, years + 1);
  }, 0);
}

/**
 * Solves for XIRR via Newton-Raphson with a bisection fallback. Returns null
 * when there aren't at least one negative and one positive flow (no solvable
 * rate exists) or the solver fails to converge in a sane range.
 */
export function xirr(flows: CashFlow[], guess = 0.12): number | null {
  const sorted = [...flows].filter((f) => f.amount !== 0).sort((a, b) => a.date.getTime() - b.date.getTime());
  if (sorted.length < 2) return null;

  const hasPos = sorted.some((f) => f.amount > 0);
  const hasNeg = sorted.some((f) => f.amount < 0);
  if (!hasPos || !hasNeg) return null;

  const t0 = sorted[0].date.getTime();

  // Newton-Raphson
  let rate = guess;
  let converged = false;
  for (let i = 0; i < 100; i++) {
    const f = npv(rate, sorted, t0);
    const df = dNpv(rate, sorted, t0);
    if (Math.abs(df) < 1e-12) break;
    let next = rate - f / df;
    if (!Number.isFinite(next) || next <= -0.999999) next = (rate + -0.999999) / 2;
    if (Math.abs(next - rate) < 1e-9) {
      rate = next;
      converged = true;
      break;
    }
    rate = next;
  }

  if (converged && Number.isFinite(rate) && rate > -0.999999 && rate < 100) {
    return rate;
  }

  // Bisection fallback over a wide, sane range — slower but always converges
  // for a well-posed problem (one sign change in NPV(rate)).
  let lo = -0.999;
  let hi = 10;
  let fLo = npv(lo, sorted, t0);
  let fHi = npv(hi, sorted, t0);
  if (Number.isNaN(fLo) || Number.isNaN(fHi) || fLo * fHi > 0) {
    return null;
  }
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid, sorted, t0);
    if (Math.abs(fMid) < 1e-6) return mid;
    if (fLo * fMid < 0) {
      hi = mid;
      fHi = fMid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  return (lo + hi) / 2;
}

/** Simple absolute return: (current - invested) / invested. Used as a fallback
 *  when a holding is too young ( < ~90 days) for XIRR to be meaningful. */
export function absoluteReturn(invested: number, current: number): number | null {
  if (invested <= 0) return null;
  return (current - invested) / invested;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.abs(b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000);
}
