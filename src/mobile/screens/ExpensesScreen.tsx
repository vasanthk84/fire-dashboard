import { useMemo, useState } from 'react';
import { Wand2 } from 'lucide-react';
import type { UseFirePlannerReturn } from '../../hooks/useFirePlanner';
import type { Expenses, Inputs, OneTimeExpenses } from '../../types';
import { fmtL, fmtRupees } from '../../utils/formatters';
import { MHero, MChipNeutral, MShareBar, MSwitch, MSwitchRow, MStepper, MTile, MEditTile } from '../components/primitives';
import { M_EXPENSE_COLORS, M_HERO_TINT } from '../mobileColors';

// Mirrors the Expenses category order/labels from design_handoff_fire_mobile's
// mobile spec exactly. Desktop's own EXPENSE_META (chartBuilders.ts) uses
// slightly different labels ("Leisure" not "Entertainment") and hex values,
// so mobile keeps its own copy rather than importing that one — see
// mobileColors.ts's header comment for why.
const CATEGORY_META: Array<{ key: keyof Expenses; label: string }> = [
  { key: 'rent', label: 'Rent' },
  { key: 'groceries', label: 'Groceries' },
  { key: 'utilities', label: 'Utilities' },
  { key: 'transport', label: 'Transport' },
  { key: 'health', label: 'Health' },
  { key: 'entertainment', label: 'Entertainment' },
  { key: 'misc', label: 'Misc' }
];

// Return-to-India setup card — editable steppers (parity with desktop's
// NumberInput fields), relabels desktop's "Home"/"Wedding" to "Home
// setup"/"Family event". oneTimeExpenses values are stored in raw rupees
// (same unit as `expenses`), per api/calculate.js dividing by 100000 to get
// lakhs — the steppers below convert Lakhs <-> raw rupees at the edges.
const SETUP_META: Array<{ key: keyof OneTimeExpenses; label: string }> = [
  { key: 'homeBuying', label: 'Home setup' },
  { key: 'carBuying', label: 'Car' },
  { key: 'renovation', label: 'Renovation' },
  { key: 'wedding', label: 'Family event' },
  { key: 'misc', label: 'Misc' }
];

interface ExpensesScreenProps {
  planner: UseFirePlannerReturn;
  reinvestWheel: boolean;
  onReinvestWheelChange: (next: boolean) => void;
}

