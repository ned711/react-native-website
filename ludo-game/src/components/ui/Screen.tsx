import type {ReactNode} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {AppText} from './AppText.tsx';
import {SPACING, useActiveTheme} from './theme.ts';

export interface ScreenProps {
  readonly title?: string;
  readonly subtitle?: string;
  readonly children: ReactNode;
  readonly scroll?: boolean;
}

export function Screen({
  title,
  subtitle,
  children,
  scroll = true,
}: ScreenProps) {
  const theme = useActiveTheme();
  const header = title ? (
    <View style={styles.header}>
      <AppText variant="title" accessibilityRole="header">
        {title}
      </AppText>
      {subtitle ? <AppText muted>{subtitle}</AppText> : null}
    </View>
  ) : null;
  return (
    <SafeAreaView
      style={[styles.root, {backgroundColor: theme.palette.background}]}
      edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.content}>
          {header}
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.fill]}>
          {header}
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  fill: {flex: 1},
  content: {padding: SPACING, gap: SPACING, paddingBottom: 32},
  header: {gap: 4, marginBottom: 4},
});
