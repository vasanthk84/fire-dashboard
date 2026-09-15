import { useEffect, useRef } from 'react';
import type { ApexOptions } from 'apexcharts';

interface ApexChartComponentProps {
  build: () => ApexOptions;
  dep: string | number | boolean;
  height?: number;
}

const MONO = "'JetBrains Mono', ui-monospace, monospace";
const SANS = "'Plus Jakarta Sans', sans-serif";

function cssVar(name: string): string {
  if (typeof window === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function ApexChartComponent({ build, dep, height }: ApexChartComponentProps) {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartInstance = useRef<any | null>(null);

  useEffect(() => {
    if (!chartRef.current) {
      return;
    }

    let disposed = false;

    const renderChart = async () => {
      const { default: ApexCharts } = await import('apexcharts');

      if (!chartRef.current || disposed) {
        return;
      }

      const cfg = build();

      // Ensure proper defaults are set
      cfg.chart = {
        fontFamily: SANS,
        foreColor: cssVar('--text-2') || '#98a4b6',
        toolbar: { show: false },
        animations: { enabled: true, speed: 320 },
        height: height || 340,
        background: 'transparent',
        ...cfg.chart
      };

      chartInstance.current?.destroy();
      chartInstance.current = new ApexCharts(chartRef.current, cfg);
      await chartInstance.current.render();
    };

    void renderChart();

    return () => {
      disposed = true;
      chartInstance.current?.destroy();
      chartInstance.current = null;
    };
  }, [dep]);

  return <div ref={chartRef} className="chart-wrap" style={{ minHeight: height || 340 }} />;
}
