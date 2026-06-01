import type { ApexOptions } from 'apexcharts';
import type { FireProjection, WithdrawalProjection, Snapshot, Expenses } from '../types';
import { fmtL } from './formatters';

export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function isDark(): boolean {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

const MONO = "'JetBrains Mono', ui-monospace, monospace";
const SANS = "'Plus Jakarta Sans', sans-serif";

export const ASSET_SERIES = [
  { key: 'mf' as const, label: 'Mutual Funds', color: '#4f8cff' },
  { key: 'stocksIndia' as const, label: 'Stocks IN', color: '#f5a524' },
  { key: 'usStocks' as const, label: 'US Stocks', color: '#9b8cff' },
  { key: 'bonds' as const, label: 'Bonds', color: '#2dd4a7' },
  { key: 'emergencyFund' as const, label: 'Emergency', color: '#64748b' },
  { key: 'epf' as const, label: 'EPF', color: '#f25f9c' }
];

export const EXPENSE_META = [
  { key: 'rent' as keyof Expenses, label: 'Rent', color: '#4f8cff' },
  { key: 'groceries' as keyof Expenses, label: 'Groceries', color: '#2dd4a7' },
  { key: 'utilities' as keyof Expenses, label: 'Utilities', color: '#f5a524' },
  { key: 'transport' as keyof Expenses, label: 'Transport', color: '#9b8cff' },
  { key: 'health' as keyof Expenses, label: 'Health', color: '#f25f9c' },
  { key: 'entertainment' as keyof Expenses, label: 'Leisure', color: '#22b8cf' },
  { key: 'misc' as keyof Expenses, label: 'Misc', color: '#94a3b8' }
];

export const ONETIME_META = [
  { key: 'homeBuying' as const, label: 'Home' },
  { key: 'carBuying' as const, label: 'Car' },
  { key: 'renovation' as const, label: 'Renovation' },
  { key: 'wedding' as const, label: 'Wedding' },
  { key: 'misc' as const, label: 'Misc' }
];

function baseAxes(categories: (string | number)[], yFmt: (v: any) => string): ApexOptions {
  const grid = cssVar('--grid');
  const lab = cssVar('--text-3');
  return {
    grid: { borderColor: grid, strokeDashArray: 4, padding: { left: 6, right: 12 } },
    xaxis: {
      categories,
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: { colors: lab, fontSize: '11px', fontFamily: MONO },
        rotate: 0,
        hideOverlappingLabels: true
      }
    },
    yaxis: {
      labels: {
        style: { colors: lab, fontSize: '11px', fontFamily: MONO },
        formatter: yFmt
      }
    },
    tooltip: {
      theme: isDark() ? 'dark' : 'light',
      style: { fontFamily: SANS }
    },
    legend: { show: false },
    dataLabels: { enabled: false }
  };
}

function yL(v: any): string {
  const numVal = Number(v);
  if (Math.abs(numVal) >= 100) return (numVal / 100).toFixed(1) + 'Cr';
  return Math.round(numVal) + 'L';
}

function clip(proj: FireProjection[], maxYear: number): FireProjection[] {
  return proj.filter((p) => p.year <= maxYear);
}

