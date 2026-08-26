import type { Expenses, FireProjection, Inputs, OneTimeExpenses, CalculationResults } from '../../types';
import { fmtL, fmtRupees } from '../../utils/formatters';
import { ApexChartComponent } from '../ApexChartComponent';
import { CHARTS, EXPENSE_META, ONETIME_META } from '../../utils/chartBuilders';
import { NumberInput } from '../NumberInput';
import { useMemo } from 'react';

interface ExpensesTabProps {
  expenses: Expenses;
  oneTimeExpenses: OneTimeExpenses;
  showOneTime: boolean;
  currentMonthlyExp: number;
  applyTax: boolean;
  sampleTaxYear?: FireProjection;
  onExpenseChange: (key: keyof Expenses, value: string) => void;
  onOneTimeChange: (key: keyof OneTimeExpenses, value: string) => void;
  onShowOneTimeChange: (checked: boolean) => void;
  onApplyTaxChange: (checked: boolean) => void;
  results: CalculationResults | null;
  inputs: Inputs;
  onInput: (key: keyof Inputs, value: number | boolean) => void;
  themeKey: string;
}

export function ExpensesTab(props: ExpensesTabProps) {
  const {
    expenses,
    oneTimeExpenses,
    showOneTime,
    currentMonthlyExp,
    applyTax,
    sampleTaxYear,
    onExpenseChange,
    onOneTimeChange,
    onShowOneTimeChange,
    onApplyTaxChange,
    results,
    inputs,
    onInput,
    themeKey
  } = props;

  const total = EXPENSE_META.reduce((s, e) => s + (expenses[e.key] || 0), 0);
  const hasExp = total > 0;

  // Mirrors api/calculate.js's EMI formula for instant display before the next
  // calc round-trip returns results.summary.villaEmiLakhsPerMonth.
  const villaEmi = useMemo(() => {
    const r = inputs.villaLoanRatePct / 100 / 12;
    const n = Math.round(inputs.villaLoanTenureYears * 12);
    const principal = inputs.villaLoanAmountLakhs * 100000;
    if (principal <= 0 || n <= 0) return { monthlyINR: 0, payoffYear: null as number | null };
    const emi = r > 0
      ? (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
      : principal / n;
    return { monthlyINR: emi, payoffYear: inputs.villaYear + Math.ceil(n / 12) - 1 };
  }, [inputs.villaLoanRatePct, inputs.villaLoanTenureYears, inputs.villaLoanAmountLakhs, inputs.villaYear]);

  return (
    <div className="stack">
    <div className="grid-2" style={{ alignItems: 'start' }}>
      <div className="card card-pad">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <div>
            <div className="panel-h">
              <span className="panel-t">Monthly expenses</span>
            </div>
            <div className="panel-cap" style={{ marginLeft: 0 }}>Drives FIRE target & coverage</div>
          </div>
        </div>

        <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 12 }}>
          India lifestyle · active from <strong>{inputs.returnYear}</strong> · drives FIRE target
        </div>

        {EXPENSE_META.map((e) => (
          <div className="exp-row" key={e.key}>
            <label>
              <i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: e.color, marginRight: 8, verticalAlign: 'middle' }}></i>
              {e.label}
            </label>
            <NumberInput
              className="in num"
              value={expenses[e.key]}
              onCommit={(n) => onExpenseChange(e.key, String(n))}
            />
          </div>
        ))}

        <div className="exp-total">
          <span>Total / month</span>
          <b>{fmtRupees(total)}</b>
        </div>

        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label className="switch">
            <input
              type="checkbox"
              checked={applyTax}
              onChange={(e) => onApplyTaxChange(e.target.checked)}
            />
            <span className="track"></span>Apply 12.5% tax drag
          </label>
          <label className="switch">
            <input
              type="checkbox"
              checked={showOneTime}
              onChange={(e) => onShowOneTimeChange(e.target.checked)}
            />
            <span className="track"></span>Return-to-India setup costs
          </label>
        </div>

        {showOneTime && (
          <div className="drawer-grid" style={{ marginTop: 14 }}>
            {ONETIME_META.map((o: { key: keyof OneTimeExpenses; label: string }) => (
              <div className="in-wrap" key={o.key}>
                <label>{o.label}</label>
                <NumberInput
                  className="in"
                  value={oneTimeExpenses[o.key]}
                  onCommit={(n) => onOneTimeChange(o.key, String(n))}
                />
              </div>
            ))}
          </div>
        )}

        {applyTax && sampleTaxYear && (
          <div className="card card-pad" style={{ marginTop: 14, background: 'var(--surface-2)' }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Tax at retirement</div>
            <div className="stress-row">
              <span>Gross passive</span>
              <strong>{fmtL(sampleTaxYear.passiveIncomeGross)}</strong>
            </div>
            <div className="stress-row">
              <span>Tax (12.5%)</span>
              <strong className="text-neg">−{fmtL(sampleTaxYear.monthlyTax)}</strong>
            </div>
            <div className="stress-row" style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 8 }}>
              <span>Net / mo</span>
              <strong className="text-pos">{fmtL(sampleTaxYear.passiveIncomeMonthly)}</strong>
            </div>
          </div>
        )}
      </div>

      <div className="stack">
        <div className="card card-pad">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
            <div>
              <div className="panel-h">
                <span className="panel-t">Spend breakdown</span>
              </div>
            </div>
          </div>
          {hasExp ? (
            <ApexChartComponent
              height={240}
              dep={'don' + themeKey + total}
              build={CHARTS.expenseDonut(expenses)}
            />
          ) : (
            <div className="empty">
              <p>Add expenses to see the split</p>
            </div>
          )}
        </div>

        <div className="card card-pad">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
            <div>
              <div className="panel-h">
                <span className="panel-t">Passive income vs expenses</span>
              </div>
              <div className="panel-cap" style={{ marginLeft: 0 }}>Lakhs per month · post-return</div>
            </div>
          </div>
          {results ? (
            <ApexChartComponent
              height={280}
              dep={'ie' + themeKey + applyTax}
              build={CHARTS.incomeVsExpense(results.fireProjections, inputs.retirementYear, inputs.returnYear, applyTax)}
            />
          ) : (
            <div className="empty">
              <p>Run calculation to view passive income progression</p>
            </div>
          )}
        </div>
      </div>
    </div>

    <div className="card card-pad">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div>
          <div className="panel-h">
            <span className="panel-t">Villa purchase (India)</span>
          </div>
          <div className="panel-cap" style={{ marginLeft: 0 }}>
            Optional goal — down payment hits your portfolio the year you buy; the loan EMI only draws from
            the corpus for whichever loan years fall after you've retired (pre-retirement EMI is assumed
            covered by salary, same as your regular monthly expenses).
          </div>
        </div>
        <label className="switch">
          <input
            type="checkbox"
            checked={inputs.villaEnabled}
            onChange={(e) => onInput('villaEnabled', e.target.checked)}
          />
          <span className="track"></span>Include
        </label>
      </div>

      {inputs.villaEnabled && (
        <>
          <div className="grid-3" style={{ marginBottom: 14 }}>
            <div className="in-wrap">
              <label>Purchase year</label>
              <NumberInput className="in" step={1} value={inputs.villaYear} onCommit={(n) => onInput('villaYear', n)} />
            </div>
            <div className="in-wrap">
              <label>Down payment (₹ Lakhs)</label>
              <NumberInput className="in" step={5} value={inputs.villaDownPaymentLakhs} onCommit={(n) => onInput('villaDownPaymentLakhs', n)} />
            </div>
            <div className="in-wrap">
              <label>Loan amount (₹ Lakhs)</label>
              <NumberInput className="in" step={1} value={inputs.villaLoanAmountLakhs} onCommit={(n) => onInput('villaLoanAmountLakhs', n)} />
            </div>
            <div className="in-wrap">
              <label>Loan rate (% p.a.)</label>
              <NumberInput className="in" step={0.1} value={inputs.villaLoanRatePct} onCommit={(n) => onInput('villaLoanRatePct', n)} />
            </div>
            <div className="in-wrap">
              <label>Loan tenure (years)</label>
              <NumberInput className="in" step={1} value={inputs.villaLoanTenureYears} onCommit={(n) => onInput('villaLoanTenureYears', n)} />
            </div>
          </div>

          <div className="stat-grid">
            <div className="stat">
              <div className="stat-top">Down payment (today's ₹)</div>
              <div className="stat-val" style={{ fontSize: 18 }}>{fmtL(inputs.villaDownPaymentLakhs)}</div>
              <div className="stat-foot">Inflated to {inputs.villaYear} when deducted</div>
            </div>
            <div className="stat">
              <div className="stat-top">Monthly EMI</div>
              <div className="stat-val" style={{ fontSize: 18 }}>{fmtRupees(villaEmi.monthlyINR)}</div>
              <div className="stat-foot">{inputs.villaLoanAmountLakhs}L @ {inputs.villaLoanRatePct}% for {inputs.villaLoanTenureYears}y</div>
            </div>
            <div className="stat">
              <div className="stat-top">Loan paid off</div>
              <div className="stat-val" style={{ fontSize: 18 }}>{villaEmi.payoffYear ?? '—'}</div>
              <div className="stat-foot">Purchase year {inputs.villaYear}</div>
            </div>
            <div className="stat">
              <div className="stat-top">Total cash needed</div>
              <div className="stat-val" style={{ fontSize: 18 }}>{fmtL(inputs.villaDownPaymentLakhs + inputs.villaLoanAmountLakhs)}</div>
              <div className="stat-foot">Down payment + loan principal</div>
            </div>
          </div>
        </>
      )}
    </div>
    </div>
  );
}
