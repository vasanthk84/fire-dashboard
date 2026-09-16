import type { MFBenchmarks, MFFundMetrics, MFSipMandate, MFTier, MFTransaction, MutualFund } from '../types';
import { absoluteReturn, daysBetween, xirr, type CashFlow } from './xirr';
import { cleanFundDisplayName } from './mfCasImport';

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
    // Grouped by the cleaned display name, not the raw CAS scheme name — the
    // raw name is exactly the field that varies across AMC exports for what's
    // genuinely the same scheme (e.g. one export appends "(Non Demat)" and
    // another doesn't for the identical fund), which used to split one real
    // holding into two unlabeled-looking rows instead of a single grouped one.
    const key = `${cleanFundDisplayName(m.fund.name)}|${m.fund.plan}`;
    const existing = byKey.get(key);
    if (existing) existing.push(m);
    else byKey.set(key, [m]);
  }
  return Array.from(byKey.values()).map((groupMembers) => {
    const first = groupMembers[0].fund;
    const combinedFund = {
      ...first,
      id: `group:${cleanFundDisplayName(first.name)}|${first.plan}`,
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
      key: `${cleanFundDisplayName(first.name)}|${first.plan}`,
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

export interface MissedSipGap {
  afterDate: string; // the installment right before the gap
  beforeDate: string; // the installment right after the gap
  gapDays: number;
  expectedGapDays: number; // the fund's own typical (median) cadence
  approxMissedInstallments: number; // gapDays / expectedGapDays, rounded down, minus 1
}

export interface SipConsistencyResult {
  cadenceDays: number | null; // median gap between consecutive purchase-type transactions
  installmentCount: number;
  missedGaps: MissedSipGap[];
  // Cost of delay: for each missed-gap installment, what a same-size
  // contribution invested on the *expected* on-schedule date would have grown
  // to by today (at the fund's own realized XIRR) vs. what a contribution
  // invested on the *actual* later date grew to — the difference is what
  // irregularity in your own SIP cost you. This is entirely retrospective:
  // it uses the fund's own already-realized XIRR as the growth rate for both
  // legs of the comparison, so it is not a forecast of anything — it only
  // asks "what would timing alone have changed, holding the real rate fixed."
  costOfDelay: number | null;
}

const MISSED_GAP_MULTIPLIER = 1.6; // a gap this many times the median cadence counts as "missed", not just calendar jitter (weekends/holidays)

/** Detects irregular/missed SIP installments from a fund's own real purchase
 *  transaction dates, and quantifies what that irregularity cost using the
 *  fund's own realized XIRR (never an assumed or forecast rate). Only
 *  'purchase' transactions count (SIP installments map to this type — see
 *  mfCasImport.ts's CAS_TYPE_MAP); switchIn/switchOut are excluded since
 *  those aren't a recurring SIP cadence. Returns cadenceDays: null when there
 *  are fewer than 3 purchases (not enough gaps to establish a median cadence). */
export function analyzeSipConsistency(fund: MutualFund, xirrRate: number | null, asOf: Date = new Date()): SipConsistencyResult {
  const purchases = purchaseTransactions(fund);

  if (purchases.length < 3) {
    return { cadenceDays: null, installmentCount: purchases.length, missedGaps: [], costOfDelay: null };
  }

  const gaps: number[] = [];
  for (let i = 1; i < purchases.length; i++) {
    gaps.push(daysBetween(new Date(purchases[i - 1].date), new Date(purchases[i].date)));
  }
  const sortedGaps = [...gaps].sort((a, b) => a - b);
  const cadenceDays = sortedGaps[Math.floor(sortedGaps.length / 2)];

  const missedGaps: MissedSipGap[] = [];
  let costOfDelay = 0;
  let hasCost = false;

  for (let i = 1; i < purchases.length; i++) {
    const gapDays = gaps[i - 1];
    if (gapDays < cadenceDays * MISSED_GAP_MULTIPLIER) continue;

    const approxMissed = Math.max(1, Math.round(gapDays / cadenceDays) - 1);
    missedGaps.push({
      afterDate: purchases[i - 1].date,
      beforeDate: purchases[i].date,
      gapDays,
      expectedGapDays: cadenceDays,
      approxMissedInstallments: approxMissed
    });

    if (xirrRate !== null && Number.isFinite(xirrRate)) {
      const actualDate = new Date(purchases[i].date);
      const expectedDate = new Date(new Date(purchases[i - 1].date).getTime() + cadenceDays * 86400000);
      const daysLate = daysBetween(expectedDate, actualDate);
      if (daysLate > 0) {
        const yearsFromExpectedToNow = daysBetween(expectedDate, asOf) / 365.25;
        const yearsFromActualToNow = daysBetween(actualDate, asOf) / 365.25;
        const amt = purchases[i].amount;
        const grownIfOnTime = amt * Math.pow(1 + xirrRate, yearsFromExpectedToNow);
        const grownActual = amt * Math.pow(1 + xirrRate, yearsFromActualToNow);
        costOfDelay += grownIfOnTime - grownActual;
        hasCost = true;
      }
    }
  }

  return { cadenceDays, installmentCount: purchases.length, missedGaps, costOfDelay: hasCost ? costOfDelay : null };
}

function purchaseTransactions(fund: MutualFund) {
  return fund.transactions
    .filter((t) => t.type === 'purchase' && t.amount > 0)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface SipStreamStatus {
  cadenceDays: number;
  averageAmount: number; // mean of the last up-to-5 installments in this stream, smooths one-off variation
  lastInstallmentDate: string;
  // Inferred from this stream's own past pattern — NOT a confirmed mandate
  // (see SipStatus doc comment). Always surfaced as "expected".
  expectedNextDate: string | null;
  daysUntilNext: number | null; // negative = already overdue relative to the inferred cadence
}

export interface SipStatus {
  isActive: boolean;
  // One fund can genuinely carry more than one concurrent SIP registration
  // (confirmed on a real fund in this app's data: two interleaved ~monthly
  // ₹5,500 installments landing on different days of the month, e.g. the
  // 1st and the 4th, summing to an ₹11,000/month real contribution rate —
  // a single median-gap-over-all-purchases calculation would see roughly
  // double the installment frequency of either real stream and derive a
  // meaningless "cadence"). Purchases are clustered by day-of-month into
  // separate streams first; each stream gets its own cadence/amount/next-date,
  // and totalAverageAmount is the sum across all active streams — the real
  // cumulative monthly SIP figure.
  streams: SipStreamStatus[];
  totalAverageAmount: number | null;
  nextDueDate: string | null; // soonest expectedNextDate across all streams
  // Inferred from the fund's own past pattern — this is NOT the fund's actual
  // registered SIP mandate (CAS/casparser carries no such field, only
  // transactions that already happened), so it can be wrong if the SIP amount
  // or date was changed, or paused, since the last installment. Always
  // surfaced as "expected", never as a confirmed fact.
}

const SIP_ACTIVE_WINDOW_MULTIPLIER = 1.5; // last installment must be within this many cadence-lengths of today to still count as "active" (vs. a SIP that quietly stopped)
const MIN_INSTALLMENTS_FOR_SIP = 3;
const MIN_MONTHLY_CADENCE_DAYS = 20; // a real monthly SIP's own gaps should median around ~28-31 days; a group whose median gap is well under this is actually >=2 interleaved streams, not one irregular one
const RECENT_WINDOW_MONTHS = 12; // only recent history is used to detect current SIP streams — a fund tracked for years can have gone through several different amounts/plans over time (confirmed on real data), and mixing eras into one amount-grouping pass would misread a since-changed old SIP as a second concurrent one

/** Groups a fund's RECENT purchases into distinct concurrent SIP streams —
 *  see SipStatus.streams doc comment for why this is necessary (real funds in
 *  this app's data carry more than one SIP registration at once, sometimes
 *  at different amounts, sometimes the SAME amount offset by half a cycle:
 *  confirmed on real data, two ₹5,500 streams landing on ~day 1 and ~day 4 of
 *  each month — a day-of-month clustering approach can't tell that apart
 *  from one irregular stream, since both installments fall inside any
 *  reasonable "same stream" day-of-month window).
 *
 *  Two-pass approach instead: (1) restrict to the last RECENT_WINDOW_MONTHS
 *  and group by amount (rounded to ₹100) — this separates same-fund SIPs
 *  registered at different amounts and avoids conflating an old, since-
 *  changed SIP amount with a currently-active one; (2) within each amount
 *  group, check whether its OWN median gap is consistent with a single
 *  monthly SIP (~20+ days). If the gap is much shorter, that amount group
 *  actually contains 2+ same-amount streams interleaved — split it by
 *  chronological parity (every Nth installment) into that many sub-streams,
 *  the correct de-interleaving for evenly-offset concurrent SIPs of the same
 *  amount. */
function clusterIntoSipStreams(purchases: MFTransaction[], asOf: Date): MFTransaction[][] {
  const cutoff = new Date(asOf);
  cutoff.setMonth(cutoff.getMonth() - RECENT_WINDOW_MONTHS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const recent = purchases.filter((t) => t.date >= cutoffStr);

  const byAmount = new Map<number, MFTransaction[]>();
  for (const t of recent) {
    const key = Math.round(t.amount / 100) * 100;
    const list = byAmount.get(key);
    if (list) list.push(t);
    else byAmount.set(key, [t]);
  }

  const streams: MFTransaction[][] = [];
  for (const group of byAmount.values()) {
    const sorted = group.slice().sort((a, b) => a.date.localeCompare(b.date));
    if (sorted.length < MIN_INSTALLMENTS_FOR_SIP) {
      streams.push(sorted);
      continue;
    }

    const gaps = sorted.slice(1).map((t, i) => daysBetween(new Date(sorted[i].date), new Date(t.date)));
    const medianGap = [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)];

    if (medianGap >= MIN_MONTHLY_CADENCE_DAYS) {
      streams.push(sorted);
      continue;
    }

    // Interleaved: N concurrent monthly streams evenly offset produce gaps
    // that alternate between N-1 "short" (the offset) and 1 "long" (~30 days
    // minus the sum of the short ones) per full cycle — their MEDIAN gap is
    // one of the short ones, not 30/N, so dividing 30 by it overshoots badly
    // (confirmed on real data: two ~30-day streams offset by 3-5 days give a
    // median gap of 5, wrongly implying 6 streams via naive division). Taking
    // every Nth installment (de-interleaving) is still the right operation —
    // just tested directly for increasing N until the resulting sub-streams'
    // OWN gaps land in the real monthly range, rather than derived from the
    // raw median by a formula that only holds when the offset is 30/N.
    let subStreams: MFTransaction[][] = [sorted];
    for (let n = 2; n <= 4 && sorted.length / n >= MIN_INSTALLMENTS_FOR_SIP; n++) {
      const candidate: MFTransaction[][] = Array.from({ length: n }, () => []);
      sorted.forEach((t, i) => candidate[i % n].push(t));
      const candidateGapsOk = candidate.every((s) => {
        if (s.length < 2) return true;
        const g = s.slice(1).map((t, i) => daysBetween(new Date(s[i].date), new Date(t.date)));
        const med = [...g].sort((a, b) => a - b)[Math.floor(g.length / 2)];
        return med >= MIN_MONTHLY_CADENCE_DAYS;
      });
      if (candidateGapsOk) {
        subStreams = candidate;
        break;
      }
    }
    for (const s of subStreams) if (s.length > 0) streams.push(s);
  }

  return streams;
}

function analyzeStream(stream: MFTransaction[], asOf: Date): SipStreamStatus | null {
  if (stream.length < MIN_INSTALLMENTS_FOR_SIP) return null;

  const gaps: number[] = [];
  for (let i = 1; i < stream.length; i++) {
    gaps.push(daysBetween(new Date(stream[i - 1].date), new Date(stream[i].date)));
  }
  const sortedGaps = [...gaps].sort((a, b) => a - b);
  const cadenceDays = sortedGaps[Math.floor(sortedGaps.length / 2)];

  const last = stream[stream.length - 1];
  const daysSinceLast = daysBetween(new Date(last.date), asOf);
  const isActive = daysSinceLast <= cadenceDays * SIP_ACTIVE_WINDOW_MULTIPLIER;

  // The "typical" installment amount for this stream — the MODE of the last
  // several installments' amounts (each rounded to the nearest ₹100 first),
  // not their mean. A plain average is wrong here: day-of-month clustering
  // groups a stream by date proximity, not amount, so a one-off partial/extra
  // top-up landing a day or two off-schedule (confirmed on real data: a
  // steady ₹9,000/month SIP with one ₹1,999.90 installment squeezed in the
  // day before its regular date) lands in the same cluster and would drag a
  // naive average down to a number that matches neither the SIP nor the
  // outlier. Taking the most common rounded amount instead reports the real
  // recurring SIP value and treats the outlier as what it is — noise.
  const roundedAmounts = stream.slice(-8).map((t) => Math.round(t.amount / 100) * 100);
  const countByAmount = new Map<number, number>();
  for (const amt of roundedAmounts) countByAmount.set(amt, (countByAmount.get(amt) ?? 0) + 1);
  let averageAmount = roundedAmounts[roundedAmounts.length - 1];
  let bestCount = 0;
  for (const [amt, count] of countByAmount) {
    if (count > bestCount) {
      bestCount = count;
      averageAmount = amt;
    }
  }

  const expectedNext = new Date(new Date(last.date).getTime() + cadenceDays * 86400000);
  const daysUntilNext = Math.round((expectedNext.getTime() - asOf.getTime()) / 86400000);

  return {
    cadenceDays,
    averageAmount,
    lastInstallmentDate: last.date,
    expectedNextDate: isActive ? expectedNext.toISOString().slice(0, 10) : null,
    daysUntilNext: isActive ? daysUntilNext : null
  };
}

/** Builds the next occurrence of `dayOfMonth` on/after `asOf` (this month if
 *  it hasn't passed yet, otherwise next month) as an ISO date, plus how many
 *  days away that is. Clamps to the last real day of the target month so a
 *  mandate registered for the 31st doesn't produce an invalid date in a
 *  30-day (or February) month. */
function nextOccurrenceOfDay(dayOfMonth: number, asOf: Date): { date: string; daysUntil: number } {
  const year = asOf.getFullYear();
  const month = asOf.getMonth();
  const clampedDay = (y: number, m: number) => Math.min(dayOfMonth, new Date(y, m + 1, 0).getDate());

  let candidate = new Date(year, month, clampedDay(year, month));
  if (candidate < asOf) {
    const nextMonth = month + 1;
    candidate = new Date(year, nextMonth, clampedDay(year, nextMonth));
  }
  const daysUntil = Math.round((candidate.getTime() - asOf.getTime()) / 86400000);
  return { date: candidate.toISOString().slice(0, 10), daysUntil };
}

/** A confirmed SIP mandate (see MFSipMandate doc comment) is authoritative —
 *  it's what the user's broker/AMC actually has on file, not an inference —
 *  so it's turned directly into a SipStreamStatus rather than run through
 *  the pattern-detection machinery below. cadenceDays is fixed at 30 (a
 *  monthly mandate by definition); lastInstallmentDate looks for a real
 *  transaction near the expected day so the UI can still show when it last
 *  actually processed, falling back to the mandate's own next date if none
 *  is found yet (a brand-new mandate with no transactions yet). */
function streamFromMandate(mandate: MFSipMandate, purchases: MFTransaction[], asOf: Date): SipStreamStatus {
  const { date: expectedNextDate, daysUntil: daysUntilNext } = nextOccurrenceOfDay(mandate.dayOfMonth, asOf);
  const nearMatch = purchases
    .slice()
    .reverse()
    .find((t) => Math.abs(dayOfMonth(t.date) - mandate.dayOfMonth) <= 3);

  return {
    cadenceDays: 30,
    averageAmount: mandate.amount,
    lastInstallmentDate: nearMatch?.date ?? expectedNextDate,
    expectedNextDate,
    daysUntilNext
  };
}

function dayOfMonth(isoDate: string): number {
  return Number(isoDate.slice(8, 10));
}

/** Classifies a fund as having one or more active, ongoing SIP streams.
 *  Confirmed mandates (fund.sipMandates — entered directly from the user's
 *  broker/AMC) are used when present, since they're ground truth; otherwise
 *  falls back to inferring streams purely from the fund's own purchase
 *  transaction history — see SipStatus doc comment for why a fund can have
 *  more than one concurrent stream, and why inference alone is never a
 *  confirmed mandate (it can be wrong, especially for a SIP that's new or
 *  whose amount hasn't settled into a repeating pattern yet). */
export function detectSipStatus(fund: MutualFund, asOf: Date = new Date()): SipStatus {
  if (fund.sipMandates && fund.sipMandates.length > 0) {
    const purchases = purchaseTransactions(fund);
    const streams = fund.sipMandates.map((m) => streamFromMandate(m, purchases, asOf));
    const totalAverageAmount = streams.reduce((s, x) => s + x.averageAmount, 0);
    const nextDueDate = streams.reduce((soonest, s) => (s.expectedNextDate! < soonest ? s.expectedNextDate! : soonest), streams[0].expectedNextDate!);
    return { isActive: true, streams, totalAverageAmount, nextDueDate };
  }

  const purchases = purchaseTransactions(fund);
  if (purchases.length < MIN_INSTALLMENTS_FOR_SIP) {
    return { isActive: false, streams: [], totalAverageAmount: null, nextDueDate: null };
  }

  const streams = clusterIntoSipStreams(purchases, asOf)
    .map((stream) => analyzeStream(stream, asOf))
    .filter((s): s is SipStreamStatus => s !== null);

  const activeStreams = streams.filter((s) => s.expectedNextDate !== null);
  if (activeStreams.length === 0) {
    return { isActive: false, streams, totalAverageAmount: null, nextDueDate: null };
  }

  const totalAverageAmount = activeStreams.reduce((s, x) => s + x.averageAmount, 0);
  const nextDueDate = activeStreams.reduce(
    (soonest, s) => (s.expectedNextDate! < soonest ? s.expectedNextDate! : soonest),
    activeStreams[0].expectedNextDate!
  );

  return { isActive: true, streams: activeStreams, totalAverageAmount, nextDueDate };
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
