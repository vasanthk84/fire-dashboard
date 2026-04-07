import { useEffect, useRef } from 'react';
import type { ApexAxisChartSeries, ApexNonAxisChartSeries, ApexOptions } from 'apexcharts';
import type ApexChartsType from 'apexcharts';

interface ApexChartComponentProps {
  type: NonNullable<ApexOptions['chart']>['type'];
  series: ApexAxisChartSeries | ApexNonAxisChartSeries;
  options: ApexOptions;
}

export function ApexChartComponent({ type, series, options }: ApexChartComponentProps) {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartInstance = useRef<ApexChartsType | null>(null);

  useEffect(() => {
    if (!chartRef.current) {
      return undefined;
    }

    let disposed = false;

    const renderChart = async () => {
      const { default: ApexCharts } = await import('apexcharts');

      if (!chartRef.current || disposed) {
        return;
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
      await chartInstance.current.render();
    };

    void renderChart();

    return () => {
      disposed = true;
      chartInstance.current?.destroy();
      chartInstance.current = null;
    };
  }, [options, series, type]);

  return <div ref={chartRef} style={{ width: '100%', height: '100%' }} />;
}
