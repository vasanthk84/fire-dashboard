import type { Expenses, Inputs, OneTimeExpenses, TabKey } from './types';

const _now = new Date();

export const initialInputs: Inputs = {
  startYear: _now.getFullYear(),
  startMonth: _now.getMonth() + 1,
  retirementYear: _now.getFullYear() + 10,
  returnYear: _now.getFullYear() + 5,
  withdraw401kYear: _now.getFullYear() + 8,
  mfCurrent: 0,
  mfPrincipal: 0,
  stocksIndia: 0,
  usStocks: 0,
  emergencyFund: 0,
  us401k: 0,
  usdExchangeRate: 86,
  epfCurrent: 0,
  basicPay: 0,
  epfRate: 0.0825,
  vpfRate: 0.12,
  bondsInitial: 0,
  bondAnnualIncrease: 0.01,
  bondRate: 0.07,
  mfSIP: 0,
  sipStepUpRate: 0.1,
  optionSellingMonthly: 0,
  annualSalary: 0,
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
