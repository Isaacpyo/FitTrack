import { Platform } from 'react-native';

/** Design tokens. Text colours meet WCAG AA (≥ 4.5:1) on `bg` and `surface`. */
export const colors = {
  bg: '#09090B',
  surface: '#17171A',
  surfaceRaised: '#202024',
  border: '#2F2F35',
  borderStrong: '#4A4A52',
  text: '#FAFAFA',
  textMuted: '#A1A1AA',
  accent: '#F97316',
  accentSoft: '#3A1D0B',
  accentText: '#1C0A00',
  focus: '#FDBA74',
  success: '#4ADE80',
  successSoft: '#0E2A18',
  warning: '#FBBF24',
  warningSoft: '#2E2408',
  danger: '#F87171',
  dangerSoft: '#2E1212',
  info: '#60A5FA',
  infoSoft: '#0E1F36',
  // Charts — series colour validated (dataviz validator, dark mode) against `surface`:
  // OKLCH L 0.48–0.67, chroma ≥ 0.1, ≥ 3:1 contrast. Brighter `accent` marks the selected mark.
  chartSeries: '#EA580C',
  chartGrid: '#2A2A30',
  chartAxis: '#3A3A42',
} as const;

/** SVG text doesn't inherit the app font on the web; without this it falls back to a serif. */
export const chartFont = Platform.select({
  web: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  default: undefined,
});

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export const font = {
  title: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5 },
  heading: { fontSize: 20, fontWeight: '700' as const },
  subheading: { fontSize: 16, fontWeight: '700' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  small: { fontSize: 14, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.4 },
};

/** Content width caps so the web build stays readable on wide screens. */
export const maxWidth = { form: 560, page: 1040 } as const;
