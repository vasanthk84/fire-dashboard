/* charts.jsx — theme-aware ApexCharts wrapper + pro chart builders.
   Exports to window: ApexChart, CHARTS (option builders). */

const { useEffect, useRef } = React;

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
function isDark() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}
const MONO = "'JetBrains Mono', ui-monospace, monospace";
const SANS = "'Plus Jakarta Sans', sans-serif";

/* Reliable theme-reactive wrapper: rebuilds when `dep` changes. */
function ApexChart({ build, dep, height }) {
  const ref = useRef(null);
  const chart = useRef(null);
  useEffect(() => {
    if (!ref.current || !window.ApexCharts) return;
    const cfg = build();
    cfg.chart = Object.assign({
      fontFamily: SANS, foreColor: cssVar('--text-2'),
      toolbar: { show: false }, animations: { enabled: true, speed: 320 },
      height: height || 340, background: 'transparent'
    }, cfg.chart || {});
    chart.current = new ApexCharts(ref.current, cfg);
    chart.current.render();
    return () => { if (chart.current) { chart.current.destroy(); chart.current = null; } };
  }, [dep]);
  return <div ref={ref} className="chart-wrap" />;
}

function baseAxes(categories, yFmt) {
  const grid = cssVar('--grid');
  const lab = cssVar('--text-3');
  return {
    grid: { borderColor: grid, strokeDashArray: 4, padding: { left: 6, right: 12 } },
    xaxis: {
      categories,
      axisBorder: { show: false }, axisTicks: { show: false },
      labels: { style: { colors: lab, fontSize: '11px', fontFamily: MONO }, rotate: 0, hideOverlappingLabels: true }
    },
    yaxis: { labels: { style: { colors: lab, fontSize: '11px', fontFamily: MONO }, formatter: yFmt } },
    tooltip: { theme: isDark() ? 'dark' : 'light', style: { fontFamily: SANS } },
    legend: { show: false },
    dataLabels: { enabled: false }
  };
}

// crore/lakh y-formatter
function yL(v) {
  v = Number(v);
  if (Math.abs(v) >= 100) return (v / 100).toFixed(1) + 'Cr';
  return Math.round(v) + 'L';
}

function clip(proj, maxYear) { return proj.filter((p) => p.year <= maxYear); }

