import {useEffect, useRef} from 'react';
import {Animated, Easing, Pressable, StyleSheet} from 'react-native';
import type {GridPoint} from '../../game/board/layout.ts';
import type {ColorSet} from '../../themes/types.ts';
import {AppText} from '../ui/AppText.tsx';

/** Path (in grid points) a pawn must follow for its latest move. */
export interface PawnAnimation {
  readonly id: number;
  readonly points: readonly GridPoint[];
  readonly kind: 'step' | 'return';
}

export const STEP_MS = 140;
export const RETURN_MS = 380;

export interface PawnProps {
  readonly color: ColorSet;
  readonly glyph: string;
  readonly cell: number;
  readonly x: number;
  readonly y: number;
  readonly animation: PawnAnimation | null;
  readonly movable: boolean;
  readonly shielded: boolean;
  readonly reduceMotion: boolean;
  readonly accessibilityLabel: string;
  readonly onPress: () => void;
}

export function Pawn({
  color,
  glyph,
  cell,
  x,
  y,
  animation,
  movable,
  shielded,
  reduceMotion,
  accessibilityLabel,
  onPress,
}: PawnProps) {
  const size = cell * 0.78;
  const pos = useRef(
    new Animated.ValueXY({x: x * cell - size / 2, y: y * cell - size / 2})
  ).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const lastAnimation = useRef<number | null>(null);

  useEffect(() => {
    const target = {x: x * cell - size / 2, y: y * cell - size / 2};
    if (reduceMotion || !animation || animation.id === lastAnimation.current) {
      pos.setValue(target);
      return undefined;
    }
    lastAnimation.current = animation.id;
    const steps =
      animation.kind === 'return'
        ? [
            Animated.timing(pos, {
              toValue: target,
              duration: RETURN_MS,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }),
          ]
        : animation.points.map(p =>
            Animated.timing(pos, {
              toValue: {x: p.x * cell - size / 2, y: p.y * cell - size / 2},
              duration: STEP_MS,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            })
          );
    const sequence = Animated.sequence(steps);
    sequence.start();
    return () => sequence.stop();
  }, [x, y, cell, size, animation, reduceMotion, pos]);

  useEffect(() => {
    if (!movable || reduceMotion) {
      pulse.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 450,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [movable, reduceMotion, pulse]);

  const scale = pulse.interpolate({inputRange: [0, 1], outputRange: [1, 1.15]});

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.abs,
        {
          width: size,
          height: size,
          transform: [...pos.getTranslateTransform(), {scale}],
        },
      ]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{disabled: !movable}}
        disabled={!movable}
        onPress={onPress}
        hitSlop={cell * 0.2}
        style={[
          styles.pawn,
          {
            borderRadius: size / 2,
            backgroundColor: color.main,
            borderColor: movable ? '#FFFFFF' : color.dark,
            borderWidth: movable ? 3 : 2,
          },
          shielded && styles.shield,
        ]}>
        <AppText
          style={{
            fontSize: size * 0.42,
            lineHeight: size * 0.6,
            color: '#FFFFFF',
          }}>
          {glyph}
        </AppText>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  abs: {position: 'absolute', left: 0, top: 0},
  pawn: {flex: 1, alignItems: 'center', justifyContent: 'center', elevation: 4},
  shield: {shadowColor: '#80D8FF', shadowOpacity: 0.9, shadowRadius: 6},
});
