import Ionicons from '@expo/vector-icons/Ionicons';
import { Children, isValidElement, useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextProps,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { colors, font, radius, space } from '../theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

// ---------------------------------------------------------------- layout

export function Row({ children, style, gap = space.sm }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

/** Wrapping grid whose cells are at least `min` wide — one column on phones, more on desktop. */
export function Grid({ children, min = 150 }: { children: ReactNode; min?: number }) {
  return (
    <View style={styles.grid}>
      {Children.toArray(children).map((child, i) => (
        <View key={isValidElement(child) && child.key !== null ? child.key : i} style={{ flexGrow: 1, flexBasis: min, minWidth: min }}>
          {child}
        </View>
      ))}
    </View>
  );
}

export function Card({ children, style, testID }: { children: ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  return (
    <View style={[styles.card, style]} testID={testID}>
      {children}
    </View>
  );
}

// ---------------------------------------------------------------- text

export function Title({ children }: { children: ReactNode }) {
  return (
    <Text style={styles.title} accessibilityRole="header">
      {children}
    </Text>
  );
}

export function Heading({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return (
    <Text style={[styles.heading, style]} accessibilityRole="header">
      {children}
    </Text>
  );
}

export function Body({
  children,
  style,
  muted,
  ...rest
}: { children: ReactNode; style?: StyleProp<TextStyle>; muted?: boolean } & Omit<TextProps, 'style' | 'children'>) {
  return (
    <Text style={[styles.body, muted && styles.muted, style]} {...rest}>
      {children}
    </Text>
  );
}

export function Caption({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.caption, style]}>{children}</Text>;
}

// ---------------------------------------------------------------- controls

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  /** Overrides the accessible name when the visible label is ambiguous (e.g. "Start"). */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const buttonColors: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.accent, fg: colors.accentText, border: colors.accent },
  secondary: { bg: colors.surfaceRaised, fg: colors.text, border: colors.borderStrong },
  ghost: { bg: 'transparent', fg: colors.text, border: 'transparent' },
  danger: { bg: colors.dangerSoft, fg: colors.danger, border: colors.danger },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  accessibilityLabel,
  accessibilityHint,
  compact,
  style,
  testID,
}: ButtonProps) {
  const [focused, setFocused] = useState(false);
  const c = buttonColors[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(inactive), busy: Boolean(loading) }}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor: c.bg, borderColor: c.border, opacity: inactive ? 0.55 : pressed ? 0.8 : 1 },
        focused && styles.focusRing,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={c.fg} />
      ) : icon ? (
        <Ionicons name={icon} size={compact ? 16 : 18} color={c.fg} />
      ) : null}
      <Text style={[styles.buttonLabel, compact && styles.buttonLabelCompact, { color: c.fg }]}>{label}</Text>
    </Pressable>
  );
}

/** Square icon-only button; always pass an accessible label. */
export function IconButton({
  icon,
  label,
  onPress,
  color = colors.textMuted,
  disabled,
  testID,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
  testID?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      hitSlop={6}
      testID={testID}
      style={({ pressed }) => [styles.iconButton, focused && styles.focusRing, { opacity: disabled ? 0.4 : pressed ? 0.6 : 1 }]}
    >
      <Ionicons name={icon} size={20} color={color} />
    </Pressable>
  );
}

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string | null;
  hint?: string;
  /** Hide the visible label (still announced) — for dense tables like set rows. */
  hideLabel?: boolean;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}

