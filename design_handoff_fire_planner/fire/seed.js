/* Seed data, asset metadata, formatters. Exposed on window. */
(function () {
  const NOW = new Date(2026, 0, 1); // demo "today"
  const Y = 2026;

  // Realistic preloaded scenario (derived from the Dec-2025 snapshot) so every
  // chart/table is populated. Monthly expenses seeded so FIRE math is live.
  const SEED_INPUTS = {
    startYear: Y, startMonth: 1,
    retirementYear: Y + 9,   // 2035
    returnYear: Y + 4,       // 2030
    withdraw401kYear: Y + 7, // 2033
    mfCurrent: 122, mfPrincipal: 78,
    stocksIndia: 29.6, usStocks: 16, emergencyFund: 10,
    us401k: 52000, usdExchangeRate: 95,
    epfCurrent: 62.93, basicPay: 34900, epfRate: 0.0825, vpfRate: 0.12,
    bondsInitial: 18, bondAnnualIncrease: 0.01, bondRate: 0.10,
    mfSIP: 1.2, sipStepUpRate: 0.10, optionSellingMonthly: 0.2,
    annualSalary: 94000,
    mfRate: 0.12, stocksRate: 0.15, usRate: 0.12, inflationRate: 0.06,
    monthlyExpenses: 0, oneTimeExpenseTotal: 0, applyTax: false,
    fireMultiplier: 25,
    enableRebalancing: false, targetEquityPre: 80, targetEquityPost: 60, glideYears: 10
  };

  const SEED_EXPENSES = {
    rent: 45000, groceries: 22000, utilities: 9000,
    transport: 11000, health: 8000, entertainment: 14000, misc: 11000
  };

  const SEED_ONETIME = {
    homeBuying: 0, carBuying: 0, renovation: 0, wedding: 0, misc: 0
  };

  // Input field groups — terse labels only.
  const INPUT_GROUPS = [
    { title: 'Timeline', fields: [
      { key: 'retirementYear', label: 'Retire', type: 'year' },
      { key: 'returnYear', label: 'Return IN', type: 'year' },
      { key: 'withdraw401kYear', label: '401k Draw', type: 'year' }
    ]},
    { title: 'Assets · ₹L', fields: [
      { key: 'mfCurrent', label: 'Mutual Funds', step: 0.1 },
      { key: 'mfPrincipal', label: 'MF Principal', step: 0.1, accent: true },
      { key: 'stocksIndia', label: 'Stocks IN', step: 0.1 },
      { key: 'usStocks', label: 'US Stocks', step: 0.1 },
      { key: 'emergencyFund', label: 'Emergency', step: 0.1 }
    ]},
    { title: 'Retirement', fields: [
      { key: 'us401k', label: '401k · $', step: 1000 },
      { key: 'usdExchangeRate', label: '₹/$', step: 1 },
      { key: 'annualSalary', label: 'US Salary · $', step: 1000 },
      { key: 'epfCurrent', label: 'EPF · ₹L', step: 0.1 },
      { key: 'basicPay', label: 'Basic · ₹/mo', step: 100 }
    ]},
    { title: 'Flows · ₹L/mo', fields: [
      { key: 'mfSIP', label: 'MF SIP', step: 0.1 },
      { key: 'sipStepUpRate', label: 'Step-up %', step: 1, pct: true },
      { key: 'optionSellingMonthly', label: 'Options', step: 0.1 }
    ]},
    { title: 'Bonds', fields: [
      { key: 'bondsInitial', label: 'Initial · ₹L', step: 0.1 },
      { key: 'bondAnnualIncrease', label: 'Add %', step: 0.1, pct: true },
      { key: 'bondRate', label: 'Rate %', step: 0.1, pct: true }
    ]},
    { title: 'Rates · %', fields: [
      { key: 'mfRate', label: 'MF CAGR', step: 0.1, pct: true },
      { key: 'stocksRate', label: 'Stocks', step: 0.1, pct: true },
      { key: 'usRate', label: 'US 401k', step: 0.1, pct: true },
      { key: 'inflationRate', label: 'Inflation', step: 0.1, pct: true }
    ]}
  ];

  // Asset classes for composition chart / legend — distinct, theme-stable hues.
  const ASSET_SERIES = [
    { key: 'mf', label: 'Mutual Funds', color: '#4f8cff' },
    { key: 'stocksIndia', label: 'Stocks IN', color: '#f5a524' },
    { key: 'usStocks', label: 'US Stocks', color: '#9b8cff' },
    { key: 'bonds', label: 'Bonds', color: '#2dd4a7' },
    { key: 'emergencyFund', label: 'Emergency', color: '#64748b' },
    { key: 'epf', label: 'EPF', color: '#f25f9c' }
  ];

  const EXPENSE_META = [
    { key: 'rent', label: 'Rent', color: '#4f8cff' },
    { key: 'groceries', label: 'Groceries', color: '#2dd4a7' },
    { key: 'utilities', label: 'Utilities', color: '#f5a524' },
    { key: 'transport', label: 'Transport', color: '#9b8cff' },
    { key: 'health', label: 'Health', color: '#f25f9c' },
    { key: 'entertainment', label: 'Leisure', color: '#22b8cf' },
    { key: 'misc', label: 'Misc', color: '#94a3b8' }
  ];

  const ONETIME_META = [
    { key: 'homeBuying', label: 'Home' },
    { key: 'carBuying', label: 'Car' },
    { key: 'renovation', label: 'Renovation' },
    { key: 'wedding', label: 'Wedding' },
    { key: 'misc', label: 'Misc' }
  ];

  const TABS = [
    { key: 'journey', label: 'Journey' },
    { key: 'risk', label: 'Risk' },
    { key: 'expenses', label: 'Expenses' },
    { key: 'withdrawal', label: 'Withdrawal' },
    { key: 'snapshots', label: 'Snapshots' }
  ];

  // Demo snapshots so the Snapshots tab has comparison data.
  const SEED_SNAPSHOTS = [
    { modelId: 's1', snapshotDate: '2024-06-30T00:00:00Z', label: 'Jun 2024', notes: 'Post-bonus rebalance',
      assets: { mfCurrent: 78, stocksIndia: 18, usStocks: 9, emergencyFund: 8, epfCurrent: 41, bondsInitial: 10 },
      results: { currentWealth: 164, fireNumber: 372 } },
    { modelId: 's2', snapshotDate: '2024-12-31T00:00:00Z', label: 'Dec 2024', notes: 'Year-end review',
      assets: { mfCurrent: 94, stocksIndia: 22, usStocks: 12, emergencyFund: 9, epfCurrent: 49, bondsInitial: 13 },
      results: { currentWealth: 199, fireNumber: 372 } },
    { modelId: 's3', snapshotDate: '2025-06-30T00:00:00Z', label: 'Jun 2025', notes: '',
      assets: { mfCurrent: 108, stocksIndia: 26, usStocks: 14, emergencyFund: 9.5, epfCurrent: 56, bondsInitial: 15 },
      results: { currentWealth: 228, fireNumber: 372 } },
    { modelId: 's4', snapshotDate: '2025-12-31T00:00:00Z', label: 'Dec 2025', notes: 'Year-end review',
      assets: { mfCurrent: 122, stocksIndia: 29.6, usStocks: 16, emergencyFund: 10, epfCurrent: 62.93, bondsInitial: 18 },
      results: { currentWealth: 258.5, fireNumber: 372 } }
  ];

  function fmtL(v) {
    if (!isFinite(v)) return '₹0L';
    const neg = v < 0 ? '-' : '';
    const a = Math.abs(v);
    if (a >= 100) return `${neg}₹${(a / 100).toFixed(2)}Cr`;
    return `${neg}₹${a.toFixed(1)}L`;
  }
  function fmtINR(v) {
    return '₹' + Math.round(v).toLocaleString('en-IN');
  }
  function fmtPct(v, d) { return `${v.toFixed(d == null ? 0 : d)}%`; }

  window.FIRE = {
    SEED_INPUTS, SEED_EXPENSES, SEED_ONETIME, SEED_SNAPSHOTS,
    INPUT_GROUPS, ASSET_SERIES, EXPENSE_META, ONETIME_META, TABS,
    fmtL, fmtINR, fmtPct
  };
})();