const CHARTS = {
  // Headline: total corpus growth (area)
  corpus(proj, retYear) {
    const data = clip(proj, retYear + 8);
    const accent = cssVar('--accent');
    return () => Object.assign({
      series: [{ name: 'Corpus', data: data.map((p) => +p.total.toFixed(1)) }],
      chart: { type: 'area' },
      colors: [accent],
      stroke: { width: 2.5, curve: 'smooth' },
      fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.32, opacityTo: 0.02, stops: [0, 95] } },
      markers: { size: 0, hover: { size: 5 } },
      tooltip: { theme: isDark() ? 'dark' : 'light', y: { formatter: (v) => window.FIRE.fmtL(v) } },
      annotations: { xaxis: [{ x: data.findIndex((p) => p.year === retYear), borderColor: cssVar('--text-3'),
        label: { text: 'Retire ' + retYear, style: { fontSize: '10px', fontFamily: SANS, color: cssVar('--text'), background: cssVar('--surface-3') } } }] }
    }, baseAxes(data.map((p) => p.year), yL));
  },

  // Net-worth composition over time (stacked area — the right graph)
  composition(proj, retYear, assetSeries) {
    const data = clip(proj, retYear + 8);
    return () => Object.assign({
      series: assetSeries.map((a) => ({ name: a.label, data: data.map((p) => +p[a.key].toFixed(1)) })),
      chart: { type: 'area', stacked: true },
      colors: assetSeries.map((a) => a.color),
      stroke: { width: 1, curve: 'smooth' },
      fill: { type: 'gradient', gradient: { opacityFrom: 0.7, opacityTo: 0.45 } },
      tooltip: { theme: isDark() ? 'dark' : 'light', shared: true, y: { formatter: (v) => window.FIRE.fmtL(v) } }
    }, baseAxes(data.map((p) => p.year), yL));
  },

  // Equity allocation vs target glidepath (line)
  equity(data) {
    const accent = cssVar('--accent');
    const series = [{ name: 'Equity %', data: data.drift }];
    if (data.rebalanced.length) series.push({ name: 'Rebalanced', data: data.rebalanced });
    series.push({ name: 'Target', data: data.target });
    const colors = [accent, '#2dd4a7', cssVar('--text-3')];
    return () => Object.assign({
      series,
      chart: { type: 'line' },
      colors,
      stroke: { width: data.rebalanced.length ? [2.5, 2.5, 1.5] : [2.5, 1.5], curve: 'smooth', dashArray: data.rebalanced.length ? [0, 0, 6] : [0, 6] },
      markers: { size: 0 },
      tooltip: { theme: isDark() ? 'dark' : 'light', y: { formatter: (v) => v + '%' } },
      annotations: { yaxis: [{ y: 80, borderColor: cssVar('--neg'), strokeDashArray: 4,
        label: { text: 'High risk', style: { fontSize: '10px', color: '#fff', background: cssVar('--neg') } } }] }
    }, baseAxes(data.years, (v) => v + '%'));
  },

  // Passive income vs expenses
  incomeVsExpense(proj, retYear, returnYear, applyTax) {
    const data = clip(proj, retYear + 8);
    return () => Object.assign({
      series: [
        { name: 'Passive / mo', type: 'area', data: data.map((p) => +p.passiveIncomeMonthly.toFixed(2)) },
        { name: 'Expense / mo', type: 'line', data: data.map((p) => p.year < returnYear ? null : p.calculatedMonthlyExpense) }
      ],
      chart: { type: 'line' },
      colors: [cssVar('--accent'), cssVar('--warn')],
      stroke: { width: [2.5, 2], curve: 'smooth' },
      fill: { type: ['gradient', 'solid'], gradient: { opacityFrom: 0.3, opacityTo: 0.02 } },
      markers: { size: 0 },
      tooltip: { theme: isDark() ? 'dark' : 'light', y: { formatter: (v) => v == null ? '—' : v.toFixed(2) + 'L/mo' } },
      annotations: { xaxis: [
        { x: data.findIndex((p) => p.year === returnYear), borderColor: cssVar('--text-3'), label: { text: 'Return', style: { fontSize: '9px', color: cssVar('--text'), background: cssVar('--surface-3') } } },
        { x: data.findIndex((p) => p.year === retYear), borderColor: cssVar('--accent'), label: { text: 'Retire', style: { fontSize: '9px', color: '#fff', background: cssVar('--accent') } } }
      ] }
    }, baseAxes(data.map((p) => p.year), (v) => v.toFixed(1) + 'L'));
  },

  // Expense breakdown (donut)
  expenseDonut(expenseMeta, expenses) {
    const items = expenseMeta.filter((e) => expenses[e.key] > 0);
    return () => ({
      series: items.map((e) => expenses[e.key]),
      chart: { type: 'donut', height: 240 },
      labels: items.map((e) => e.label),
      colors: items.map((e) => e.color),
      stroke: { width: 0 },
      legend: { show: false },
      dataLabels: { enabled: false },
      plotOptions: { pie: { donut: { size: '70%', labels: { show: true,
        total: { show: true, label: 'Monthly', fontSize: '11px', fontFamily: SANS, color: cssVar('--text-3'),
          formatter: () => window.FIRE.fmtINR(items.reduce((s, e) => s + expenses[e.key], 0)) },
        value: { fontFamily: MONO, color: cssVar('--text'), fontSize: '16px', formatter: (v) => window.FIRE.fmtINR(v) } } } } },
      tooltip: { theme: isDark() ? 'dark' : 'light', y: { formatter: (v) => window.FIRE.fmtINR(v) } }
    });
  },

  // Withdrawal sustainability (corpus depletion area)
  depletion(scenario, rateLabel) {
    const accent = cssVar('--accent');
    return () => Object.assign({
      series: [{ name: 'Corpus', data: scenario.map((r) => +r.corpusStart.toFixed(0)) }],
      chart: { type: 'area' },
      colors: [accent],
      stroke: { width: 2.5, curve: 'smooth' },
      fill: { type: 'gradient', gradient: { opacityFrom: 0.3, opacityTo: 0.02 } },
      markers: { size: 0, hover: { size: 5 } },
      tooltip: { theme: isDark() ? 'dark' : 'light', y: { formatter: (v) => window.FIRE.fmtL(v) } }
    }, baseAxes(scenario.map((r) => r.year), yL));
  },

  // Snapshot progression (wealth vs target)
  progression(selected) {
    return () => Object.assign({
      series: [
        { name: 'Wealth', data: selected.map((s) => +s.results.currentWealth.toFixed(1)) },
        { name: 'FIRE target', data: selected.map((s) => +s.results.fireNumber.toFixed(1)) }
      ],
      chart: { type: 'line' },
      colors: [cssVar('--accent'), cssVar('--warn')],
      stroke: { width: [3, 1.5], curve: 'smooth', dashArray: [0, 6] },
      markers: { size: 4 },
      tooltip: { theme: isDark() ? 'dark' : 'light', y: { formatter: (v) => window.FIRE.fmtL(v) } }
    }, baseAxes(selected.map((s) => new Date(s.snapshotDate).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })), yL));
  }
};

Object.assign(window, { ApexChart, CHARTS });