export function TextField({ label, error, hint, hideLabel, style, inputStyle, onFocus, onBlur, ...input }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, style]}>
      {!hideLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        placeholderTextColor={colors.textMuted}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          focused && styles.inputFocused,
          error ? styles.inputError : null,
          inputStyle,
        ]}
        {...input}
      />
      {error ? (
        <Text style={styles.fieldError} accessibilityLiveRegion="polite" accessibilityRole="alert">
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.fieldHint}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function Chip({ label, selected, onPress, testID }: { label: string; selected?: boolean; onPress: () => void; testID?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: Boolean(selected) }}
      testID={testID}
      style={[styles.chip, selected && styles.chipSelected, focused && styles.focusRing]}
    >
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

export function Badge({ label, tone = 'accent', icon }: { label: string; tone?: 'accent' | 'success' | 'warning' | 'info' | 'danger'; icon?: IconName }) {
  const map = {
    accent: [colors.accentSoft, colors.accent],
    success: [colors.successSoft, colors.success],
    warning: [colors.warningSoft, colors.warning],
    info: [colors.infoSoft, colors.info],
    danger: [colors.dangerSoft, colors.danger],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      {icon ? <Ionicons name={icon} size={12} color={fg} /> : null}
      <Text style={[styles.badgeLabel, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function ProgressBar({ value, max, label, color = colors.accent }: { value: number; max: number; label: string; color?: string }) {
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max, now: Math.round(value) }}
      style={styles.progressTrack}
    >
      <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

export function Stat({ label, value, sub, icon, testID }: { label: string; value: string; sub?: string; icon?: IconName; testID?: string }) {
  return (
    <Card style={styles.stat} testID={testID}>
      <Row gap={6}>
        {icon ? <Ionicons name={icon} size={16} color={colors.accent} /> : null}
        <Caption>{label}</Caption>
      </Row>
      <Text style={styles.statValue} accessibilityLabel={`${label}: ${value}${sub ? `, ${sub}` : ''}`}>
        {value}
      </Text>
      {sub ? <Body muted style={styles.statSub}>{sub}</Body> : null}
    </Card>
  );
}

// ---------------------------------------------------------------- states

export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body: string; action?: ReactNode }) {
  return (
    <Card style={styles.state}>
      <Ionicons name={icon} size={32} color={colors.accent} />
      <Heading style={{ textAlign: 'center' }}>{title}</Heading>
      <Body muted style={{ textAlign: 'center' }}>
        {body}
      </Body>
      {action}
    </Card>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card style={[styles.state, { borderColor: colors.danger }]}>
      <Ionicons name="alert-circle" size={28} color={colors.danger} />
      <Body style={{ textAlign: 'center' }}>{message}</Body>
      {onRetry ? <Button label="Try again" variant="secondary" icon="refresh" onPress={onRetry} /> : null}
    </Card>
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <View style={styles.loading} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator color={colors.accent} />
      <Body muted>{label}</Body>
    </View>
  );
}

type BannerTone = 'info' | 'warning' | 'success' | 'danger';

export function Banner({
  tone,
  icon,
  children,
  action,
  busy,
  testID,
}: {
  tone: BannerTone;
  icon: IconName;
  children: ReactNode;
  action?: ReactNode;
  busy?: boolean;
  testID?: string;
}) {
  const map = {
    info: [colors.infoSoft, colors.info],
    warning: [colors.warningSoft, colors.warning],
    success: [colors.successSoft, colors.success],
    danger: [colors.dangerSoft, colors.danger],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View
      style={[styles.banner, { backgroundColor: bg, borderColor: fg }]}
      accessibilityRole={tone === 'danger' ? 'alert' : 'summary'}
      accessibilityLiveRegion="polite"
      testID={testID}
    >
      {busy ? <ActivityIndicator size="small" color={fg} /> : <Ionicons name={icon} size={18} color={fg} />}
      <View style={{ flex: 1, gap: 2 }}>{children}</View>
      {action}
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.xxl, alignItems: 'center' },
  column: { width: '100%', gap: space.lg },
  footer: { borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: space.lg, paddingVertical: space.md, alignItems: 'center' },
  footerInner: { flexDirection: 'row', gap: space.sm, justifyContent: 'flex-end' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: space.sm },
  title: { ...font.title, color: colors.text },
  heading: { ...font.heading, color: colors.text },
  body: { ...font.body, color: colors.text, lineHeight: 22 },
  muted: { color: colors.textMuted },
  caption: { ...font.caption, color: colors.textMuted, textTransform: 'uppercase' },
  button: {
    minHeight: 48,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  buttonCompact: { minHeight: 40, paddingHorizontal: space.md },
  buttonLabel: { fontSize: 16, fontWeight: '700' },
  buttonLabelCompact: { fontSize: 14 },
  focusRing: { outlineColor: colors.focus, outlineWidth: 2, outlineStyle: 'solid', outlineOffset: 2 } as ViewStyle,
  iconButton: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  field: { gap: 6 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    color: colors.text,
    backgroundColor: colors.bg,
    fontSize: 16,
  },
  inputFocused: { borderColor: colors.focus, borderWidth: 2, outlineWidth: 0 },
  inputError: { borderColor: colors.danger },
  fieldError: { color: colors.danger, fontSize: 13 },
  fieldHint: { color: colors.textMuted, fontSize: 13 },
  chip: {
    minHeight: 40,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
  chipLabelSelected: { color: colors.accentText },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' },
  badgeLabel: { fontSize: 12, fontWeight: '700' },
  progressTrack: { height: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.pill },
  stat: { gap: 4, padding: space.md },
  statValue: { fontSize: 26, fontWeight: '800', color: colors.text },
  statSub: { fontSize: 13 },
  state: { alignItems: 'center', gap: space.md, paddingVertical: space.xl },
  loading: { alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, borderWidth: 1 },
});
