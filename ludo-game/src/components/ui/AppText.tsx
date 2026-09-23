import {Text, type TextProps, type TextStyle} from 'react-native';
import {useSettings} from '../../state/settings.tsx';
import {useActiveTheme} from './theme.ts';

type Variant = 'title' | 'heading' | 'body' | 'caption' | 'label';

const SIZES: Readonly<Record<Variant, number>> = {
  title: 28,
  heading: 19,
  body: 15,
  caption: 12,
  label: 13,
};
const WEIGHTS: Readonly<Record<Variant, TextStyle['fontWeight']>> = {
  title: '800',
  heading: '700',
  body: '400',
  caption: '400',
  label: '700',
};

export interface AppTextProps extends TextProps {
  readonly variant?: Variant;
  readonly muted?: boolean;
  readonly color?: string;
}

/** Text honouring the "large text" accessibility setting and theme colours. */
export function AppText({
  variant = 'body',
  muted,
  color,
  style,
  ...rest
}: AppTextProps) {
  const {settings} = useSettings();
  const theme = useActiveTheme();
  const scale = settings.largeText ? 1.25 : 1;
  return (
    <Text
      {...rest}
      style={[
        {
          fontSize: SIZES[variant] * scale,
          fontWeight: WEIGHTS[variant],
          color:
            color ?? (muted ? theme.palette.textMuted : theme.palette.text),
          letterSpacing: variant === 'label' ? 0.6 : 0,
        },
        style,
      ]}
    />
  );
}
