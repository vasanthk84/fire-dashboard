export type TabKey = 'journey' | 'risk' | 'expenses' | 'withdrawal' | 'mutualFunds' | 'snapshots' | 'retirement401k' | 'pfReinvest';

// --- Mutual Fund XIRR & Allocation module ---------------------------------

export type MFCategory =
  | 'largeCap'
  | 'flexiCap'
  | 'midCap'
  | 'smallCap'
  | 'elss'
  | 'index'
  | 'hybrid'
  | 'debt'
  | 'international';

export type MFPlan = 'direct' | 'regular';

export type MFTxnType = 'purchase' | 'redemption' | 'switchIn' | 'switchOut' | 'reversal';

export interface MFTransaction {
  id: string;
  date: string; // ISO yyyy-mm-dd
  type: MFTxnType;
  // SIGNED ₹, same convention CAMS/KFintech CAS statements use: positive when
  // the transaction added money to the fund (purchase/SIP/switch-in), negative
  // when it took money out (redemption/switch-out) — including a reversed/
  // bounced SIP installment, which CAS shows as a negative "purchase". XIRR
  // negates this once (investor cash flow = -amount) with no per-type branching,
  // so a reversal just works without a special case. The manual "Add
  // transaction" form still asks for a plain positive number and applies the
  // sign itself based on the type picked.
  amount: number;
  units?: number;
}

export interface MutualFund {
  id: string;
  name: string;
  category: MFCategory;
  plan: MFPlan;
  currentValue: number; // ₹, latest valuation (manually updated, or refreshed on CAS re-import)
  asOfDate: string; // ISO date the currentValue was last updated
  transactions: MFTransaction[];
  notes?: string;
  // Present when this fund came from a CAS import: `${folio}|${isin}`, used to
  // detect the same holding on a later re-import (updates in place instead of
  // creating a duplicate fund).
  casKey?: string;
  // The raw folio number this holding is under, as CAS reports it. The same
  // scheme can legitimately be held under more than one folio (e.g. two SIPs
  // registered separately) — each folio is its own holding with its own units
  // and transaction history, so they stay separate MutualFund records, but
  // the UI groups same-scheme rows together and shows this to explain why
  // more than one row exists for what looks like "the same fund".
  folio?: string;
  // Cumulative stamp duty + STT seen for this fund in an imported CAS, ₹.
  // Informational only — deliberately excluded from the transaction ledger and
  // from XIRR, since it's a tax on the purchase, not part of the fund's return.
  charges?: number;
  // Cost basis as CAS itself reports it (casparser's per-scheme valuation.cost),
  // set on import. Preferred over summing signed transaction amounts, because
  // that naive sum undercounts invested capital whenever a redemption realized
  // a gain — a redemption's proceeds exceed the cost of the units sold, so
  // "purchases minus redemption proceeds" isn't the same as "cost of units still
  // held". Manually-added funds have no such figure and fall back to the sum.
  importedCost?: number;
  // Closing unit balance as CAS itself reports it (casparser's per-scheme
  // `close`), set on import. This is the authoritative signal for "is this
  // holding still open" — far more reliable than inferring it from
  // currentValue (which can legitimately be stale/zero before a revaluation)
  // or from summing signed transaction amounts (which drifts from real unit
  // balances due to NAV rounding). ~0 means fully redeemed/switched out.
  // Manually-added funds have no such figure and are treated as open unless
  // currentValue is 0.
  closingUnits?: number;
  // Systematic Transfer Plans set up FROM this fund. A single source fund can
  // legitimately feed more than one destination on different schedules (e.g.
  // Axis Large Cap -> Axis Small Cap over 24 months, and separately -> Axis
  // Multicap over 6 months) — this is purely a tracking/reminder layer, not
  // connected to the transaction ledger or XIRR; the actual switchOut/switchIn
  // transactions each STP installment produces are still entered normally (via
  // CAS import or manual entry) and are what XIRR/gain are computed from.
  stpPlans?: MFStpPlan[];
  // Confirmed SIP mandate(s) for this fund, entered directly from the user's
  // broker/AMC (e.g. a Paytm Money "SIP schedule" screen) — a fund can
  // genuinely run more than one concurrent SIP at different amounts/dates
  // (confirmed on real data: quant Small Cap Fund runs ₹6,000 on the 1st AND
  // ₹5,000 on the 18th as two separate registered mandates). When present,
  // these take precedence over detectSipStatus's inferred pattern (see
  // mfAnalysis.ts) for this fund — a confirmed mandate is authoritative,
  // while inference is only ever a best-effort fallback for funds the user
  // hasn't entered a mandate for. Never affects XIRR/gain — purely a
  // tracking/display layer, same as stpPlans.
  sipMandates?: MFSipMandate[];
}

