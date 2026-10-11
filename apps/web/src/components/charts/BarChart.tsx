import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';
import { chartFont, colors } from '../../theme';
import { ChartShell, type ChartDatum } from './ChartShell';
import { columnPath, compactNumber, labelIndices, niceTicks } from './scale';

const PAD = { top: 14, right: 8, bottom: 24, left: 40 };
const MAX_BAR = 24;
const GAP = 2;

interface BarChartProps {
  data: ChartDatum[];
  summary: string;
  valueHeader: string;
  /** Optional reference line, e.g. a daily step goal. */
  reference?: { value: number; label: string };
  height?: number;
  testID?: string;
}

/** Single-series columns: ≤24px wide, 4px rounded data-end, square baseline, 2px gaps. */
export function BarChart({ data, summary, valueHeader, reference, height = 200, testID }: BarChartProps) {
  const max = Math.max(...data.map((d) => d.value), reference?.value ?? 0, 1);
  const ticks = niceTicks(0, max, 3);
  const hi = ticks[ticks.length - 1]!;

  const geometry = (width: number) => {
    const plotW = Math.max(1, width - PAD.left - PAD.right);
    const plotH = height - PAD.top - PAD.bottom;
    const slot = plotW / Math.max(1, data.length);
    const barW = Math.max(2, Math.min(MAX_BAR, slot - GAP));
    const cx = (i: number) => PAD.left + slot * i + slot / 2;
    const y = (v: number) => PAD.top + plotH - (v / hi) * plotH;
    return { plotW, plotH, slot, barW, cx, y };
  };

  return (
    <ChartShell
      data={data}
      summary={summary}
      height={height}
      valueHeader={valueHeader}
      testID={testID}
      slots={(width) => {
        const { slot, cx } = geometry(width);
        return data.map((_, i) => ({ x: cx(i), w: Math.max(slot, 12) }));
      }}
    >
      {(width, selected) => {
        const { plotW, plotH, barW, cx, y } = geometry(width);
        const baseline = PAD.top + plotH;
        return (
          <Svg width={width} height={height}>
            {ticks.map((t) => (
              <Line key={t} x1={PAD.left} x2={PAD.left + plotW} y1={y(t)} y2={y(t)} stroke={t === 0 ? colors.chartAxis : colors.chartGrid} strokeWidth={1} />
            ))}
            {ticks.map((t) => (
              <SvgText key={`l${t}`} x={PAD.left - 8} y={y(t) + 4} fontSize={11} fontFamily={chartFont} fill={colors.textMuted} textAnchor="end">
                {compactNumber(t)}
              </SvgText>
            ))}
            {data.map((d, i) => (
              <Path
                key={d.key}
                d={columnPath(cx(i) - barW / 2, y(d.value), barW, baseline)}
                fill={selected === i ? colors.accent : colors.chartSeries}
              />
            ))}
            {reference ? (
              <>
                <Line x1={PAD.left} x2={PAD.left + plotW} y1={y(reference.value)} y2={y(reference.value)} stroke={colors.text} strokeOpacity={0.6} strokeWidth={1} />
                <SvgText x={PAD.left + plotW} y={y(reference.value) - 5} fontSize={11} fontFamily={chartFont} fill={colors.text} textAnchor="end">
                  {reference.label}
                </SvgText>
              </>
            ) : null}
            {labelIndices(data.length, plotW, 44).map((i) => (
              <SvgText key={`x${i}`} x={cx(i)} y={height - 6} fontSize={11} fontFamily={chartFont} fill={colors.textMuted} textAnchor="middle">
                {data[i]!.label}
              </SvgText>
            ))}
          </Svg>
        );
      }}
    </ChartShell>
  );
}
