import type { Expenses, Inputs, OneTimeExpenses, TabKey } from './types';

const _now = new Date();

export const initialInputs: Inputs = {
  startYear: _now.getFullYear(),
  startMonth: _now.getMonth() + 1,
  currentAge: 42,
  retirementYear: _now.getFullYear() + 10,
  returnYear: _now.getFullYear() + 5,
  withdraw401kYear: _now.getFullYear() + (60 - 42),
  retirementIncomeTaxRate: 0.22,
  mfCurrent: 0,
  mfPrincipal: 0,
  stocksIndia: 0,
  usStocks: 0,
  emergencyFund: 0,
  us401k: 61454.64,
  usdExchangeRate: 86,
  epfCurrent: 68.8505,
  basicPay: 36700,
  epfRate: 0.0825,
  vpfRate: 0.88,
  bondsInitial: 0,
  bondAnnualIncrease: 0.01,
  bondRate: 0.07,
  mfSIP: 0,
  sipStepUpRate: 0.1,
  optionsPortfolioValue: 0,
  optionsYieldPct: 0.20,
  annualSalary: 0,
  mfRate: 0.12,
  stocksRate: 0.15,
  usRate: 0.12,
  inflationRate: 0.06,
  postFireRate: 0.065,
  abroadMonthlyExpenses: 0,
  monthlyExpenses: 0,
  oneTimeExpenseTotal: 0,
  applyTax: false,
  fireMultiplier: 25,
  enableRebalancing: false,
  targetEquityPre: 80,
  targetEquityPost: 60,
  glideYears: 10,

  // 401k Projector
  us401kContribPct: 0.05,
  us401kEmployerMatchPct: 0.04,

  // PF Closure & Reinvestment — pre-filled from your most recent PF passbook /
  // payslip snapshot. TCS has indicated PF closure within ~6-12 months of
  // Aug 2026, so the withdrawal date below is a placeholder best-guess —
  // update it the moment TCS confirms the actual date.
  pfWithdrawalMonth: 5,
  pfWithdrawalYear: _now.getFullYear() + 1,
  gratuityAmount: 574855,
  // Superannuation statement (FY 2026-2027): opening 5,64,861 + employer
  // contributions Apr-Jul 2026 (avg ~5,505/mo) + interest = 6,02,082 as of 31-Jul-2026.
  superannuationBalance: 602082,
  superMonthlyContribution: 5505,
  superInterestRatePct: 7.9,
  superCommutationPct: 0.5,
  annuityRatePct: 0.06,
  pfCashAllocPct: 68,
  pfCashRatePct: 7,
  // Defaulted to 0% so adding the Bonds bucket doesn't silently change your
  // existing 68% cash / 32% wheeling plan — dial this in yourself if you want it.
  pfBondAllocPct: 0,
  pfBondRatePct: 7.5,
  pfWheelYieldPctMonthly: 1.25,
  pfReinvestTaxPct: 0
};

export const initialExpenses: Expenses = {
  rent: 0,
  groceries: 0,
  utilities: 0,
  transport: 0,
  health: 0,
  entertainment: 0,
  misc: 0
};

export const initialOneTimeExpenses: OneTimeExpenses = {
  homeBuying: 0,
  carBuying: 0,
  renovation: 0,
  wedding: 0,
  misc: 0
};

export const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'journey', label: 'Journey' },
  { key: 'risk', label: 'Risk' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'withdrawal', label: 'Withdrawal' },
  { key: 'retirement401k', label: '401k Projector' },
  { key: 'pfReinvest', label: 'PF Reinvest' },
  { key: 'snapshots', label: 'Snapshots' }
];

export const withdrawalRateOptions = ['2%', '3%', '4%'];
