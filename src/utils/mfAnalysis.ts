import type { MFBenchmarks, MFFundMetrics, MFTier, MutualFund } from '../types';
import { absoluteReturn, daysBetween, xirr, type CashFlow } from './xirr';

/** One row per scheme+plan; `members` holds one MFFundMetrics per folio that
 *  scheme is held under (almost always length 1 — grouping only becomes
 *  visible when a scheme genuinely has more than one folio). xirr/tier are
 *  computed by pooling every member folio's real transactions into one
 *  synthetic fund and running it through computeFundMetrics — the
 *  mathematically correct way to blend XIRRs (not an average of the
 *  per-folio rates). Shared between desktop's MutualFundsTab and the mobile
 *  Mutual Funds screen so both group the same scheme+plan the same way. */
export interface FundGroup {
  key: string;
  members: MFFundMetrics[];
  invested: number;
  currentValue: number;
  gain: number;
  combined: MFFundMetrics;
}

/** The same scheme can legitimately be held under more than one folio (two
 *  SIPs registered separately, for instance) — each folio is its own
 *  MutualFund with its own units/transactions, but showing them as two
 *  unlabeled full rows reads as an unexplained duplicate. Groups same
 *  scheme+plan rows together so the UI can show them as one entry that
 *  expands to reveal each folio individually. */
export function groupFundsByScheme(list: MFFundMetrics[], benchmarks: MFBenchmarks, tierThresholdPct: number): FundGroup[] {
  const byKey = new Map<string, MFFundMetrics[]>();
  for (const m of list) {
    const key = `${m.fund.name}|${m.fund.plan}`;
    const existing = byKey.get(key);
    if (existing) existing.push(m);
    else byKey.set(key, [m]);
  }
  return Array.from(byKey.values()).map((groupMembers) => {
    const first = groupMembers[0].fund;
    const combinedFund = {
      ...first,
      id: `group:${first.name}|${first.plan}`,
      currentValue: groupMembers.reduce((s, m) => s + m.fund.currentValue, 0),
      transactions: groupMembers.flatMap((m) => m.fund.transactions),
      importedCost: groupMembers.every((m) => m.fund.importedCost !== undefined)
        ? groupMembers.reduce((s, m) => s + (m.fund.importedCost ?? 0), 0)
        : undefined,
      closingUnits: groupMembers.every((m) => m.fund.closingUnits !== undefined)
        ? groupMembers.reduce((s, m) => s + (m.fund.closingUnits ?? 0), 0)
        : undefined,
      casKey: undefined,
      folio: undefined
    };
    return {
      key: `${first.name}|${first.plan}`,
      members: groupMembers,
      invested: groupMembers.reduce((s, m) => s + m.invested, 0),
      currentValue: combinedFund.currentValue,
      gain: groupMembers.reduce((s, m) => s + m.gain, 0),
      combined: computeFundMetrics(combinedFund, benchmarks, tierThresholdPct)
    };
  });
}

/** `MFTransaction.amount` is signed (positive = added to the fund, negative =
 *  taken out — the same convention CAS statements use), so the investor's cash
 *  flow is always just its negation. No per-type branching needed: a reversed
 *  SIP installment (negative "purchase") flips sign correctly with this one rule. */
export function fundCashFlows(fund: MutualFund, asOf: Date): CashFlow[] {
  const flows: CashFlow[] = fund.transactions
    .filter((t) => t.amount !== 0)
    .map((t) => ({ date: new Date(t.date), amount: -t.amount }));
  if (fund.currentValue > 0) {
    flows.push({ date: asOf, amount: fund.currentValue });
  }
  return flows;
}

/** Net cost basis still held in the fund — sum of the signed transaction
 *  amounts. Purchases/switch-ins/positive amounts add to it, redemptions/
 *  switch-outs/reversals (negative amounts) reduce it. This is a simplification
 *  (redemptions reduce basis by proceeds, not true FIFO cost of units sold —
 *  same approximation casparser's own running-cost figure avoids by tracking
 *  lots, which is why an imported fund's `currentValue`/cost use casparser's
 *  numbers directly rather than being re-derived from this). */
export function investedAmount(fund: MutualFund): number {
  return fund.transactions.reduce((sum, t) => sum + t.amount, 0);
}

