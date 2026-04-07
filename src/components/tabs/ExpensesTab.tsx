import { ShoppingCart, TrendingUp } from 'lucide-react';
import type { ApexAxisChartSeries, ApexOptions } from 'apexcharts';
import type { Expenses, FireProjection, Inputs, OneTimeExpenses } from '../../types';
import { ApexChartComponent } from '../ApexChartComponent';
import { fmtL } from '../../utils/formatters';

interface ExpensesTabProps {
  expenses: Expenses;
  oneTimeExpenses: OneTimeExpenses;
  showOneTime: boolean;
  currentMonthlyExp: number;
  applyTax: boolean;
  sampleTaxYear?: FireProjection;
  incomeExpenseSeries: ApexAxisChartSeries;
  incomeExpenseOptions: ApexOptions;
  onExpenseChange: (key: keyof Expenses, value: string) => void;
  onOneTimeChange: (key: keyof OneTimeExpenses, value: string) => void;
  onShowOneTimeChange: (checked: boolean) => void;
  onApplyTaxChange: (checked: boolean) => void;
}

export function ExpensesTab(props: ExpensesTabProps) {
  const {
    expenses,
    oneTimeExpenses,
    showOneTime,
    currentMonthlyExp,
    applyTax,
    sampleTaxYear,
    incomeExpenseSeries,
    incomeExpenseOptions,
    onExpenseChange,
    onOneTimeChange,
    onShowOneTimeChange,
    onApplyTaxChange
  } = props;

  return (
    <div className="analysis-grid">
      <div className="expense-panel">
        <div className="card-header" style={{ marginBottom: '16px', color: 'var(--accent-pink)' }}>
          <ShoppingCart size={14} /> Monthly Expenses
        </div>

        {Object.keys(expenses).map((key) => (
          <div className="expense-row" key={key}>
            <label style={{ textTransform: 'capitalize' }}>{key.replace(/([A-Z])/g, ' $1').trim()}</label>
            <input type="number" value={expenses[key as keyof Expenses]} onChange={(event) => onExpenseChange(key as keyof Expenses, event.target.value)} />
          </div>
        ))}

        <div className="total-expense">
          <span>Total Monthly:</span>
          <span>₹{currentMonthlyExp.toLocaleString()}</span>
        </div>

        {applyTax && sampleTaxYear && (
          <div className="tax-proof-card">
            <div className="tax-title">Tax Impact (Retirement)</div>
            <div className="tax-row"><span>Gross Passive</span><span>{fmtL(sampleTaxYear.passiveIncomeGross)}</span></div>
            <div className="tax-row"><span>Tax (12.5%)</span><span>-{fmtL(sampleTaxYear.monthlyTax)}</span></div>
            <div className="tax-row final"><span>Net Income</span><span>{fmtL(sampleTaxYear.passiveIncomeMonthly)}</span></div>
          </div>
        )}

        <div className="one-time-section">
          <label className="checkbox-wrapper">
            <input type="checkbox" checked={showOneTime} onChange={(event) => onShowOneTimeChange(event.target.checked)} />
            Return-to-India Setup Costs?
          </label>

          {showOneTime && (
            <div className="one-time-grid">
              {Object.keys(oneTimeExpenses).map((key) => (
                <div key={key} className="mini-input-group">
                  <label>{key.replace(/([A-Z])/g, ' $1').trim()}</label>
                  <input type="number" value={oneTimeExpenses[key as keyof OneTimeExpenses]} onChange={(event) => onOneTimeChange(key as keyof OneTimeExpenses, event.target.value)} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <div className="chart-container">
          <div className="chart-header">
            <div className="chart-title" style={{ color: 'var(--accent-green)' }}><TrendingUp size={18} /> Passive Income vs Expenses</div>
            <label className="checkbox-wrapper">
              <input type="checkbox" checked={applyTax} onChange={(event) => onApplyTaxChange(event.target.checked)} />
              Apply 12.5% Tax
            </label>
          </div>
          <div className="chart-wrapper">
            <ApexChartComponent type="line" series={incomeExpenseSeries} options={incomeExpenseOptions} />
          </div>
        </div>
      </div>
    </div>
  );
}
