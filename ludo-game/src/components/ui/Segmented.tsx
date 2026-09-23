import {Pressable, StyleSheet, View} from 'react-native';
import {AppText} from './AppText.tsx';
import {GOLD, useActiveTheme} from './theme.ts';

export interface SegmentOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly disabled?: boolean;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  readonly options: readonly SegmentOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly accessibilityLabel: string;
}) {
  const theme = useActiveTheme();
  return (
    <View
      style={styles.row}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}>
      {options.map(option => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{selected, disabled: !!option.disabled}}
            disabled={option.disabled}
            onPress={() => onChange(option.value)}
            style={[
              styles.item,
              {
                backgroundColor: selected
                  ? theme.palette.accent
                  : theme.palette.surfaceAlt,
                borderColor: selected ? GOLD : 'transparent',
                opacity: option.disabled ? 0.4 : 1,
              },
            ]}>
            <AppText
              variant="label"
              color={selected ? '#FFFFFF' : theme.palette.text}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  item: {
    minHeight: 40,
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
  },
});
