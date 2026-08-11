import type { Inputs } from '../types';
import { NumberInput } from './NumberInput';

interface InputDeckProps {
  inputs: Inputs;
  onInput: (key: keyof Inputs, value: number | boolean) => void;
}

interface FieldMeta {
  key: keyof Inputs;
  label: string;
  type?: 'year' | 'month-year';
  step?: number;
  pct?: boolean;
  accent?: boolean;
  title?: string;
  ageResettable?: boolean;
}

interface GroupMeta {
  title: string;
  fields: FieldMeta[];
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const INPUT_GROUPS: GroupMeta[] = [
  {
    title: 'Timeline',
    fields: [
      { key: 'startMonth', label: 'Start Date', type: 'month-year', title: 'Month and Year when your plan starts' },
      { key: 'currentAge', label: 'Current age', step: 1, title: 'Your current age — used to check the 401k withdrawal year against the age-59½ rule' },
      { key: 'retirementYear', label: 'Retire', type: 'year', title: 'Planned retirement year' },
      { key: 'returnYear', label: 'Return IN', type: 'year', title: 'Year of returning to India' },
      { key: 'withdraw401kYear', label: '401k Draw', type: 'year', ageResettable: true, title: 'Year you begin 401k withdrawals. Before you turn 59½, the IRS applies ordinary income tax PLUS a 10% early withdrawal penalty. At/after 59½, only ordinary income tax applies.' },
      { key: 'retirementIncomeTaxRate', label: '401k tax rate (59½+)', step: 1, pct: true, title: 'Ordinary US income tax rate applied to 401k withdrawals taken at/after age 59½ (no penalty). Typically lower than your working-years bracket.' }
    ]
  },
  {
    title: 'Assets · ₹L',
    fields: [
      { key: 'mfCurrent', label: 'Mutual Funds', step: 0.1, title: 'Current Mutual Fund value in Lakhs' },
      { key: 'mfPrincipal', label: 'MF Principal', step: 0.1, accent: true, title: 'Total invested amount (Cost Basis) in Lakhs' },
      { key: 'stocksIndia', label: 'Stocks IN', step: 0.1, title: 'Current Indian Stocks value in Lakhs' },
      { key: 'usStocks', label: 'US Stocks', step: 0.1, title: 'Current US Stocks value in Lakhs' },
      { key: 'emergencyFund', label: 'Emergency', step: 0.1, title: 'Emergency Fund size in Lakhs' }
    ]
  },
  {
    title: 'Retirement',
    fields: [
      { key: 'us401k', label: '401k · $', step: 1000, title: 'Full USD dollar amount in 401(k)' },
      { key: 'usdExchangeRate', label: '₹/$', step: 1, title: 'USD to INR exchange rate' },
      { key: 'annualSalary', label: 'US Salary · $', step: 1000, title: 'Annual US salary in USD' },
      { key: 'epfCurrent', label: 'EPF · ₹L', step: 0.1, title: 'Current EPF balance in Lakhs' },
      { key: 'basicPay', label: 'Basic · ₹/mo', step: 100, title: 'Basic pay in ₹ per month (for EPF calculation)' }
    ]
  },
  {
    title: 'Flows · ₹L/mo',
    fields: [
      { key: 'mfSIP', label: 'MF SIP', step: 0.1, title: 'Monthly Mutual Fund SIP in Lakhs' },
      { key: 'sipStepUpRate', label: 'Step-up %', step: 1, pct: true, title: 'Annual SIP increase percentage' }
    ]
  },
  {
    title: 'Options income',
    fields: [
      { key: 'optionsPortfolioValue', label: 'Portfolio · ₹L', step: 0.1, title: 'Value of the stock portfolio you write covered calls / cash-secured puts against, in Lakhs' },
      { key: 'optionsYieldPct', label: 'Premium yield %/yr', step: 0.5, pct: true, title: 'Annualised option premium income as a % of the options portfolio (e.g. covered call / CSP premium). Continues through retirement — this models an active options-selling strategy, not passive returns.' }
    ]
  },
  {
    title: 'Bonds',
    fields: [
      { key: 'bondsInitial', label: 'Initial · ₹L', step: 0.1, title: 'Initial bond investment in Lakhs' },
      { key: 'bondAnnualIncrease', label: 'Add %', step: 0.1, pct: true, title: 'Annual bond allocation increase percentage' },
      { key: 'bondRate', label: 'Rate %', step: 0.1, pct: true, title: 'Annual interest rate on bonds' }
    ]
  },
  {
    title: 'Rates · %',
    fields: [
      { key: 'mfRate', label: 'MF CAGR', step: 0.1, pct: true, title: 'Assumed Mutual Fund annual return rate' },
      { key: 'stocksRate', label: 'Stocks', step: 0.1, pct: true, title: 'Assumed Indian Stocks annual return rate' },
      { key: 'usRate', label: 'US 401k', step: 0.1, pct: true, title: 'Assumed US 401k annual return rate' },
      { key: 'inflationRate', label: 'Inflation', step: 0.1, pct: true, title: 'Assumed annual inflation rate' },
      { key: 'postFireRate', label: 'Post-FI return', step: 0.1, pct: true, title: 'Assumed portfolio return AFTER retirement (typically lower than pre-FI equity CAGR, since retirees de-risk). Governs whether the corpus depletes, holds flat, or grows under your chosen withdrawal rate.' }
    ]
  }
];

export function InputField({
  f,
  inputs,
  onInput
}: {
  f: FieldMeta;
  inputs: Inputs;
  onInput: (key: keyof Inputs, value: number | boolean) => void;
}) {
  const raw = inputs[f.key];

  if (f.type === 'month-year') {
    return (
      <div className="in-wrap" title={f.title}>
        <label>{f.label}</label>
        <div style={{ display: 'flex', gap: 4 }}>
          <select
            className="in"
            style={{ flex: '0 0 66px', padding: '6px 4px', fontSize: '12px' }}
            value={inputs.startMonth}
            onChange={(e) => onInput('startMonth', Number(e.target.value))}
          >
            {MONTH_NAMES.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          <NumberInput
            className="in"
            step={1}
            value={inputs.startYear}
            onCommit={(n) => onInput('startYear', n)}
          />
        </div>
      </div>
    );
  }

  if (f.type === 'year') {
    const age59YearOffset = Math.ceil(59.5 - inputs.currentAge);
    const suggestedYear = inputs.startYear + age59YearOffset;
    const showReset = f.ageResettable && inputs.currentAge > 0 && Number(raw) !== suggestedYear;

    return (
      <div className="in-wrap" title={f.title}>
        <label>{f.label}</label>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <NumberInput
            className="in"
            step={1}
            value={Number(raw) || 0}
            onCommit={(n) => onInput(f.key, n)}
          />
          {showReset && (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: '6px 8px', fontSize: 11, whiteSpace: 'nowrap', flex: '0 0 auto' }}
              title={`Reset to age 59½ (${suggestedYear})`}
              onClick={() => onInput(f.key, suggestedYear)}
            >
              ↻ {suggestedYear}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Handle percentages (convert e.g., 0.12 to 12)
  const val = f.pct ? Math.round((Number(raw) || 0) * 1000) / 10 : Number(raw) || 0;

  return (
    <div className="in-wrap" title={f.title}>
      <label>{f.label}</label>
      <NumberInput
        className={'in' + (f.accent ? ' accent' : '')}
        step={f.step ?? 'any'}
        value={typeof val === 'boolean' ? (val ? 1 : 0) : val}
        onCommit={(n) => onInput(f.key, f.pct ? n / 100 : n)}
      />
    </div>
  );
}

export function InputDeck({ inputs, onInput }: InputDeckProps) {
  return (
    <div className="deck">
      {INPUT_GROUPS.map((g) => (
        <div className="deck-card" key={g.title}>
          <h4>{g.title}</h4>
          <div className="fields">
            {g.fields.map((f) => (
              <InputField key={f.key} f={f} inputs={inputs} onInput={onInput} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