export function earliestTransactionDate(fund: MutualFund): Date | null {
  if (fund.transactions.length === 0) return null;
  const earliest = fund.transactions.reduce((min, t) => (t.date < min ? t.date : min), fund.transactions[0].date);
  return new Date(earliest);
}

const CLOSED_UNITS_EPSILON = 0.001;

/** A fund imported from CAS is closed when casparser's own closing unit
 *  balance is ~0 — a full redemption, or a full switch-out to another
 *  scheme/plan (see the DSP Small Cap example: units land as a Switch In on
 *  the Direct-plan twin, and the Regular-plan source correctly zeroes out
 *  here even though its currentValue may still show a stale non-zero figure
 *  from before the switch). A manually-added fund has no unit data at all, so
 *  it falls back to currentValue <= 0. */
export function isFundClosed(fund: MutualFund): boolean {
  if (fund.closingUnits !== undefined) return Math.abs(fund.closingUnits) < CLOSED_UNITS_EPSILON;
  return fund.currentValue <= 0;
}

const YOUNG_HOLDING_DAYS = 90;

export function computeFundMetrics(
  fund: MutualFund,
  benchmarks: MFBenchmarks,
  tierThresholdPct: number,
  asOf: Date = new Date()
): MFFundMetrics {
  const invested = fund.importedCost ?? investedAmount(fund);
  const gain = fund.currentValue - invested;
  const gainPct = invested > 0 ? gain / invested : null;

  const earliest = earliestTransactionDate(fund);
  const holdingDays = earliest ? daysBetween(earliest, asOf) : 0;

  let rate: number | null = null;
  let usesAbsoluteReturn = false;

  if (fund.transactions.length > 0) {
    rate = xirr(fundCashFlows(fund, asOf));
  }

  // Fall back to plain absolute return when XIRR can't be solved, or when the
  // holding is too young for an annualized rate to mean anything (a single
  // 3-week-old SIP installment can "annualize" to a wild, misleading number).
  if ((rate === null || holdingDays < YOUNG_HOLDING_DAYS) && invested > 0) {
    const abs = absoluteReturn(invested, fund.currentValue);
    if (abs !== null) {
      rate = abs;
      usesAbsoluteReturn = true;
    }
  }

  const benchmark = (benchmarks[fund.category] ?? 12) / 100;
  const deltaVsBenchmark = rate !== null && !usesAbsoluteReturn ? rate - benchmark : null;

  let tier: MFTier | null = null;
  let tierReason = 'Add transactions to compute XIRR';

  if (usesAbsoluteReturn) {
    tierReason = holdingDays < YOUNG_HOLDING_DAYS
      ? `Held ${Math.round(holdingDays)}d — too new for an annualized rate, showing absolute return`
      : 'Absolute return shown — XIRR could not be solved from the transaction history';
  } else if (deltaVsBenchmark !== null && rate !== null) {
    const thresh = tierThresholdPct / 100;
    const pp = (deltaVsBenchmark * 100).toFixed(1);
    const rp = (rate * 100).toFixed(1);
    const bp = (benchmark * 100).toFixed(1);
    if (deltaVsBenchmark >= thresh) {
      tier = 1;
      tierReason = `${rp}% vs ${bp}% category benchmark — ahead by ${pp}pp`;
    } else if (deltaVsBenchmark <= -thresh) {
      tier = 3;
      tierReason = `${rp}% vs ${bp}% category benchmark — behind by ${Math.abs(Number(pp))}pp`;
    } else {
      tier = 2;
      tierReason = `${rp}% roughly in line with the ${bp}% category benchmark (within ${tierThresholdPct}pp)`;
    }
  }

  return {
    fund,
    invested,
    gain,
    gainPct,
    closed: isFundClosed(fund),
    xirr: rate,
    usesAbsoluteReturn,
    benchmark,
    deltaVsBenchmark,
    tier,
    tierReason,
    directTwinAvailable: fund.plan === 'regular'
  };
}

/** Portfolio-level XIRR: pools every fund's real cash flows into one series and
 *  solves once. This is the mathematically correct way to blend fund-level
 *  XIRRs — it is NOT a weighted average of the individual rates. */
export function portfolioXIRR(funds: MutualFund[], asOf: Date = new Date()): number | null {
  const allFlows = funds.flatMap((f) => fundCashFlows(f, asOf));
  return xirr(allFlows);
}
