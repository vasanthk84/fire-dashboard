import type { UseFirePlannerReturn } from '../../hooks/useFirePlanner';
import { fmtL, fmtRupees } from '../../utils/formatters';
import { MTile, MStepper } from '../components/primitives';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtUSD(n: number) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

// Desktop's Retirement401kTab.tsx keeps a fund/loan split (52,226 / 9,228 by
// default) as component-local state that is never actually persisted — only
// their sum lives in the shared `inputs.us401k`. Mobile has no editable
// breakdown UI anywhere, so rather than freeze these two numbers forever at
// their initial default (going stale the moment us401k changes for any
// reason) they're derived by applying that same default 85/15 proportion to
// today's live total — matches the spec's stated defaults exactly today,
// and scales sensibly if the total ever changes.
const DEFAULT_FUND_BAL = 52226;
const DEFAULT_LOAN_BAL = 9228;
const FUND_SHARE = DEFAULT_FUND_BAL / (DEFAULT_FUND_BAL + DEFAULT_LOAN_BAL);

interface AssumptionsScreenProps {
  planner: UseFirePlannerReturn;
}

export function AssumptionsScreen({ planner }: AssumptionsScreenProps) {
  const { inputs, handleInput, runCalculation } = planner;

  const onSalaryChange = (next: number) => {
    handleInput('annualSalary', next);
    void runCalculation({ annualSalary: next });
  };

  const fundBal = inputs.us401k * FUND_SHARE;
  const loanBal = inputs.us401k * (1 - FUND_SHARE);

  const groups: Array<{ title: string; fields: Array<{ label: string; value: string }> }> = [
    {
      title: 'Timeline',
      fields: [
        { label: 'Start', value: `${MONTH_NAMES[inputs.startMonth - 1]} ${inputs.startYear}` },
        { label: 'Return to India', value: String(inputs.returnYear) },
        { label: 'Retire', value: String(inputs.retirementYear) },
        { label: '401k draw', value: String(inputs.withdraw401kYear) }
      ]
    },
    {
      title: 'US 401k',
      fields: [
        { label: 'Fund balance', value: fmtUSD(fundBal) },
        { label: 'Loan balance', value: fmtUSD(loanBal) },
        { label: 'Employer match', value: `${(inputs.us401kEmployerMatchPct * 100).toFixed(0)}%` },
        { label: '₹ / $', value: String(inputs.usdExchangeRate) }
      ]
    },
    {
      title: 'PF & retirals',
      fields: [
        { label: 'EPF today', value: fmtL(inputs.epfCurrent) },
        { label: 'Basic pay', value: fmtRupees(inputs.basicPay) },
        { label: 'EPF rate', value: `${(inputs.epfRate * 100).toFixed(2)}%` },
        { label: 'VPF rate', value: `${(inputs.vpfRate * 100).toFixed(0)}%` },
        { label: 'Gratuity', value: fmtL(inputs.gratuityAmount / 100000) },
        { label: 'Superannuation', value: fmtL(inputs.superannuationBalance / 100000) }
      ]
    },
    {
      title: 'Rates',
      fields: [
        { label: 'Cash', value: `${inputs.pfCashRatePct.toFixed(1)}%` },
        { label: 'Bonds', value: `${inputs.pfBondRatePct.toFixed(1)}%` },
        { label: 'Wheeling', value: `${inputs.pfWheelYieldPctMonthly.toFixed(2)}%/mo` },
        { label: 'Inflation', value: `${(inputs.inflationRate * 100).toFixed(0)}%` },
        { label: 'Post-FIRE', value: `${(inputs.postFireRate * 100).toFixed(1)}%` },
        { label: 'Tax on income', value: `${inputs.pfReinvestTaxPct}%` }
      ]
    }
  ];

  return (
    <div className="m-screen">
      <div className="m-screen-head" style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <h1 className="m-h1">Assumptions</h1>
        <span className="m-caption" style={{ fontSize: 11 }}>drives every projection</span>
      </div>

      <div className="m-stack">
        <div className="m-card">
          <div className="m-eyebrow">US salary</div>
          <div style={{ marginTop: 10 }}>
            <MStepper
              value={inputs.annualSalary}
              step={5000}
              min={0}
              size="lg"
              format={(n) => fmtUSD(n)}
              onChange={onSalaryChange}
            />
          </div>
          <div className="m-caption" style={{ marginTop: 8 }}>
            Contributions are a share of this — at $0 every rate projects the same.
          </div>
        </div>

        {groups.map((g) => (
          <div className="m-card" key={g.title}>
            <div className="m-eyebrow">{g.title}</div>
            <div className="m-grid-2" style={{ marginTop: 12 }}>
              {g.fields.map((f) => (
                <MTile key={f.label} top={f.label} value={f.value} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
