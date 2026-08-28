import type { Inputs } from '../../types';
import type { UseFirePlannerReturn } from '../../hooks/useFirePlanner';
import { fmtL, fmtRupees } from '../../utils/formatters';
import { MStepper, MEditTile } from '../components/primitives';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtUSD(n: number) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

interface AssumptionsScreenProps {
  planner: UseFirePlannerReturn;
}

interface EditField {
  label: string;
  value: number;
  step: number;
  min?: number;
  format: (n: number) => string;
  onChange: (next: number) => void;
  foot?: string;
}

export function AssumptionsScreen({ planner }: AssumptionsScreenProps) {
  const { inputs, handleInput, runCalculation } = planner;

  const onSalaryChange = (next: number) => {
    handleInput('annualSalary', next);
    void runCalculation({ annualSalary: next });
  };

  // Generic commit helpers — every field below is a real, shared Inputs key,
  // so every edit here also updates desktop (same hook instance).
  const commitDirect = (key: keyof Inputs) => (n: number) => {
    handleInput(key, n);
    void runCalculation({ [key]: n } as Partial<Inputs>);
  };
  // Fields stored as a decimal fraction (0.12) but shown/edited as a percent (12.0).
  const commitPct = (key: keyof Inputs) => (n: number) => {
    const v = n / 100;
    handleInput(key, v);
    void runCalculation({ [key]: v } as Partial<Inputs>);
  };
  // Fields stored as raw ₹ but shown/edited in Lakhs, matching how this group
  // already displays EPF/gratuity/superannuation elsewhere on both platforms.
  const commitLakhsFromRaw = (key: keyof Inputs) => (n: number) => {
    const raw = Math.round(n * 100000);
    handleInput(key, raw);
    void runCalculation({ [key]: raw } as Partial<Inputs>);
  };

  // "Start" is a single field on screen but two inputs (startMonth/startYear)
  // underneath — encode as one scrubbable month-index so it still reads as
  // a single stepper like the mockup, matching desktop's combined month+year control.
  const monthIndex = inputs.startYear * 12 + (inputs.startMonth - 1);
  const onStartChange = (nextIndex: number) => {
    const y = Math.floor(nextIndex / 12);
    const mo = (nextIndex % 12) + 1;
    handleInput('startYear', y);
    handleInput('startMonth', mo);
    void runCalculation({ startYear: y, startMonth: mo });
  };

  const groups: Array<{ title: string; fields: EditField[] }> = [
    {
      title: 'Timeline',
      fields: [
        {
          label: 'Start',
          value: monthIndex,
          step: 1,
          format: (n) => `${MONTH_NAMES[((n % 12) + 12) % 12]} ${Math.floor(n / 12)}`,
          onChange: onStartChange
        },
        {
          label: 'Return to India',
          value: inputs.returnYear,
          step: 1,
          min: inputs.startYear,
          format: (n) => String(n),
          onChange: commitDirect('returnYear')
        },
        {
          label: 'Retire',
          value: inputs.retirementYear,
          step: 1,
          min: inputs.startYear,
          format: (n) => String(n),
          onChange: commitDirect('retirementYear')
        },
        {
          label: '401k draw',
          value: inputs.withdraw401kYear,
          step: 1,
          min: inputs.startYear,
          format: (n) => String(n),
          onChange: commitDirect('withdraw401kYear')
        }
      ]
    },
    {
      title: 'Investments',
      fields: [
        {
          label: 'Mutual funds',
          value: inputs.mfCurrent,
          step: 0.1,
          format: (n) => fmtL(n),
          onChange: commitDirect('mfCurrent')
        },
        {
          label: 'MF SIP',
          value: inputs.mfSIP,
          step: 0.1,
          format: (n) => `${fmtL(n)}/mo`,
          onChange: commitDirect('mfSIP')
        },
        {
          label: 'MF CAGR',
          value: inputs.mfRate * 100,
          step: 0.1,
          format: (n) => `${n.toFixed(1)}%`,
          onChange: commitPct('mfRate')
        },
        {
          label: 'Indian Stocks',
          value: inputs.stocksIndia,
          step: 0.1,
          format: (n) => fmtL(n),
          onChange: commitDirect('stocksIndia')
        },
        {
          label: 'US Stocks',
          value: inputs.usStocks,
          step: 0.1,
          format: (n) => fmtL(n),
          onChange: commitDirect('usStocks')
        },
        {
          label: 'Bonds',
          value: inputs.bondsInitial,
          step: 0.1,
          format: (n) => fmtL(n),
          onChange: commitDirect('bondsInitial')
        }
      ]
    },
    {
      title: 'US 401k',
      fields: [
        {
          label: '401k balance',
          value: inputs.us401k,
          step: 1000,
          format: (n) => fmtUSD(n),
          onChange: commitDirect('us401k')
        },
        {
          label: 'Employer match',
          value: inputs.us401kEmployerMatchPct * 100,
          step: 0.5,
          format: (n) => `${n.toFixed(1)}%`,
          onChange: commitPct('us401kEmployerMatchPct')
        },
        {
          label: '₹ / $',
          value: inputs.usdExchangeRate,
          step: 1,
          format: (n) => String(n),
          onChange: commitDirect('usdExchangeRate')
        }
      ]
    },
    {
      title: 'PF & retirals',
      fields: [
        {
          label: 'EPF today',
          value: inputs.epfCurrent,
          step: 0.1,
          format: (n) => fmtL(n),
          onChange: commitDirect('epfCurrent')
        },
        {
          label: 'Basic pay',
          value: inputs.basicPay,
          step: 100,
          format: (n) => fmtRupees(n),
          onChange: commitDirect('basicPay')
        },
        {
          label: 'EPF rate',
          value: inputs.epfRate * 100,
          step: 0.1,
          format: (n) => `${n.toFixed(2)}%`,
          onChange: commitPct('epfRate')
        },
        {
          label: 'VPF rate',
          value: inputs.vpfRate * 100,
          step: 0.1,
          format: (n) => `${n.toFixed(0)}%`,
          onChange: commitPct('vpfRate')
        },
        {
          label: 'Gratuity',
          value: inputs.gratuityAmount / 100000,
          step: 0.01,
          format: (n) => fmtL(n),
          onChange: commitLakhsFromRaw('gratuityAmount')
        },
        {
          label: 'Superannuation',
          value: inputs.superannuationBalance / 100000,
          step: 0.01,
          format: (n) => fmtL(n),
          onChange: commitLakhsFromRaw('superannuationBalance')
        }
      ]
    },
    {
      title: 'PPF',
      fields: [
        {
          label: 'PPF balance',
          value: inputs.ppfCurrent,
          step: 0.1,
          format: (n) => fmtL(n),
          onChange: commitDirect('ppfCurrent')
        },
        {
          label: 'PPF monthly',
          value: inputs.ppfMonthlyContribution,
          step: 500,
          format: (n) => fmtRupees(n),
          onChange: commitDirect('ppfMonthlyContribution')
        },
        {
          label: 'PPF rate',
          value: inputs.ppfRatePct,
          step: 0.1,
          format: (n) => `${n.toFixed(1)}%`,
          onChange: commitDirect('ppfRatePct')
        }
      ]
    },
    {
      title: 'Fixed Deposits',
      fields: [
        {
          label: 'FD balance',
          value: inputs.fdCurrent,
          step: 0.1,
          format: (n) => fmtL(n),
          onChange: commitDirect('fdCurrent')
        },
        {
          label: 'FD rate',
          value: inputs.fdRatePct,
          step: 0.1,
          format: (n) => `${n.toFixed(1)}%`,
          onChange: commitDirect('fdRatePct')
        }
      ]
    },
    {
      title: 'NPS',
      fields: [
        {
          label: 'NPS balance',
          value: inputs.npsCurrent,
          step: 0.1,
          format: (n) => fmtL(n),
          onChange: commitDirect('npsCurrent')
        },
        {
          label: 'NPS rate',
          value: inputs.npsRatePct,
          step: 0.1,
          format: (n) => `${n.toFixed(1)}%`,
          onChange: commitDirect('npsRatePct')
        }
      ]
    },
    {
      title: 'Options / CSP capital',
      fields: [
        {
          label: 'Portfolio',
          value: inputs.optionsPortfolioValue,
          step: 0.1,
          format: (n) => fmtL(n),
          onChange: commitDirect('optionsPortfolioValue')
        },
        {
          label: 'Premium yield',
          value: inputs.optionsYieldPct * 100,
          step: 0.5,
          format: (n) => `${n.toFixed(1)}%/yr`,
          onChange: commitPct('optionsYieldPct')
        }
      ]
    },
    {
      title: 'Rates',
      fields: [
        {
          label: 'Cash',
          value: inputs.pfCashRatePct,
          step: 0.1,
          format: (n) => `${n.toFixed(1)}%`,
          onChange: commitDirect('pfCashRatePct')
        },
        {
          label: 'Bonds',
          value: inputs.pfBondRatePct,
          step: 0.1,
          format: (n) => `${n.toFixed(1)}%`,
          onChange: commitDirect('pfBondRatePct')
        },
        {
          label: 'Wheeling',
          value: inputs.pfWheelYieldPctMonthly,
          step: 0.05,
          format: (n) => `${n.toFixed(2)}%/mo`,
          onChange: commitDirect('pfWheelYieldPctMonthly')
        },
        {
          label: 'Inflation',
          value: inputs.inflationRate * 100,
          step: 0.1,
          format: (n) => `${n.toFixed(0)}%`,
          onChange: commitPct('inflationRate')
        },
        {
          label: 'Post-FIRE',
          value: inputs.postFireRate * 100,
          step: 0.1,
          format: (n) => `${n.toFixed(1)}%`,
          onChange: commitPct('postFireRate')
        },
        {
          label: 'Tax on income',
          value: inputs.pfReinvestTaxPct,
          step: 1,
          format: (n) => `${n.toFixed(0)}%`,
          onChange: commitDirect('pfReinvestTaxPct')
        }
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
                <MEditTile
                  key={f.label}
                  top={f.label}
                  value={f.value}
                  step={f.step}
                  min={f.min}
                  format={f.format}
                  onChange={f.onChange}
                  foot={f.foot}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
