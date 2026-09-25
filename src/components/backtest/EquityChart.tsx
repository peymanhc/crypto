import { useEffect, useRef } from 'react';
import { createChart, ColorType, DeepPartial, ChartOptions, LineStyle, UTCTimestamp } from 'lightweight-charts';
import { EquityPoint } from '../../types/backtest';

interface EquityChartProps {
  points: EquityPoint[];
  startEquity: number;
  // 'equity' draws the account balance, 'drawdown' the % below the running peak
  mode: 'equity' | 'drawdown';
}

// Dark theme for the chart surface
const CHART_OPTIONS: DeepPartial<ChartOptions> = {
  autoSize: true,
  layout: {
    background: { type: ColorType.Solid, color: 'transparent' },
    textColor: '#94a3b8',
    fontFamily: 'JetBrains Mono, ui-monospace, monospace',
    fontSize: 11,
  },
  grid: {
    vertLines: { color: 'rgba(255,255,255,0.04)' },
    horzLines: { color: 'rgba(255,255,255,0.05)' },
  },
  rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
  timeScale: { borderColor: 'rgba(255,255,255,0.08)', timeVisible: true, secondsVisible: false },
  crosshair: {
    vertLine: { color: 'rgba(148,163,184,0.5)', labelBackgroundColor: '#1a2233' },
    horzLine: { color: 'rgba(148,163,184,0.5)', labelBackgroundColor: '#1a2233' },
  },
  handleScroll: { vertTouchDrag: false },
};

const SERIES_COLORS = {
  equity: { line: '#3987e5', fill: 'rgba(57,135,229,0.35)' },
  drawdown: { line: '#e66767', fill: 'rgba(230,103,103,0.35)' },
};

// The chart needs strictly increasing timestamps in seconds; two trades closing in the
// same second are merged into one point (the later value wins)
const toChartData = (points: EquityPoint[], mode: 'equity' | 'drawdown') => {
  const data: { time: UTCTimestamp; value: number }[] = [];
  for (const point of points) {
    const time = Math.floor(point.time / 1000) as UTCTimestamp;
    const value = mode === 'equity' ? point.equity : -point.drawdownPct;
    const last = data[data.length - 1];
    if (last && time <= last.time) last.value = value;
    else data.push({ time, value });
  }
  return data;
};

// Single-series area chart with the built-in crosshair tooltip
const EquityChart: React.FC<EquityChartProps> = ({ points, startEquity, mode }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, CHART_OPTIONS);
    const colors = SERIES_COLORS[mode];

    const series = chart.addAreaSeries({
      lineColor: colors.line,
      lineWidth: 2,
      topColor: colors.fill,
      bottomColor: 'rgba(0,0,0,0)',
      priceLineVisible: false,
      crosshairMarkerRadius: 4,
      priceFormat:
        mode === 'equity'
          ? { type: 'price', precision: 2, minMove: 0.01 }
          : { type: 'custom', formatter: (v: number) => `${v.toFixed(2)}%`, minMove: 0.01 },
    });
    series.setData(toChartData(points, mode));

    if (mode === 'equity') {
      series.createPriceLine({ price: startEquity, color: 'rgba(148,163,184,0.6)', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'start' });
    }
    chart.timeScale().fitContent();

    return () => chart.remove();
  }, [points, startEquity, mode]);

  return <div ref={containerRef} className="h-full w-full" />;
};

export default EquityChart;