export const CHARTS = {
  corpus(proj: FireProjection[], retYear: number) {
    const data = clip(proj, retYear + 8);
    const accent = cssVar('--accent');
    return (): ApexOptions => ({
      ...baseAxes(data.map((p) => p.year), yL),
      series: [{ name: 'Corpus', data: data.map((p) => Number(p.total.toFixed(1))) }],
      chart: { type: 'area', height: 300, background: 'transparent', toolbar: { show: false } },
      colors: [accent],
      stroke: { width: 2.5, curve: 'smooth' },
      fill: {
        type: 'gradient',
        gradient: { shadeIntensity: 1, opacityFrom: 0.32, opacityTo: 0.02, stops: [0, 95] }
      },
      markers: { size: 0, hover: { size: 5 } },
      tooltip: {
        theme: isDark() ? 'dark' : 'light',
        style: { fontFamily: SANS },
        y: { formatter: (v) => fmtL(Number(v)) }
      },
      annotations: {
        xaxis: [{
          x: data.findIndex((p) => p.year === retYear),
          borderColor: cssVar('--text-3'),
          label: {
            text: 'Retire ' + retYear,
            style: {
              fontSize: '10px',
              fontFamily: SANS,
              color: cssVar('--text'),
              background: cssVar('--surface-3')
            }
          }
        }]
      }
    });
  },

  composition(proj: FireProjection[], retYear: number) {
    const data = clip(proj, retYear + 8);
    return (): ApexOptions => ({
      ...baseAxes(data.map((p) => p.year), yL),
      series: ASSET_SERIES.map((a) => ({
        name: a.label,
        data: data.map((p) => Number(p[a.key].toFixed(1)))
      })),
      chart: { type: 'area', stacked: true, height: 320, background: 'transparent', toolbar: { show: false } },
      colors: ASSET_SERIES.map((a) => a.color),
      stroke: { width: 1, curve: 'smooth' },
      fill: {
        type: 'gradient',
        gradient: { opacityFrom: 0.7, opacityTo: 0.45 }
      },
      tooltip: {
        theme: isDark() ? 'dark' : 'light',
        style: { fontFamily: SANS },
        shared: true,
        y: { formatter: (v) => fmtL(Number(v)) }
      }
    });
  },

  equity(data: { years: number[]; drift: number[]; rebalanced: number[]; target: number[] }) {
    const accent = cssVar('--accent');
    const series = [{ name: 'Natural Drift', data: data.drift }];
    if (data.rebalanced.length) {
      series.push({ name: 'With Rebalancing', data: data.rebalanced });
    }
    series.push({ name: 'Target Equity %', data: data.target });
    const colors = [accent, '#2dd4a7', cssVar('--text-3')];
    return (): ApexOptions => ({
      ...baseAxes(data.years, (v) => v + '%'),
      series,
      chart: { type: 'line', height: 300, background: 'transparent', toolbar: { show: false } },
      colors,
      stroke: {
        width: data.rebalanced.length ? [2.5, 2.5, 1.5] : [2.5, 1.5],
        curve: 'smooth',
        dashArray: data.rebalanced.length ? [0, 0, 6] : [0, 6]
      },
      markers: { size: 0 },
      tooltip: {
        theme: isDark() ? 'dark' : 'light',
        style: { fontFamily: SANS },
        y: { formatter: (v) => v + '%' }
      },
      annotations: {
        yaxis: [{
          y: 80,
          borderColor: cssVar('--neg'),
          strokeDashArray: 4,
          label: {
            text: 'High risk',
            style: {
              fontSize: '10px',
              fontFamily: SANS,
              color: '#fff',
              background: cssVar('--neg')
            }
          }
        }]
      }
    });
  },

  incomeVsExpense(proj: FireProjection[], retYear: number, returnYear: number, applyTax: boolean) {
    const data = clip(proj, retYear + 8);
    return (): ApexOptions => ({
      ...baseAxes(data.map((p) => p.year), (v) => Number(v).toFixed(1) + 'L'),
      series: [
        { name: 'Passive / mo', type: 'area', data: data.map((p) => Number(p.passiveIncomeMonthly.toFixed(2))) },
        { name: 'Expense / mo', type: 'line', data: data.map((p) => p.year < returnYear ? null : p.calculatedMonthlyExpense) } as any
      ],
      chart: { type: 'line', height: 280, background: 'transparent', toolbar: { show: false } },
      colors: [cssVar('--accent'), cssVar('--warn')],
      stroke: { width: [2.5, 2], curve: 'smooth' },
      fill: {
        type: ['gradient', 'solid'],
        gradient: { opacityFrom: 0.3, opacityTo: 0.02 }
      },
      markers: { size: 0 },
      tooltip: {
        theme: isDark() ? 'dark' : 'light',
        style: { fontFamily: SANS },
        y: { formatter: (v) => v == null ? '—' : Number(v).toFixed(2) + 'L/mo' }
      },
      annotations: {
        xaxis: [
          {
            x: data.findIndex((p) => p.year === returnYear),
            borderColor: cssVar('--text-3'),
            label: {
              text: 'Return',
              style: {
                fontSize: '9px',
                fontFamily: SANS,
                color: cssVar('--text'),
                background: cssVar('--surface-3')
              }
            }
          },
          {
            x: data.findIndex((p) => p.year === retYear),
            borderColor: cssVar('--accent'),
            label: {
              text: 'Retire',
              style: {
                fontSize: '9px',
                fontFamily: SANS,
                color: '#fff',
                background: cssVar('--accent')
              }
            }
          }
        ]
      }
    });
  },

  expenseDonut(expenses: Expenses) {
    const items = EXPENSE_META.filter((e) => expenses[e.key] > 0);
    const total = items.reduce((s, e) => s + expenses[e.key], 0);
    return (): ApexOptions => ({
      series: items.map((e) => expenses[e.key]),
      chart: { type: 'donut', height: 240, background: 'transparent' },
      labels: items.map((e) => e.label),
      colors: items.map((e) => e.color),
      stroke: { width: 0 },
      legend: { show: false },
      dataLabels: { enabled: false },
      plotOptions: {
        pie: {
          donut: {
            size: '70%',
            labels: {
              show: true,
              total: {
                show: true,
                label: 'Monthly',
                fontSize: '11px',
                fontFamily: SANS,
                color: cssVar('--text-3'),
                formatter: () => '₹' + Math.round(total).toLocaleString('en-IN')
              },
              value: {
                fontFamily: MONO,
                color: cssVar('--text'),
                fontSize: '16px',
                formatter: (v) => '₹' + Math.round(Number(v)).toLocaleString('en-IN')
              }
            }
          }
        }
      },
      tooltip: {
        theme: isDark() ? 'dark' : 'light',
        style: { fontFamily: SANS },
        y: { formatter: (v) => '₹' + Math.round(Number(v)).toLocaleString('en-IN') }
      }
    });
  },

  depletion(scenario: WithdrawalProjection[], rateLabel: string) {
    const accent = cssVar('--accent');
    return (): ApexOptions => ({
      ...baseAxes(scenario.map((r) => r.year), yL),
      series: [{ name: 'Corpus', data: scenario.map((r) => Number(r.corpusStart.toFixed(0))) }],
      chart: { type: 'area', height: 240, background: 'transparent', toolbar: { show: false } },
      colors: [accent],
      stroke: { width: 2.5, curve: 'smooth' },
      fill: {
        type: 'gradient',
        gradient: { opacityFrom: 0.3, opacityTo: 0.02 }
      },
      markers: { size: 0, hover: { size: 5 } },
      tooltip: {
        theme: isDark() ? 'dark' : 'light',
        style: { fontFamily: SANS },
        y: { formatter: (v) => fmtL(Number(v)) }
      }
    });
  },

  progression(selected: Snapshot[]) {
    return (): ApexOptions => ({
      ...baseAxes(selected.map((s) => new Date(s.snapshotDate).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })), yL),
      series: [
        { name: 'Wealth', data: selected.map((s) => Number(s.results.currentWealth.toFixed(1))) },
        { name: 'FIRE target', data: selected.map((s) => Number(s.results.fireNumber.toFixed(1))) }
      ],
      chart: { type: 'line', height: 280, background: 'transparent', toolbar: { show: false } },
      colors: [cssVar('--accent'), cssVar('--warn')],
      stroke: { width: [3, 1.5], curve: 'smooth', dashArray: [0, 6] },
      markers: { size: 4 },
      tooltip: {
        theme: isDark() ? 'dark' : 'light',
        style: { fontFamily: SANS },
        y: { formatter: (v) => fmtL(Number(v)) }
      }
    });
  }
};
