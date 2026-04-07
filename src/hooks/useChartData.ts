import { useMemo } from 'react';
import type { ApexAxisChartSeries, ApexOptions } from 'apexcharts';
import type { CalculationResults, Inputs } from '../types';
import { fmtL } from '../utils/formatters';

interface UseChartDataProps {
  inputs: Inputs;
  results: CalculationResults | null;
}

export function useChartData({ inputs, results }: UseChartDataProps) {
  const equityAllocationData = useMemo(() => {
    if (!results) {
      return { drift: [] as number[], rebalanced: [] as number[], target: [] as number[], years: [] as number[] };
    }

    const years = results.fireProjections.map((projection) => projection.year);
    const drift: number[] = [];
    const rebalanced: number[] = [];
    const target: number[] = [];
    let prevEquity = 0;
    let prevFixed = 0;

    results.fireProjections.forEach((projection, index) => {
      const isPostRetirement = projection.year >= inputs.retirementYear;
      const yearsSinceRetire = projection.year - inputs.retirementYear;
      let targetPct = inputs.targetEquityPre;

      if (isPostRetirement && inputs.glideYears > 0) {
        const progress = Math.min(yearsSinceRetire / inputs.glideYears, 1);
        targetPct = inputs.targetEquityPre + progress * (inputs.targetEquityPost - inputs.targetEquityPre);
      } else if (isPostRetirement) {
        targetPct = inputs.targetEquityPost;
      }

      target.push(Math.round(targetPct));
      const equity = projection.mf + projection.stocksIndia + projection.usStocks;
      const total = projection.total || 1;
      drift.push(Math.round((equity / total) * 100));

      if (inputs.enableRebalancing) {
        if (index === 0) {
          prevEquity = equity;
          prevFixed = total - equity;
          rebalanced.push(drift[0]);
        } else {
          const grownEquity = prevEquity * (1 + inputs.mfRate);
          const grownFixed = prevFixed * 0.07;
          const grownTotal = grownEquity + grownFixed;
          const targetEquityAmt = grownTotal * (targetPct / 100);
          prevEquity = targetEquityAmt;
          prevFixed = grownTotal - targetEquityAmt;
          rebalanced.push(Math.round((prevEquity / grownTotal) * 100));
        }
      }
    });

    return { drift, rebalanced, target, years };
  }, [inputs.enableRebalancing, inputs.glideYears, inputs.mfRate, inputs.retirementYear, inputs.targetEquityPost, inputs.targetEquityPre, results]);

  const equityPctSeries = useMemo<ApexAxisChartSeries>(() => {
    const series: ApexAxisChartSeries = [{ name: 'Natural Drift', data: equityAllocationData.drift }];
    if (inputs.enableRebalancing) {
      series.push({ name: 'With Rebalancing', data: equityAllocationData.rebalanced });
    }
    series.push({ name: 'Target Equity %', data: equityAllocationData.target });
    return series;
  }, [equityAllocationData, inputs.enableRebalancing]);

  const equityPctOptions = useMemo<ApexOptions>(() => ({
    chart: { type: 'area', height: 380, toolbar: { show: true } },
    xaxis: { categories: equityAllocationData.years, labels: { style: { colors: '#94a3b8', fontSize: '11px' }, rotate: -45 } },
    yaxis: { labels: { style: { colors: '#94a3b8' } } },
    colors: ['#f59e0b', '#10b981', '#6366f1'],
    fill: { opacity: [0.6, 0.4, 0] },
    stroke: { width: [3, 3, 2], dashArray: [0, 0, 5] },
    legend: { labels: { colors: '#94a3b8' } },
    tooltip: { theme: 'dark' },
    annotations: {
      yaxis: [{ y: 80, borderColor: '#ef4444', label: { text: 'High Risk Zone', style: { color: '#fff', background: '#ef4444' } } }]
    }
  }), [equityAllocationData.years]);

  const netWorthSeries = useMemo<ApexAxisChartSeries>(() => {
    if (!results) {
      return [];
    }

    return [
      { name: 'Mutual Funds', data: results.fireProjections.map((item) => Number(item.mf.toFixed(2))) },
      { name: 'Stocks India', data: results.fireProjections.map((item) => Number(item.stocksIndia.toFixed(2))) },
      { name: 'EPF', data: results.fireProjections.map((item) => Number(item.epf.toFixed(2))) },
      { name: 'Bonds', data: results.fireProjections.map((item) => Number(item.bonds.toFixed(2))) }
    ];
  }, [results]);

  const netWorthOptions = useMemo<ApexOptions>(() => ({
    chart: {
      type: 'bar',
      stacked: true,
      height: 380,
      toolbar: { show: true, autoSelected: 'zoom' },
      zoom: { enabled: true, type: 'x', autoScaleYaxis: true }
    },
    plotOptions: { bar: { borderRadius: 4, columnWidth: '80%' } },
    xaxis: { categories: results?.fireProjections.map((item) => item.year) ?? [], labels: { style: { colors: '#94a3b8', fontSize: '11px' }, rotate: -45, rotateAlways: true } },
    yaxis: { labels: { style: { colors: '#94a3b8' }, formatter: (value) => Number(value) >= 100 ? `${(Number(value) / 100).toFixed(1)}Cr` : `${Number(value).toFixed(0)}L` } },
    colors: ['#6366f1', '#f59e0b', '#8b5cf6', '#10b981'],
    fill: { opacity: 0.95 },
    stroke: { width: 0 },
    dataLabels: { enabled: false },
    legend: { position: 'bottom', horizontalAlign: 'center', labels: { colors: '#94a3b8' } },
    tooltip: {
      theme: 'dark',
      shared: true,
      intersect: false,
      y: {
        formatter: (value, context) => {
          const dataPointIndex = context?.dataPointIndex ?? 0;
          const total = results?.fireProjections[dataPointIndex]?.total ?? 0;
          const pct = total > 0 ? ((Number(value) / total) * 100).toFixed(1) : '0';
          return `${fmtL(Number(value))} (${pct}%)`;
        }
      }
    },
    grid: { borderColor: '#334155', strokeDashArray: 4 }
  }), [results]);

  const incomeExpenseSeries = useMemo<ApexAxisChartSeries>(() => {
    if (!results) {
      return [];
    }

    return [
      { name: `Passive Income ${inputs.applyTax ? '(Post-Tax)' : ''}`, type: 'area', data: results.fireProjections.map((item) => Number(item.passiveIncomeMonthly.toFixed(2))) },
      { name: 'Inflated Expenses', type: 'line', data: results.fireProjections.map((item) => item.year < inputs.returnYear ? null : item.calculatedMonthlyExpense) }
    ];
  }, [inputs.applyTax, inputs.returnYear, results]);

  const incomeExpenseOptions = useMemo<ApexOptions>(() => ({
    chart: { height: 380, toolbar: { show: true } },
    xaxis: { categories: results?.fireProjections.map((item) => item.year) ?? [], labels: { style: { colors: '#94a3b8', fontSize: '11px' }, rotate: -45 } },
    yaxis: { labels: { style: { colors: '#94a3b8' } } },
    colors: ['#00e396', '#ff9f43'],
    fill: { type: ['gradient', 'solid'], gradient: { shadeIntensity: 1, opacityFrom: 0.7, opacityTo: 0.1, stops: [0, 90, 100] } },
    stroke: { width: [3, 3], curve: 'smooth' },
    legend: { labels: { colors: '#94a3b8' } },
    tooltip: { theme: 'dark' },
    annotations: {
      xaxis: [
        { x: inputs.returnYear, borderColor: '#00cfe8', label: { borderColor: '#00cfe8', style: { color: '#000', background: '#00cfe8' }, text: 'India Return' } },
        { x: inputs.retirementYear, borderColor: '#fbbf24', label: { borderColor: '#fbbf24', style: { color: '#000', background: '#fbbf24' }, text: 'Retire' } }
      ]
    }
  }), [inputs.retirementYear, inputs.returnYear, results]);

  return {
    equityPctSeries,
    equityPctOptions,
    netWorthSeries,
    netWorthOptions,
    incomeExpenseSeries,
    incomeExpenseOptions
  };
}