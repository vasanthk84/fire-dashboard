import type { CSSProperties, ChangeEvent } from 'react';
import type { Inputs } from '../types';

interface InputDeckProps {
  inputs: Inputs;
  onInput: (key: keyof Inputs, value: number | boolean) => void;
}

function InputField({
  label,
  value,
  onChange,
  step,
  min,
  style,
  title
}: {
  label: string;
  value: number;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  step?: number;
  min?: number;
  style?: CSSProperties;
  title?: string;
}) {
  return (
    <div className="input-wrapper">
      <label>{label}</label>
      <input type="number" min={min} step={step} value={value} onChange={onChange} style={style} title={title} />
    </div>
  );
}

export function InputDeck({ inputs, onInput }: InputDeckProps) {
  return (
    <div className="input-deck">
      <div className="deck-card">
        <div className="card-header">Core Parameters</div>
        <div className="card-inputs">
          <InputField label="Start Year" value={inputs.startYear} onChange={(e) => onInput('startYear', Number(e.target.value))} />
          <InputField label="Retire Year" value={inputs.retirementYear} onChange={(e) => onInput('retirementYear', Number(e.target.value))} />
          <InputField label="Return India" value={inputs.returnYear} onChange={(e) => onInput('returnYear', Number(e.target.value))} />
          <InputField label="401k Withdraw" value={inputs.withdraw401kYear} onChange={(e) => onInput('withdraw401kYear', Number(e.target.value))} />
        </div>
      </div>

      <div className="deck-card">
        <div className="card-header">Assets (Lakhs)</div>
        <div className="card-inputs">
          <InputField label="MF Current" step={0.1} value={inputs.mfCurrent} onChange={(e) => onInput('mfCurrent', Number(e.target.value))} />
          <InputField label="MF Principal" step={0.1} value={inputs.mfPrincipal} onChange={(e) => onInput('mfPrincipal', Number(e.target.value))} style={{ borderColor: '#10b981', color: '#10b981' }} title="Your total invested amount (Cost Basis)" />
          <InputField label="Stocks IN" step={0.1} value={inputs.stocksIndia} onChange={(e) => onInput('stocksIndia', Number(e.target.value))} />
          <InputField label="US Stocks" step={0.1} value={inputs.usStocks} onChange={(e) => onInput('usStocks', Number(e.target.value))} />
          <InputField label="Emergency" step={0.1} value={inputs.emergencyFund} onChange={(e) => onInput('emergencyFund', Number(e.target.value))} />
        </div>
      </div>

      <div className="deck-card">
        <div className="card-header">Retirement Accounts</div>
        <div className="card-inputs">
          <InputField label="401k (USD)" value={inputs.us401k} onChange={(e) => onInput('us401k', Number(e.target.value))} />
          <InputField label="USD Rate" value={inputs.usdExchangeRate} onChange={(e) => onInput('usdExchangeRate', Number(e.target.value))} />
          <InputField label="EPF (L)" step={0.1} value={inputs.epfCurrent} onChange={(e) => onInput('epfCurrent', Number(e.target.value))} />
          <InputField label="Basic Pay" value={inputs.basicPay} onChange={(e) => onInput('basicPay', Number(e.target.value))} />
        </div>
      </div>

      <div className="deck-card">
        <div className="card-header">Monthly Flows (L)</div>
        <div className="card-inputs">
          <InputField label="MF SIP" step={0.1} value={inputs.mfSIP} onChange={(e) => onInput('mfSIP', Number(e.target.value))} />
          <InputField label="SIP Step %" step={1} value={inputs.sipStepUpRate * 100} onChange={(e) => onInput('sipStepUpRate', (Number(e.target.value) || 10) / 100)} />
          <InputField label="Options" step={0.1} value={inputs.optionSellingMonthly} onChange={(e) => onInput('optionSellingMonthly', Number(e.target.value))} />
          <InputField label="Salary ($)" value={inputs.annualSalary} onChange={(e) => onInput('annualSalary', Number(e.target.value))} />
        </div>
      </div>

      <div className="deck-card">
        <div className="card-header">Bonds</div>
        <div className="card-inputs">
          <InputField label="Initial (L)" step={0.1} value={inputs.bondsInitial} onChange={(e) => onInput('bondsInitial', Number(e.target.value))} />
          <InputField label="Add %" step={0.1} value={inputs.bondAnnualIncrease * 100} onChange={(e) => onInput('bondAnnualIncrease', (Number(e.target.value) || 1) / 100)} />
          <InputField label="Rate %" step={0.1} value={inputs.bondRate * 100} onChange={(e) => onInput('bondRate', (Number(e.target.value) || 10) / 100)} />
        </div>
      </div>

      <div className="deck-card">
        <div className="card-header">Growth Rates (%)</div>
        <div className="card-inputs">
          <InputField label="MF CAGR" step={0.1} value={inputs.mfRate * 100} onChange={(e) => onInput('mfRate', (Number(e.target.value) || 12) / 100)} />
          <InputField label="Stocks" step={0.1} value={inputs.stocksRate * 100} onChange={(e) => onInput('stocksRate', (Number(e.target.value) || 15) / 100)} />
          <InputField label="US 401k" step={0.1} value={inputs.usRate * 100} onChange={(e) => onInput('usRate', (Number(e.target.value) || 12) / 100)} title="Used for 401k growth. US stocks are held flat unless you edit the starting value." />
          <InputField label="Inflation" step={0.1} value={inputs.inflationRate * 100} onChange={(e) => onInput('inflationRate', (Number(e.target.value) || 6) / 100)} />
        </div>
      </div>
    </div>
  );
}
