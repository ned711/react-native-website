import {
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {AppText} from './AppText.tsx';
import {GOLD, RADIUS, useActiveTheme} from './theme.ts';

export interface ButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: 'primary' | 'secondary' | 'ghost';
  readonly disabled?: boolean;
  readonly accessibilityHint?: string;
  readonly style?: StyleProp<ViewStyle>;
  readonly big?: boolean;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  accessibilityHint,
  style,
  big,
}: ButtonProps) {
  const theme = useActiveTheme();
  const background =
    variant === 'primary'
      ? theme.palette.accent
      : variant === 'secondary'
        ? theme.palette.surfaceAlt
        : 'transparent';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{disabled: !!disabled}}
      disabled={disabled}
      onPress={onPress}
      style={({pressed}) => [
        styles.base,
        big && styles.big,
        {
          backgroundColor: background,
          borderColor: variant === 'ghost' ? theme.palette.textMuted : GOLD,
        },
        (pressed || disabled) && {opacity: disabled ? 0.45 : 0.8},
        style,
      ]}>
      <AppText
        variant={big ? 'heading' : 'label'}
        color={variant === 'primary' ? '#FFFFFF' : theme.palette.text}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  big: {minHeight: 64, paddingVertical: 16},
});
