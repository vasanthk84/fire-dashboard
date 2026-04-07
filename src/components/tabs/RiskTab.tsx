import type { ApexAxisChartSeries, ApexOptions } from 'apexcharts';
import { PieChart, Layers } from 'lucide-react';
import { ApexChartComponent } from '../ApexChartComponent';

interface RiskTabProps {
  enableRebalancing: boolean;
  targetEquityPre: number;
  targetEquityPost: number;
  glideYears: number;
  onInput: (key: 'enableRebalancing' | 'targetEquityPre' | 'targetEquityPost' | 'glideYears', value: number | boolean) => void;
  equityPctSeries: ApexAxisChartSeries;
  equityPctOptions: ApexOptions;
  netWorthSeries: ApexAxisChartSeries;
  netWorthOptions: ApexOptions;
}

export function RiskTab(props: RiskTabProps) {
  const {
    enableRebalancing,
    targetEquityPre,
    targetEquityPost,
    glideYears,
    onInput,
    equityPctSeries,
    equityPctOptions,
    netWorthSeries,
    netWorthOptions
  } = props;

  return (
    <div>
      <div className="chart-container">
        <div className="chart-header">
          <div className="chart-title" style={{ color: '#f59e0b' }}><PieChart size={18} /> Equity Allocation Over Time</div>
          <label className="checkbox-wrapper">
            <input type="checkbox" checked={enableRebalancing} onChange={(event) => onInput('enableRebalancing', event.target.checked)} />
            Enable Rebalancing
          </label>
        </div>

        {enableRebalancing && (
          <div className="risk-controls">
            <div className="input-wrapper">
              <label>Pre-Retire %</label>
              <input type="number" min={50} max={100} step={5} value={targetEquityPre} onChange={(event) => onInput('targetEquityPre', Number(event.target.value))} />
            </div>
            <div className="input-wrapper">
              <label>Post-Retire %</label>
              <input type="number" min={30} max={80} step={5} value={targetEquityPost} onChange={(event) => onInput('targetEquityPost', Number(event.target.value))} />
            </div>
            <div className="input-wrapper">
              <label>Glide Years</label>
              <input type="number" min={0} max={20} value={glideYears} onChange={(event) => onInput('glideYears', Number(event.target.value))} />
            </div>
          </div>
        )}

        <div className="chart-wrapper">
          <ApexChartComponent type="area" series={equityPctSeries} options={equityPctOptions} />
        </div>
      </div>

      <div className="chart-container">
        <div className="chart-header">
          <div className="chart-title" style={{ color: 'var(--primary)' }}><Layers size={18} /> Net Worth Composition</div>
        </div>
        <div className="chart-wrapper">
          <ApexChartComponent type="bar" series={netWorthSeries} options={netWorthOptions} />
        </div>
      </div>
    </div>
  );
}
