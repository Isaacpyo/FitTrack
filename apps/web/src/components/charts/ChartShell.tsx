import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, space } from '../../theme';

export interface ChartDatum {
  key: string;
  /** Short x-axis label, e.g. "6 Oct". */
  label: string;
  value: number;
  /** Formatted value for readouts and the table, e.g. "92.5 kg". */
  display: string;
  /** Long form of the x value, e.g. "Week of 6 Oct". */
  description: string;
}

interface ChartShellProps {
  data: ChartDatum[];
  /** One-sentence summary announced to screen readers. */
  summary: string;
  height: number;
  /** Draws the plot for the measured width and current selection. */
  children: (width: number, selected: number | null) => ReactNode;
  /** x-position of each slot's centre and its width, for the hit layer. */
  slots: (width: number) => { x: number; w: number }[];
  valueHeader: string;
  testID?: string;
}

/**
 * Shared chart frame: measures width, renders the plot, an invisible hit layer (press, hover and
 * keyboard focus select a datum), a readout row (values lead, labels follow), and a data-table
 * twin so no value is only reachable through interaction.
 */
export function ChartShell({
  data,
  summary,
  height,
  children,
  slots,
  valueHeader,
  testID,
}: ChartShellProps) {
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const active = selected ?? data.length - 1;
  const datum = data[active];

  return (
    <View testID={testID} style={{ gap: space.sm }}>
      <View style={styles.readout} accessibilityLiveRegion="polite">
        {datum ? (
          <>
            <Text style={styles.readoutValue}>{datum.display}</Text>
            <Text style={styles.readoutLabel}>
              {selected === null ? `Latest · ${datum.description}` : datum.description}
            </Text>
          </>
        ) : null}
      </View>

      <View style={{ height }} onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))}>
        <View
          style={StyleSheet.absoluteFill}
          accessible
          accessibilityRole="image"
          accessibilityLabel={summary}
        >
          {width > 0 ? children(width, selected) : null}
        </View>
        {width > 0 ? (
          <View style={StyleSheet.absoluteFill}>
            {slots(width).map((slot, i) => (
              <Pressable
                key={data[i]?.key ?? i}
                accessibilityRole="button"
                accessibilityLabel={`${data[i]?.description}: ${data[i]?.display}`}
                onPressIn={() => setSelected(i)}
                onHoverIn={() => setSelected(i)}
                onHoverOut={() => setSelected(null)}
                onFocus={() => setSelected(i)}
                onBlur={() => setSelected(null)}
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: slot.x - slot.w / 2,
                  width: slot.w,
                }}
              />
            ))}
          </View>
        ) : null}
      </View>

      <Pressable
        onPress={() => setShowTable((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: showTable }}
        style={styles.tableToggle}
      >
        <Text style={styles.tableToggleText}>
          {showTable ? 'Hide data table' : 'Show data table'}
        </Text>
      </Pressable>
      {showTable ? (
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHead]}>
            <Text style={[styles.tableCell, styles.tableHeadText]}>Date</Text>
            <Text style={[styles.tableCell, styles.tableHeadText, styles.num]}>{valueHeader}</Text>
          </View>
          {data.map((d) => (
            <View key={d.key} style={styles.tableRow}>
              <Text style={styles.tableCell}>{d.description}</Text>
              <Text style={[styles.tableCell, styles.num]}>{d.display}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  readout: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.sm,
    minHeight: 28,
    flexWrap: 'wrap',
  },
  readoutValue: { color: colors.text, fontSize: 20, fontWeight: '800' },
  readoutLabel: { color: colors.textMuted, fontSize: 13 },
  tableToggle: { alignSelf: 'flex-start', paddingVertical: 6 },
  tableToggleText: { color: colors.textMuted, fontSize: 13, textDecorationLine: 'underline' },
  table: { borderTopWidth: 1, borderTopColor: colors.border },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 6,
  },
  tableHead: { borderBottomColor: colors.borderStrong },
  tableHeadText: { color: colors.textMuted, fontWeight: '700' },
  tableCell: { flex: 1, color: colors.text, fontSize: 13 },
  num: { textAlign: 'right', fontVariant: ['tabular-nums'] },
});
