export type TabKey = 'journey' | 'risk' | 'expenses' | 'withdrawal' | 'snapshots' | 'retirement401k' | 'pfReinvest';

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
