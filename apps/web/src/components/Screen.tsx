import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, maxWidth } from '../theme';
import { GlobalBanners } from './GlobalBanners';
import { styles } from './ui';

interface ScreenProps {
  children: ReactNode;
  /** Narrow column for forms, wide for dashboards. */
  width?: keyof typeof maxWidth;
  scroll?: boolean;
  /** Sticky action bar (e.g. Save / Discard). */
  footer?: ReactNode;
  testID?: string;
}

/** Safe-area aware page with global status banners and a centred, width-capped column. */
export function Screen({ children, width = 'page', scroll = true, footer, testID }: ScreenProps) {
  const column = [styles.column, { maxWidth: maxWidth[width] }];
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={{ flex: 1, backgroundColor: colors.bg }}
      testID={testID}
    >
      <GlobalBanners />
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={column}>{children}</View>
        </ScrollView>
      ) : (
        <View style={[styles.scrollContent, { flex: 1 }]}>
          <View style={[column, { flex: 1 }]}>{children}</View>
        </View>
      )}
      {footer ? (
        <View style={styles.footer}>
          <View style={[column, styles.footerInner]}>{footer}</View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
