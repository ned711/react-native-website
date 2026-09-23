import type {ReactNode} from 'react';
import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native';
import {RADIUS, SPACING, useActiveTheme} from './theme.ts';

export function Card({
  children,
  style,
}: {
  readonly children: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
}) {
  const theme = useActiveTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.palette.surface,
          borderColor: theme.palette.surfaceAlt,
        },
        style,
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {borderRadius: RADIUS, borderWidth: 1, padding: SPACING, gap: 8},
});
