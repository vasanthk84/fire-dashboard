/**
 * Step-up SIP future value projection — Section 5 of the MF build plan.
 * Runs monthly: contribution compounds at a fixed monthly rate, and steps up
 * by a fixed percentage every 12 months (flat / +10%/yr / +20%/yr).
 */

export interface SIPMonthPoint {
  month: number; // 0 = starting point
  balance: number;
  contribution: number; // the monthly contribution in effect that month (0 at month 0)
}

export function simulateStepUpSIP(
  startingCorpus: number,
  monthlyContribution: number,
  annualReturnPct: number,
  years: number,
  annualStepUpPct: number
): SIPMonthPoint[] {
  const monthlyRate = annualReturnPct / 12;
  const totalMonths = Math.max(0, Math.round(years * 12));
  let balance = startingCorpus;
  let contrib = monthlyContribution;
  const points: SIPMonthPoint[] = [{ month: 0, balance, contribution: 0 }];

  for (let m = 1; m <= totalMonths; m++) {
    if (m > 1 && (m - 1) % 12 === 0) {
      contrib = contrib * (1 + annualStepUpPct);
    }
    balance = balance * (1 + monthlyRate) + contrib;
    points.push({ month: m, balance, contribution: contrib });
  }

  return points;
}

export interface ProjectionScenarios {
  flat: SIPMonthPoint[];
  step10: SIPMonthPoint[];
  step20: SIPMonthPoint[];
}

export function projectScenarios(
  startingCorpus: number,
  monthlyContribution: number,
  annualReturnPct: number,
  years: number
): ProjectionScenarios {
  return {
    flat: simulateStepUpSIP(startingCorpus, monthlyContribution, annualReturnPct, years, 0),
    step10: simulateStepUpSIP(startingCorpus, monthlyContribution, annualReturnPct, years, 0.1),
    step20: simulateStepUpSIP(startingCorpus, monthlyContribution, annualReturnPct, years, 0.2)
  };
}

/** Yearly snapshots (every 12th month, plus the starting point) — what the chart & summary table plot. */
export function yearlyPoints(points: SIPMonthPoint[]): SIPMonthPoint[] {
  return points.filter((p) => p.month % 12 === 0);
}