export interface MFStpPlan {
  id: string;
  destinationFundName: string; // free text — the destination may or may not be a fund already tracked here
  totalMonths: number;
  startDate: string; // ISO yyyy-mm-dd
  notes?: string;
}

export interface MFSipMandate {
  id: string;
  amount: number; // ₹, as registered with the AMC/broker
  dayOfMonth: number; // 1-31
  notes?: string;
}

export type MFBenchmarks = Record<MFCategory, number>; // annual % used as the category benchmark for tiering

export type MFTier = 1 | 2 | 3;

export interface MFFundMetrics {
  fund: MutualFund;
  invested: number; // net amount put in (purchases + switchIns - redemptions - switchOuts), i.e. cost basis still in the fund
  gain: number; // currentValue - invested
  gainPct: number | null;
  // True when this holding has been fully exited — either CAS reports ~0
  // closing units (a full redemption, or a full switch-out to another
  // scheme/plan), or (for manually-added funds with no unit data) currentValue
  // is 0. A closed fund's historical transactions still count in XIRR/gain,
  // but it's shown in a separate "Redeemed" bucket instead of the active table.
  closed: boolean;
  xirr: number | null; // decimal, e.g. 0.132 = 13.2%
  usesAbsoluteReturn: boolean; // true when the holding is too new for XIRR and we fell back to absolute return
  benchmark: number; // decimal
  deltaVsBenchmark: number | null; // xirr - benchmark, decimal
  tier: MFTier | null;
  tierReason: string;
  directTwinAvailable: boolean; // plan === 'regular', flagged as a separate, tier-independent opportunity
}

export interface MFPortfolioData {
  funds: MutualFund[];
  benchmarks: MFBenchmarks;
  tierThresholdPct: number; // +/- percentage points around benchmark that defines Tier 2 (Maintain)
}

// --- CAS import (casparser JSON shape, as produced by scripts/parse_cas.py) ---
// Loosely typed to match casparser's `read_cas_pdf(..., output="json")` output
// for CAMS/KFintech DETAILED statements. Numeric fields arrive as strings (or
// null for annotation-only rows) — the import mapper is responsible for
// converting them.

export interface CASTransactionRaw {
  date: string; // yyyy-mm-dd
  description: string;
  amount: string | null;
  units: string | null;
  nav: string | null;
  balance: string | null;
  type: string; // 'PURCHASE' | 'PURCHASE_SIP' | 'REDEMPTION' | 'SWITCH_IN' | 'SWITCH_OUT' | 'REVERSAL' | 'STAMP_DUTY_TAX' | 'STT_TAX' | 'MISC' | others
  dividend_rate: string | null;
  gift_folio: string | null;
}

export interface CASSchemeRaw {
  scheme: string;
  advisor: string | null;
  rta_code: string;
  rta: string;
  type: string; // 'EQUITY' | 'DEBT' | 'HYBRID' | ...
  isin: string;
  amfi: string;
  nominees: string[];
  open: number;
  close: number;
  close_calculated: number;
  valuation: { date: string; nav: string; cost: string; value: string };
  transactions: CASTransactionRaw[];
}

export interface CASFolioRaw {
  folio: string;
  amc: string;
  name: string;
  PAN: string;
  KYC: string;
  PANKYC: string;
  schemes: CASSchemeRaw[];
}

export interface CASParseResult {
  statement_period: { from: string; to: string };
  folios: CASFolioRaw[];
  investor_info: { name: string; email: string; address: string; mobile: string };
  cas_type: string;
  file_type: string;
  parse_warnings: string[];
}

export interface Inputs {
  startYear: number;
  startMonth: number;   // 1-12
  currentAge: number;
  retirementYear: number;
  returnYear: number;
  withdraw401kYear: number;
  retirementIncomeTaxRate: number;
  mfCurrent: number;
  mfPrincipal: number;
  stocksIndia: number;
  usStocks: number;
  us401k: number;
  usdExchangeRate: number;
  epfCurrent: number;
  basicPay: number;
  epfRate: number;
  vpfRate: number;

  // --- PPF (Public Provident Fund) ---
  // Matured account: no further interest accrues and no further contributions
  // are made, so the balance is carried forward idle (flat) in the projection.
  ppfCurrent: number; // ₹L, current (matured/idle) PPF balance

  // --- Fixed Deposits ---
  fdCurrent: number;   // ₹L, current FD balance
  fdRatePct: number;   // annual %, simple compounding