export function ExpensesScreen({ planner, reinvestWheel, onReinvestWheelChange }: ExpensesScreenProps) {
  const {
    expenses,
    oneTimeExpenses,
    showOneTime,
    setShowOneTime,
    inputs,
    handleExpense,
    handleOneTime,
    handleInput,
    runCalculation,
    compareApartmentScenarios,
    sumExpenses,
    fireNumberLakhs
  } = planner;

  const [comparison, setComparison] = useState<{ keep: number; sell: number } | null>(null);
  const [comparing, setComparing] = useState(false);

  const runCompare = async () => {
    setComparing(true);
    try {
      const result = await compareApartmentScenarios();
      setComparison(result);
    } finally {
      setComparing(false);
    }
  };

  const total = CATEGORY_META.reduce((s, c) => s + (expenses[c.key] || 0), 0);
  const annualLakhs = (total * 12) / 100000;
  const oneTimeTotal = sumExpenses(oneTimeExpenses);

  const segments = CATEGORY_META.filter((c) => (expenses[c.key] || 0) > 0).map((c) => ({
    pct: total > 0 ? ((expenses[c.key] || 0) / total) * 100 : 0,
    color: M_EXPENSE_COLORS[c.key]
  }));

  const onToggleReturnToIndia = (checked: boolean) => {
    setShowOneTime(checked);
    void runCalculation({ oneTimeExpenseTotal: checked ? sumExpenses(oneTimeExpenses) : 0 });
  };

  const onToggleApplyTax = (checked: boolean) => {
    handleInput('applyTax', checked);
    void runCalculation({ applyTax: checked });
  };

  const onToggleVilla = (checked: boolean) => {
    handleInput('villaEnabled', checked);
    void runCalculation({ villaEnabled: checked });
  };

  const onToggleApartmentSell = (checked: boolean) => {
    handleInput('apartmentSellAtVilla', checked);
    void runCalculation({ apartmentSellAtVilla: checked });
  };

  // Every villa/apartment field below is a real, shared Inputs key, so
  // edits here also update desktop (same hook instance) — mirrors
  // AssumptionsScreen's commitDirect helper.
  const commitInput = (key: keyof Inputs) => (n: number) => {
    handleInput(key, n);
    void runCalculation({ [key]: n } as Partial<Inputs>);
  };

  // Mirrors desktop's ExpensesTab.tsx villaEmi useMemo (standard amortisation
  // formula) verbatim, for instant display without waiting on the next
  // calculate.js round trip.
  const villaEmi = useMemo(() => {
    const r = inputs.villaLoanRatePct / 100 / 12;
    const n = Math.round(inputs.villaLoanTenureYears * 12);
    const principal = inputs.villaLoanAmountLakhs * 100000;
    if (principal <= 0 || n <= 0) return { monthlyINR: 0, payoffYear: null as number | null };
    const emi = r > 0 ? (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1) : principal / n;
    return { monthlyINR: emi, payoffYear: inputs.villaYear + Math.ceil(n / 12) - 1 };
  }, [inputs.villaLoanRatePct, inputs.villaLoanTenureYears, inputs.villaLoanAmountLakhs, inputs.villaYear]);

  // Mirrors desktop's ExpensesTab.tsx apartmentAtVillaYear useMemo verbatim.
  const apartmentAtVillaYear = useMemo(() => {
    const yearsToVilla = Math.max(0, inputs.villaYear - inputs.startYear);
    return inputs.apartmentCurrent * Math.pow(1 + inputs.apartmentAppreciationPct / 100, yearsToVilla);
  }, [inputs.apartmentCurrent, inputs.apartmentAppreciationPct, inputs.villaYear, inputs.startYear]);

  const netFromPortfolio = inputs.apartmentSellAtVilla
    ? inputs.villaDownPaymentLakhs - apartmentAtVillaYear
    : inputs.villaDownPaymentLakhs;

  return (
    <div className="m-screen">
      <div className="m-screen-head" style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <h1 className="m-h1">Expenses</h1>
        <span className="m-caption" style={{ fontSize: 11 }}>India lifestyle · from {inputs.returnYear}</span>
      </div>

      <div className="m-stack">
        <MHero tint1={M_HERO_TINT.expenses} tint2="rgba(224,85,107,.03)" lineColor="rgba(224,85,107,.24)">
          <div className="m-eyebrow">Total per month</div>
          <div className="m-hero-metric" style={{ marginTop: 8 }}>{fmtRupees(total)}</div>
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <MChipNeutral label={`${fmtL(annualLakhs)}/yr`} />
            <MChipNeutral label={`FIRE target ${fmtL(fireNumberLakhs)}`} />
          </div>
          <div style={{ marginTop: 14 }}>
            <MShareBar segments={segments} height={10} />
          </div>
        </MHero>

        <div className="m-card m-cat-card">
          {CATEGORY_META.map((c) => {
            const value = expenses[c.key] || 0;
            const pct = total > 0 ? Math.round((value / total) * 100) : 0;
            return (
              <div className="m-cat-row" key={c.key}>
                <span className="m-cat-swatch" style={{ background: M_EXPENSE_COLORS[c.key] }} />
                <div className="m-cat-label-block">
                  <span className="m-body-label">{c.label}</span>
                  <span className="m-caption" style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5 }}>{pct}% of spend</span>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  <MStepper
                    value={value}
                    step={1000}
                    min={0}
                    format={(n) => fmtRupees(n)}
                    onChange={(next) => void handleExpense(c.key, String(next))}
                  />
                </div>
              </div>
            );
          })}
          <div className="m-cat-total-row">
            <span className="m-cat-total-label">Total / month</span>
            <span className="m-cat-total-value">{fmtRupees(total)}</span>
          </div>
        </div>

        <div className="m-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <MSwitchRow
            label="Apply 12.5% tax drag"
            sub="Taxes passive income in retirement"
            checked={inputs.applyTax}
            onChange={onToggleApplyTax}
          />
          <MSwitchRow
            label="Return-to-India setup costs"
            sub="One-time relocation spend"
            checked={showOneTime}
            onChange={onToggleReturnToIndia}
          />
          <MSwitchRow
            label="Compound wheeling premiums"
            sub="Otherwise swept to cash"
            checked={reinvestWheel}
            onChange={onReinvestWheelChange}
          />
        </div>

        {showOneTime && (
          <div className="m-card">
            <div className="m-eyebrow">Return-to-India setup</div>
            <div className="m-grid-2" style={{ marginTop: 12 }}>
              {SETUP_META.map((o) => (
                <MEditTile
                  key={o.key}
                  top={o.label}
                  value={oneTimeExpenses[o.key] / 100000}
                  step={0.5}
                  format={(n) => fmtL(n)}
                  onChange={(n) => void handleOneTime(o.key, String(Math.round(n * 100000)))}
                />
              ))}
            </div>
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center' }}>
              <span style={{ font: '600 11.5px var(--font-sans)', color: 'var(--text-2)' }}>One-time total</span>
              <span style={{ marginLeft: 'auto', font: '700 14px var(--font-mono)', color: 'var(--neg)' }}>{fmtL(oneTimeTotal / 100000)}</span>
            </div>
          </div>
        )}

        <div className="m-card">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
              <span className="m-card-title">Villa purchase</span>
              <span className="m-caption" style={{ lineHeight: 1.45 }}>
                Optional goal — down payment hits the corpus, EMI draws only post-retirement
              </span>
            </div>
            <div style={{ marginLeft: 'auto', flexShrink: 0, marginTop: 2 }}>
              <MSwitch checked={inputs.villaEnabled} onChange={onToggleVilla} />
            </div>
          </div>

          {inputs.villaEnabled && (
            <>
              <div className="m-grid-2" style={{ marginTop: 14 }}>
                <MEditTile
                  top="Purchase year"
                  value={inputs.villaYear}
                  step={1}
                  format={(n) => String(n)}
                  onChange={commitInput('villaYear')}
                />
                <MEditTile
                  top="Down payment · ₹L"
                  value={inputs.villaDownPaymentLakhs}
                  step={5}
                  format={(n) => fmtL(n)}
                  onChange={commitInput('villaDownPaymentLakhs')}
                  foot={`inflated to ${inputs.villaYear}`}
                />
                <MEditTile
                  top="Loan amount · ₹L"
                  value={inputs.villaLoanAmountLakhs}
                  step={1}
                  format={(n) => fmtL(n)}
                  onChange={commitInput('villaLoanAmountLakhs')}
                />
                <MEditTile
                  top="Loan rate %"
                  value={inputs.villaLoanRatePct}
                  step={0.1}
                  format={(n) => `${n.toFixed(1)}%`}
                  onChange={commitInput('villaLoanRatePct')}
                />
                <MEditTile
                  top="Loan tenure (yrs)"
                  value={inputs.villaLoanTenureYears}
                  step={1}
                  format={(n) => String(n)}
                  onChange={commitInput('villaLoanTenureYears')}
                />
              </div>

              <div className="m-grid-2" style={{ marginTop: 10 }}>
                <MTile
                  top="Monthly EMI"
                  value={fmtRupees(villaEmi.monthlyINR)}
                  foot={`${inputs.villaLoanAmountLakhs}L @ ${inputs.villaLoanRatePct}%`}
                />
                <MTile
                  top="Loan paid off"
                  value={String(villaEmi.payoffYear ?? '—')}
                  foot={`${inputs.villaLoanTenureYears}y tenure`}
                />
                <MTile
                  top="Cash needed"
                  value={fmtL(inputs.villaDownPaymentLakhs + inputs.villaLoanAmountLakhs)}
                  foot="down + principal"
                />
              </div>

              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                <MSwitchRow
                  label="Sell existing apartment"
                  sub={`Est. ${fmtL(apartmentAtVillaYear)} in ${inputs.villaYear} toward down payment`}
                  checked={inputs.apartmentSellAtVilla}
                  onChange={onToggleApartmentSell}
                />
                <div className="m-grid-2" style={{ marginTop: 10 }}>
                  <MTile
                    top="Apartment today"
                    value={fmtL(inputs.apartmentCurrent)}
                    foot={`${inputs.apartmentAppreciationPct}%/yr · edit in Assumptions`}
                  />
                  <MTile
                    top={inputs.apartmentSellAtVilla ? 'Net from portfolio' : 'From portfolio'}
                    value={(netFromPortfolio < 0 ? '+' : '') + fmtL(Math.abs(netFromPortfolio))}
                    valueColor={netFromPortfolio < 0 ? 'var(--pos)' : undefined}
                    foot={inputs.apartmentSellAtVilla ? 'down payment − sale proceeds' : 'apartment kept as 2nd property'}
                  />
                </div>

                <button
                  type="button"
                  className="m-btn-secondary"
                  style={{ marginTop: 12, width: '100%', justifyContent: 'center' }}
                  onClick={() => void runCompare()}
                  disabled={comparing}
                >
                  <Wand2 size={14} strokeWidth={1.8} />
                  {comparing ? 'Comparing…' : 'Compare Keep vs Sell'}
                </button>

                {comparison && (
                  <div className="m-card" style={{ marginTop: 10, background: 'var(--surface-3)' }}>
                    <div className="m-eyebrow">Corpus at retirement ({inputs.retirementYear})</div>
                    <div className="m-grid-2" style={{ marginTop: 10 }}>
                      <MTile top="Keep (2nd property)" value={fmtL(comparison.keep)} />
                      <MTile top="Sell at purchase" value={fmtL(comparison.sell)} />
                    </div>
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                      <span
                        className="m-body-label"
                        style={{ color: comparison.sell >= comparison.keep ? 'var(--pos)' : 'var(--neg)' }}
                      >
                        {comparison.sell === comparison.keep
                          ? 'No difference'
                          : comparison.sell > comparison.keep
                            ? `Selling nets +${fmtL(comparison.sell - comparison.keep)} more`
                            : `Keeping nets +${fmtL(comparison.keep - comparison.sell)} more`}
                      </span>
                    </div>
                    <div className="m-caption" style={{ marginTop: 8, lineHeight: 1.45 }}>
                      Assumes {inputs.apartmentAppreciationPct}%/yr apartment growth vs your portfolio's blended
                      return. Doesn't account for brokerage, capital-gains tax on the sale, or wanting two properties.
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
