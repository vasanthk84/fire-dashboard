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
  },

  retirement401k(
    labels: string[],
    datasets: Array<{ name: string; color: string; activeData: Array<number | null>; coastData: Array<number | null> }>,
    xMarkers: Array<{ index: number; label: string; color?: string }>
  ) {
    const series: Array<{ name: string; data: Array<number | null> }> = [];
    const colors: string[] = [];
    const dashArray: number[] = [];
    const widths: number[] = [];
    datasets.forEach((d) => {
      series.push({ name: d.name + ' · active', data: d.activeData });
      colors.push(d.color); dashArray.push(0); widths.push(2.5);
      series.push({ name: d.name + ' · coast', data: d.coastData });
      colors.push(d.color); dashArray.push(5); widths.push(2);
    });
    return (): ApexOptions => ({
      ...baseAxes(labels, (v) => '$' + Math.round(Number(v) / 1000) + 'k'),
      series,
      chart: { type: 'line', height: 340, background: 'transparent', toolbar: { show: false } },
      colors,
      stroke: { width: widths, curve: 'smooth', dashArray },
      markers: { size: 0, hover: { size: 4 } },
      legend: {
        show: true,
        position: 'top',
        fontFamily: SANS,
        fontSize: '11px',
        labels: { colors: cssVar('--text-2') }
      },
      tooltip: {
        theme: isDark() ? 'dark' : 'light',
        style: { fontFamily: SANS },
        y: { formatter: (v) => (v == null ? '—' : '$' + Math.round(Number(v)).toLocaleString('en-US')) }
      },
      annotations: {
        xaxis: xMarkers.map((m) => ({
          x: m.index,
          borderColor: m.color || cssVar('--text-3'),
          label: {
            text: m.label,
            style: {
              fontSize: '10px',
              fontFamily: SANS,
              color: cssVar('--text'),
              background: cssVar('--surface-3')
            }
          }
        }))
      }
    });
  },

  pfReinvest(labels: string[], reinvestData: number[], pfBenchData: number[], withdrawIndex?: number) {
    const accent = cssVar('--accent');
    const muted = cssVar('--text-3');
    return (): ApexOptions => ({
      ...baseAxes(labels, (v) => '₹' + (Number(v) / 100000).toFixed(1) + 'L'),
      series: [
        { name: 'Reinvestment (cash + bonds + wheeling)', data: reinvestData },
        { name: 'PF benchmark (stayed in EPF)', data: pfBenchData }
      ],
      chart: { type: 'line', height: 320, background: 'transparent', toolbar: { show: false } },
      colors: [accent, muted],
      stroke: { width: [3, 2], curve: 'smooth', dashArray: [0, 5] },
      markers: { size: 0, hover: { size: 4 } },
      legend: {
        show: true,
        position: 'top',
        fontFamily: SANS,
        fontSize: '11px',
        labels: { colors: cssVar('--text-2') }
      },
      tooltip: {
        theme: isDark() ? 'dark' : 'light',
        style: { fontFamily: SANS },
        y: { formatter: (v) => '₹' + Math.round(Number(v)).toLocaleString('en-IN') }
      },
      annotations: withdrawIndex != null ? {
        xaxis: [{
          x: withdrawIndex,
          borderColor: cssVar('--warn'),
          label: {
            text: 'PF withdrawn',
            style: {
              fontSize: '10px',
              fontFamily: SANS,
              color: '#fff',
              background: cssVar('--warn')
            }
          }
        }]
      } : undefined
    });
  },

  // ---------- Mobile shell ----------
  // Mobile always renders in the fixed green accent (#15a05f), independent of
  // the desktop [data-hue] picker — never var('--accent') here.
  mobileTrajectory(labels: string[], values: number[], retirementIndex: number, fireTargetLakhs: number) {
    return (): ApexOptions => ({
      ...baseAxes(labels, (v) => fmtL(Number(v))),
      series: [{ name: 'Corpus', data: values }],
      chart: { type: 'area', height: 220, background: 'transparent', toolbar: { show: false } },
      colors: ['#15a05f'],
      stroke: { width: 2, curve: 'smooth' },
      fill: {
        type: 'gradient',
        gradient: { shadeIntensity: 1, opacityFrom: 0.32, opacityTo: 0, stops: [0, 95] }
      },
      markers: { size: 0 },
      // Native x-axis labels are hidden: TrajectoryView renders its own
      // start/retire/end row below the chart (per the mobile spec's separate
      // axis-label row), so showing both duplicated the year ticks.
      xaxis: { categories: labels, labels: { show: false }, axisTicks: { show: false }, axisBorder: { show: false } },
      yaxis: {
        tickAmount: 3,
        labels: { style: { colors: cssVar('--text-3'), fontSize: '10px', fontFamily: MONO }, formatter: (v) => fmtL(Number(v)) }
      },
      grid: { borderColor: cssVar('--grid'), strokeDashArray: 4, padding: { left: 6, right: 12 } },
      annotations: {
        xaxis: retirementIndex >= 0 ? [{
          x: retirementIndex,
          borderColor: cssVar('--warn'),
          strokeDashArray: 4
        }] : [],
        yaxis: [{
          y: fireTargetLakhs,
          borderColor: cssVar('--neg'),
          strokeDashArray: 4
        }],
        points: retirementIndex >= 0 ? [{
          x: retirementIndex,
          y: values[retirementIndex],
          marker: { size: 3.4, fillColor: cssVar('--warn'), strokeWidth: 0 }
        }] : []
      }
    });
  },

  mobileSustainability(labels: string[], values: number[], depleted: boolean) {
    const color = depleted ? cssVar('--neg') : '#15a05f';
    return (): ApexOptions => ({
      ...baseAxes(labels, (v) => fmtL(Number(v))),
      series: [{ name: 'Corpus', data: values }],
      chart: { type: 'area', height: 200, background: 'transparent', toolbar: { show: false } },
      colors: [color],
      stroke: { width: 2, curve: 'smooth' },
      fill: {
        type: 'gradient',
        gradient: { shadeIntensity: 1, opacityFrom: 0.28, opacityTo: 0, stops: [0, 95] }
      },
      markers: { size: 0 },
      // Native x-axis labels hidden — WithdrawalView renders its own
      // retire-year / end-label row below the chart.
      xaxis: { categories: labels, labels: { show: false }, axisTicks: { show: false }, axisBorder: { show: false } },
      yaxis: {
        tickAmount: 2,
        labels: { style: { colors: cssVar('--text-3'), fontSize: '10px', fontFamily: MONO }, formatter: (v) => fmtL(Number(v)) }
      },
      grid: { borderColor: cssVar('--grid'), strokeDashArray: 4, padding: { left: 6, right: 12 } }
    });
  },

  mobileSnapshotProgression(labels: string[], values: number[], targetLakhs: number) {
    return (): ApexOptions => ({
      ...baseAxes(labels, (v) => fmtL(Number(v))),
      series: [{ name: 'Wealth', data: values }],
      chart: { type: 'line', height: 160, background: 'transparent', toolbar: { show: false } },
      colors: ['#15a05f'],
      stroke: { width: 2, curve: 'smooth' },
      markers: { size: 3.2, colors: ['#15a05f'], strokeWidth: 0, hover: { size: 4.5 } },
      grid: { borderColor: cssVar('--grid'), strokeDashArray: 4, padding: { left: 6, right: 12, top: 20 } },
      annotations: {
        yaxis: [{
          y: targetLakhs,
          borderColor: cssVar('--neg'),
          strokeDashArray: 4,
          label: {
            text: 'target ' + fmtL(targetLakhs),
            position: 'top',
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

  /** 401k balance path — accent area/line, optional dashed compare-rate
   *  overlays (colors from M_CONTRIB_COLORS), dashed warn marker+dot at the
   *  India-return index, accent dot at the final year. Native x-axis labels
   *  are hidden — K401Screen renders its own start/India/withdraw row below,
   *  same convention as mobileTrajectory/mobileSustainability. */
  mobile401kBalance(
    labels: string[],
    values: number[],
    stopIndex: number,
    compareLines: Array<{ color: string; data: Array<number | null> }> = []
  ) {
    const n = compareLines.length;
    return (): ApexOptions => ({
      series: [
        { name: 'Balance', type: 'area', data: values },
        ...compareLines.map((cl, i) => ({ name: 'Compare ' + i, type: 'line', data: cl.data }))
      ],
      chart: { type: 'line', height: 200, background: 'transparent', toolbar: { show: false } },
      colors: ['#15a05f', ...compareLines.map((cl) => cl.color)],
      // Compare-line series use a straight curve, not smooth: cubic
      // spline interpolation produced a spurious near-flat segment on
      // these overlay lines (their early values are all clustered close
      // together relative to the chart's y-scale, which the smoothing
      // algorithm overshot). Straight segments between the same yearly
      // points read identically at this size and avoid the artifact.
      stroke: {
        width: [2, ...Array(n).fill(1.3)],
        curve: ['smooth', ...Array(n).fill('straight')] as any,
        dashArray: [0, ...Array(n).fill(4)]
      },
      // fill.type/opacity as per-series ARRAYS (matching the series count) —
      // a single non-array 'gradient' cascades to every series and made
      // ApexCharts render the dashed compare lines' stroke as the gradient
      // fill (invisible against the transparent chart bg) instead of a
      // solid color. Only series 0 (the primary area) gets the gradient;
      // the compare lines get a fully transparent fill so only their
      // (correctly colored, dashed) stroke shows.
      // ApexCharts applies fill.opacity to a line-type series' own stroke
      // alpha (there's no area to fill), so 0.85 here is what actually
      // produces the spec's "dashed, opacity:.85" compare-line look — not
      // just a fill effect.
      fill: {
        type: ['gradient', ...Array(n).fill('solid')],
        gradient: { shadeIntensity: 1, opacityFrom: 0.34, opacityTo: 0, stops: [0, 100] },
        opacity: [1, ...Array(n).fill(0.85)]
      },
      markers: { size: 0 },
      xaxis: { categories: labels, labels: { show: false }, axisTicks: { show: false }, axisBorder: { show: false } },
      yaxis: {
        tickAmount: 3,
        labels: {
          style: { colors: cssVar('--text-3'), fontSize: '10px', fontFamily: MONO },
          formatter: (v) => '$' + Math.round(Number(v) / 1000) + 'k'
        }
      },
      grid: { borderColor: cssVar('--grid'), strokeDashArray: 4, padding: { left: 6, right: 12 } },
      legend: { show: false },
      dataLabels: { enabled: false },
      tooltip: { enabled: false },
      annotations: {
        xaxis: stopIndex >= 0 ? [{ x: stopIndex, borderColor: cssVar('--warn'), strokeDashArray: 3 }] : [],
        points: [
          ...(stopIndex >= 0
            ? [{ x: stopIndex, y: values[stopIndex], marker: { size: 3.4, fillColor: cssVar('--warn'), strokeWidth: 0 } }]
            : []),
          { x: values.length - 1, y: values[values.length - 1], marker: { size: 3.4, fillColor: '#15a05f', strokeWidth: 0 } }
        ]
      }
    });
  },

  /** PF Reinvest verdict sparkline — reinvestment (solid, verdict color) vs
   *  PF benchmark (dashed, muted), sharing one implicit y-axis so the two
   *  are directly comparable. No axes/grid — matches the mock's bare SVG. */
  mobilePfVerdict(labels: string[], reinvestData: number[], benchData: number[], verdictColor: string) {
    return (): ApexOptions => ({
      series: [
        { name: 'Reinvestment', data: reinvestData },
        { name: 'PF benchmark', data: benchData }
      ],
      chart: { type: 'line', height: 96, background: 'transparent', toolbar: { show: false } },
      colors: [verdictColor, cssVar('--text-3')],
      stroke: { width: [2, 1.4], curve: 'straight', dashArray: [0, 4] },
      markers: { size: 0 },
      xaxis: { categories: labels, labels: { show: false }, axisTicks: { show: false }, axisBorder: { show: false } },
      yaxis: { show: false },
      grid: { show: false, padding: { left: 0, right: 0, top: 4, bottom: 0 } },
      legend: { show: false },
      dataLabels: { enabled: false },
      tooltip: { enabled: false }
    });
  }
};
