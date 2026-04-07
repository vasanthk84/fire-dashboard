import type { Expenses, Inputs, OneTimeExpenses, TabKey } from './types';

export const initialInputs: Inputs = {
  startYear: 2025,
  retirementYear: 2035,
  returnYear: 2030,
  withdraw401kYear: 2033,
  mfCurrent: 122,
  mfPrincipal: 85,
  stocksIndia: 29.6,
  usStocks: 16,
  emergencyFund: 10,
  us401k: 52000,
  usdExchangeRate: 95,
  epfCurrent: 62.93,
  basicPay: 34900,
  epfRate: 0.0825,
  vpfRate: 0.88,
  bondsInitial: 18,
  bondAnnualIncrease: 0.01,
  bondRate: 0.1,
  mfSIP: 1.2,
  sipStepUpRate: 0.1,
  optionSellingMonthly: 0.2,
  annualSalary: 94000,
  mfRate: 0.12,
  stocksRate: 0.15,
  usRate: 0.12,
  inflationRate: 0.06,
  monthlyExpenses: 0,
  oneTimeExpenseTotal: 0,
  applyTax: false,
  fireMultiplier: 25,
  enableRebalancing: false,
  targetEquityPre: 80,
  targetEquityPost: 60,
  glideYears: 10
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
  { key: 'snapshots', label: 'Snapshots' }
];

export const withdrawalRateOptions = ['2%', '3%', '4%'];
