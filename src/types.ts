export type TabKey = 'journey' | 'risk' | 'expenses' | 'withdrawal' | 'snapshots';

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
  emergencyFund: number;
  us401k: number;
  usdExchangeRate: number;
  epfCurrent: number;
  basicPay: number;
  epfRate: number;
  vpfRate: number;
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
  fireMultiplier: number;
  enableRebalancing: boolean;
  targetEquityPre: number;
  targetEquityPost: number;
  glideYears: number;
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
  us401k: number;
  emergencyFund: number;
  optionsPortfolio: number;
  optionsIncomeMonthly: number;
  sipAmount: number;
  total: number;
  passiveIncomeMonthly: number;
  passiveIncomeGross: number;
  monthlyTax: number;
  calculatedMonthlyExpense: number | null;
  oneTimeDeduction: number;
  milestones: Milestone[];
}

export interface WithdrawalProjection {
  year: number;
  corpusStart: number;
  withdrawalMonthly: number;
  realWithdrawalMonthly: number;
  corpusEnd: number;
  depleted: boolean;
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
  assets: Pick<Inputs, 'mfCurrent' | 'stocksIndia' | 'usStocks' | 'emergencyFund' | 'epfCurrent' | 'bondsInitial' | 'us401k' | 'usdExchangeRate'>;
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
  planningParams: Pick<Inputs, 'startYear' | 'startMonth' | 'currentAge' | 'retirementYear' | 'returnYear' | 'withdraw401kYear' | 'retirementIncomeTaxRate' | 'applyTax' | 'fireMultiplier'>;
}
