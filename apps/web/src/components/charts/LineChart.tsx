import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { chartFont, colors } from '../../theme';
import { ChartShell, type ChartDatum } from './ChartShell';
import { compactNumber, labelIndices, niceTicks } from './scale';

const PAD = { top: 14, right: 16, bottom: 24, left: 40 };

interface LineChartProps {
  data: ChartDatum[];
  summary: string;
  valueHeader: string;
  height?: number;
  testID?: string;
}

/** Single-series line: 2px stroke, 10% wash, ringed end-dot, crosshair on the selected x. */
export function LineChart({ data, summary, valueHeader, height = 200, testID }: LineChartProps) {
  const values = data.map((d) => d.value);
  const ticks = niceTicks(Math.min(...values), Math.max(...values), 3);
  const lo = ticks[0]!;
  const hi = ticks[ticks.length - 1]!;

  const geometry = (width: number) => {
    const plotW = Math.max(1, width - PAD.left - PAD.right);
    const plotH = height - PAD.top - PAD.bottom;
    const x = (i: number) => PAD.left + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
    const y = (v: number) => PAD.top + plotH - ((v - lo) / (hi - lo || 1)) * plotH;
    return { plotW, plotH, x, y };
  };

  return (
    <ChartShell
      data={data}
      summary={summary}
      height={height}
      valueHeader={valueHeader}
      testID={testID}
      slots={(width) => {
        const { plotW, x } = geometry(width);
        const w = data.length > 1 ? plotW / (data.length - 1) : plotW;
        return data.map((_, i) => ({ x: x(i), w: Math.max(w, 12) }));
      }}
    >
      {(width, selected) => {
        const { plotW, plotH, x, y } = geometry(width);
        const points = data.map((d, i) => `${x(i)},${y(d.value)}`);
        const line = `M${points.join(' L')}`;
        const baseline = PAD.top + plotH;
        const area = `${line} L${x(data.length - 1)},${baseline} L${x(0)},${baseline} Z`;
        const last = data.length - 1;
        const focus = selected ?? last;
        return (
          <Svg width={width} height={height}>
            {ticks.map((t) => (
              <Line key={t} x1={PAD.left} x2={PAD.left + plotW} y1={y(t)} y2={y(t)} stroke={colors.chartGrid} strokeWidth={1} />
            ))}
            {ticks.map((t) => (
              <SvgText key={`l${t}`} x={PAD.left - 8} y={y(t) + 4} fontSize={11} fontFamily={chartFont} fill={colors.textMuted} textAnchor="end">
                {compactNumber(t)}
              </SvgText>
            ))}
            {labelIndices(data.length, plotW, 52).map((i) => (
              <SvgText key={`x${i}`} x={x(i)} y={height - 6} fontSize={11} fontFamily={chartFont} fill={colors.textMuted} textAnchor={i === last && data.length > 1 ? 'end' : 'middle'}>
                {data[i]!.label}
              </SvgText>
            ))}
            {data.length > 1 ? <Path d={area} fill={colors.chartSeries} fillOpacity={0.1} /> : null}
            <Path d={line} stroke={colors.chartSeries} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            {selected !== null ? (
              <Line x1={x(selected)} x2={x(selected)} y1={PAD.top} y2={baseline} stroke={colors.borderStrong} strokeWidth={1} />
            ) : null}
            <Circle
              cx={x(focus)}
              cy={y(data[focus]!.value)}
              r={5}
              fill={selected !== null ? colors.accent : colors.chartSeries}
              stroke={colors.surface}
              strokeWidth={2}
            />
          </Svg>
        );
      }}
    </ChartShell>
  );
}
