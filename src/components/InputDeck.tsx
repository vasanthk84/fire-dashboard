import type { ChangeEvent } from 'react';
import type { Inputs } from '../types';

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
      { key: 'retirementYear', label: 'Retire', type: 'year', title: 'Planned retirement year' },
      { key: 'returnYear', label: 'Return IN', type: 'year', title: 'Year of returning to India' },
      { key: 'withdraw401kYear', label: '401k Draw', type: 'year', title: 'Year you begin 401k withdrawals' }
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
      { key: 'sipStepUpRate', label: 'Step-up %', step: 1, pct: true, title: 'Annual SIP increase percentage' },
      { key: 'optionSellingMonthly', label: 'Options', step: 0.1, title: 'Monthly option-selling income in Lakhs' }
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
      { key: 'inflationRate', label: 'Inflation', step: 0.1, pct: true, title: 'Assumed annual inflation rate' }
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
          <input
            className="in"
            type="number"
            step="1"
            value={inputs.startYear}
            onChange={(e) => onInput('startYear', Number(e.target.value))}
          />
        </div>
      </div>
    );
  }

  if (f.type === 'year') {
    return (
      <div className="in-wrap" title={f.title}>
        <label>{f.label}</label>
        <input
          className="in"
          type="number"
          step="1"
          value={Number(raw) || 0}
          onChange={(e) => onInput(f.key, Number(e.target.value))}
        />
      </div>
    );
  }

  // Handle percentages (convert e.g., 0.12 to 12)
  const val = f.pct ? Math.round((Number(raw) || 0) * 1000) / 10 : raw;
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value) || 0;
    onInput(f.key, f.pct ? v / 100 : v);
  };

  return (
    <div className="in-wrap" title={f.title}>
      <label>{f.label}</label>
      <input
        className={'in' + (f.accent ? ' accent' : '')}
        type="number"
        step={f.step ?? 'any'}
        value={typeof val === 'boolean' ? (val ? 1 : 0) : val}
        onChange={handleChange}
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
