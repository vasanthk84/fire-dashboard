import { OptionsCapitalHint } from './OptionsCapitalHint';
import type { CalculationResults } from '../types';
export function OptionsYieldSource({ value }: { value: CalculationResults['summary']['optionsYield'] }) {
  if (!value) return null;
  return <div role="status" style={{ padding: 12, fontSize: 12, color: 'var(--text-2)' }}>
    <OptionsCapitalHint value={value.capital} />
    Options projection: {(value.annualRate * 100).toFixed(2)}%/yr — {value.source === 'actual'
      ? 'actual gross F&O trend, average of ' + value.months + ' reported expiry months × 12 (may include a partial month). Based on the portfolio capital shown above; before charges.'
      : 'manual fallback: ' + value.reason + '.'}
  </div>;
}
