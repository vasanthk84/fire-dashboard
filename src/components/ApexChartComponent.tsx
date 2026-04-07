import { useEffect, useRef } from 'react';
import ApexCharts from 'apexcharts';
import type { ApexAxisChartSeries, ApexNonAxisChartSeries, ApexOptions } from 'apexcharts';

interface ApexChartComponentProps {
  type: NonNullable<ApexOptions['chart']>['type'];
  series: ApexAxisChartSeries | ApexNonAxisChartSeries;
  options: ApexOptions;
}

export function ApexChartComponent({ type, series, options }: ApexChartComponentProps) {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartInstance = useRef<ApexCharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) {
      return undefined;
    }

    chartInstance.current?.destroy();
    chartInstance.current = new ApexCharts(chartRef.current, {
      ...options,
      chart: {
        ...options.chart,
        type
      },
      series
    });
    chartInstance.current.render();

    return () => {
      chartInstance.current?.destroy();
      chartInstance.current = null;
    };
  }, [options, series, type]);

  return <div ref={chartRef} style={{ width: '100%', height: '100%' }} />;
}