  // --- NPS (National Pension System) ---
  npsCurrent: number;  // ₹L, current NPS balance
  npsRatePct: number;  // annual %, simple compounding

  bondsInitial: number;
  bondAnnualIncrease: number;
  bondRate: number;
  mfSIP: number;
  sipStepUpRate: number;
  optionsPortfolioValue: number;
  optionsYieldPct: number;
  annualSalary: number;
  mfRate: number;
  stocksRate: number;
  usRate: number;
  inflationRate: number;
  postFireRate: number;
  abroadMonthlyExpenses: number;  // pre-returnYear expense level (display only, doesn't change FIRE target)
  monthlyExpenses: number;
  oneTimeExpenseTotal: number;
  applyTax: boolean;
  // Your expected India income-tax slab rate in retirement (%). Applied to the
  // "slab-taxed" bucket (US stocks, bonds, FD, NPS) — these get no LTCG or
  // indexation benefit. Equity MF/stocks are taxed separately at 12.5% LTCG
  // above the Rs 1.25L/yr exemption; EPF/PPF stay tax-free.
  indiaSlabRatePct: number;
  fireMultiplier: number;
  enableRebalancing: boolean;
  targetEquityPre: number;
  targetEquityPost: number;
  glideYears: number;

  // --- 401k Projector ---
  us401kContribPct: number;      // employee 401k contribution, e.g. 0.05
  us401kEmployerMatchPct: number; // employer match, e.g. 0.04

  // --- PF Closure & Reinvestment ---
  pfWithdrawalMonth: number;      // 1-12, month PF/gratuity/superannuation are withdrawn
  pfWithdrawalYear: number;       // year PF is closed and withdrawn
  gratuityAmount: number;         // ₹ gratuity payout at separation
  superannuationBalance: number;  // ₹ TCS superannuation fund balance (per latest statement)
  superMonthlyContribution: number; // ₹ latest observed monthly employer contribution to superannuation
  superInterestRatePct: number;   // annual %, implied from the superannuation statement's interest credit
  superCommutationPct: number;    // fraction of superannuation taken as tax-free lump sum (1/3, 1/2, or 0 for full annuity)
  annuityRatePct: number;         // assumed annual payout rate on the annuitised superannuation portion, e.g. 0.06
  pfCashAllocPct: number;         // % of withdrawn PF+gratuity+super-lump kept as cash (savings account)
  pfCashRatePct: number;          // annual interest %, cash bucket (e.g. Equitas savings)
  pfBondAllocPct: number;         // % of the withdrawn corpus put into bonds/debt funds
  pfBondRatePct: number;          // annual yield %, bond/debt fund bucket
  pfWheelYieldPctMonthly: number; // monthly option-wheeling premium yield % (remainder after cash + bonds)
  pfReinvestTaxPct: number;       // assumed tax % on reinvestment income

  // --- Villa Purchase (India) ---
  villaEnabled: boolean;          // include/exclude this goal from the plan entirely
  villaYear: number;              // year of purchase (down payment year)
  villaDownPaymentLakhs: number;  // ₹ Lakhs, cash down payment deducted from portfolio at villaYear
  villaLoanAmountLakhs: number;   // ₹ Lakhs, home loan principal
  villaLoanRatePct: number;       // annual home loan interest %, e.g. 8.5
  villaLoanTenureYears: number;   // loan tenure in years, e.g. 15

  // --- Apartment (India) — existing owned property ---
  apartmentCurrent: number;         // ₹L, current apartment market value
  apartmentAppreciationPct: number; // annual % appreciation
  apartmentSellAtVilla: boolean;    // true: sell it in villaYear, proceeds go toward the down payment; false: keep it as a second property alongside the villa
}

export interface Expenses {
  rent: number;
  groceries: number;
  utilities: number;
  transport: number;
  health: number;
  entertainment: number;
  misc: number;
}

export interface OneTimeExpenses {
  homeBuying: number;
  carBuying: number;
  renovation: number;
  wedding: number;
  misc: number;
}

export interface Milestone {
  type: 'life' | 'expense' | 'wealth' | 'milestone';
  text: string;
}

export interface FireProjection {
  year: number;
  mf: number;
  stocksIndia: number;
  usStocks: number;
  bonds: number;
  epf: number;
  ppf: number;
  us401k: number;
  fd: number;
  nps: number;
  apartment: number;
  optionsPortfolio: number;
  optionsIncomeMonthly: number;
  sipAmount: number;
  total: number;
  passiveIncomeMonthly: number;
  passiveIncomeGross: number;
  monthlyTax: number;
  equityTaxMonthly: number;
  slabTaxMonthly: number;
  calculatedMonthlyExpense: number | null;
  oneTimeDeduction: number;
  villaDownPaymentDeduction: number;
  apartmentSaleProceeds: number;
  villaEmiDeduction: number;
  milestones: Milestone[];
}

export interface WithdrawalProjection {
  year: number;
  corpusStart: number;
  withdrawalMonthly: number;
  grossWithdrawalMonthly: number;
  taxMonthly: number;
  equityTaxMonthly: number;
  slabTaxMonthly: number;
  realWithdrawalMonthly: number;
  corpusEnd: number;
  depleted: boolean;
}

export interface TaxModelSummary {
  indiaSlabRatePct: number;
  ltcgExemptionLakhs: number;
  ltcgRate: number;
  equityShareAtRetirement: number;
  slabShareAtRetirement: number;
  taxFreeShareAtRetirement: number;
  equityGainFractionAtRetirement: number;
}

export interface WithdrawalSustainability {
  depletionYear: number | null;
  sustainableYears: number | null;
  horizonYears: number;
}

export interface CalculationResults {
  summary: {
    startWealth: number;
    finalWealth: number;
    net401kINR: number;
    ageAtWithdrawal401k: number;
    isEarlyWithdrawal401k: boolean;
    taxRate401k: number;
    pfWithdrawalYear: number;
    pfWithdrawalMonth: number;
    pfAnnuityMonthlyIncomeLakhs: number;
    pfBlendedReinvestRate: number;
    superannuationAtWithdrawalINR: number;
    villaEnabled: boolean;
    villaYear: number;
    villaEmiLakhsPerMonth: number;
    villaLoanPayoffYear: number | null;
    taxModel: TaxModelSummary;
  };
  fireProjections: FireProjection[];
  withdrawalScenarios: Record<string, WithdrawalProjection[]>;
  withdrawalSustainability: Record<string, WithdrawalSustainability>;
  inputs: Partial<Inputs>;
}

export interface Snapshot {
  modelId: string;
  snapshotDate: string;
  label: string;
  tags: string[];
  notes: string;
  assets: Pick<Inputs, 'mfCurrent' | 'stocksIndia' | 'usStocks' | 'ppfCurrent' | 'fdCurrent' | 'npsCurrent' | 'apartmentCurrent' | 'apartmentAppreciationPct' | 'epfCurrent' | 'bondsInitial' | 'us401k' | 'usdExchangeRate'>;
  flows: Pick<Inputs, 'mfSIP' | 'sipStepUpRate' | 'optionsPortfolioValue' | 'optionsYieldPct' | 'annualSalary' | 'basicPay'>;
  growthRates: Pick<Inputs, 'mfRate' | 'stocksRate' | 'usRate' | 'inflationRate'>;
  bonds: Pick<Inputs, 'bondsInitial' | 'bondAnnualIncrease' | 'bondRate'>;
  expenses: {
    monthly: Expenses;
    oneTime: Partial<OneTimeExpenses>;
  };
  results: {
    currentWealth: number;
    projectedRetirement: number;
    fireNumber: number;
    yearsToFI: number | null;
    progressToFire: number;
  };
  planningParams: Pick<Inputs, 'startYear' | 'startMonth' | 'currentAge' | 'retirementYear' | 'returnYear' | 'withdraw401kYear' | 'retirementIncomeTaxRate' | 'applyTax' | 'indiaSlabRatePct' | 'fireMultiplier'>;
  // Optional: absent on snapshots saved before these tools existed. loadSnapshot
  // leaves the current values untouched when a snapshot doesn't have these —
  // it never has to be re-created just because it predates a schema addition.
  retirement401k?: Pick<Inputs, 'us401kContribPct' | 'us401kEmployerMatchPct'>;
  pfReinvestment?: Pick<
    Inputs,
    | 'pfWithdrawalMonth'
    | 'pfWithdrawalYear'
    | 'gratuityAmount'
    | 'superannuationBalance'
    | 'superMonthlyContribution'
    | 'superInterestRatePct'
    | 'superCommutationPct'
    | 'annuityRatePct'
    | 'pfCashAllocPct'
    | 'pfCashRatePct'
    | 'pfBondAllocPct'
    | 'pfBondRatePct'
    | 'pfWheelYieldPctMonthly'
    | 'pfReinvestTaxPct'
  >;
  villa?: Pick<
    Inputs,
    | 'villaEnabled'
    | 'villaYear'
    | 'villaDownPaymentLakhs'
    | 'villaLoanAmountLakhs'
    | 'villaLoanRatePct'
    | 'villaLoanTenureYears'
    | 'apartmentSellAtVilla'
  >;
}
