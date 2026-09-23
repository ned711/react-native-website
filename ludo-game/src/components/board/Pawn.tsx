import {useEffect, useRef} from 'react';
import {LinearGradient} from 'expo-linear-gradient';
import {Animated, Easing, Pressable, StyleSheet, View} from 'react-native';
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
  /** Visual size multiplier (bigger pawns at home). Does not affect positions. */
  readonly sizeScale?: number;
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
  sizeScale = 1,
  x,
  y,
  animation,
  movable,
  shielded,
  reduceMotion,
  accessibilityLabel,
  onPress,
}: PawnProps) {
  const size = cell * 0.86 * sizeScale;
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
        style={styles.pawn}>
        <PawnFigure
          size={size}
          color={color}
          glyph={glyph}
          highlighted={movable}
          shielded={shielded}
        />
      </Pressable>
    </Animated.View>
  );
}

/**
 * Pawn drawn in relief with plain views (base, body, head, highlights). The
 * figure is taller than its cell box: the head overflows upwards like a real
 * piece seen from above at an angle.
 */
export function PawnFigure({
  size,
  color,
  glyph,
  highlighted,
  shielded,
}: {
  readonly size: number;
  readonly color: ColorSet;
  readonly glyph: string;
  readonly highlighted: boolean;
  readonly shielded: boolean;
}) {
  const head = size * 0.46;
  const bodyW = size * 0.5;
  const bodyH = size * 0.55;
  const baseW = size * 0.84;
  const baseH = size * 0.34;
  return (
    <View
      style={[styles.figure, {width: size, height: size}]}
      pointerEvents="none">
      <View
        style={[
          styles.part,
          {
            width: size * 0.95,
            height: size * 0.34,
            bottom: -size * 0.06,
            left: size * 0.025,
            borderRadius: size,
            backgroundColor: 'rgba(0,0,0,0.35)',
          },
        ]}
      />
      {highlighted || shielded ? (
        <View
          style={[
            styles.part,
            {
              width: baseW + size * 0.2,
              height: baseH + size * 0.14,
              bottom: -size * 0.04,
              left: (size - baseW) / 2 - size * 0.1,
              borderRadius: size,
              borderWidth: Math.max(2, size * 0.07),
              borderColor: shielded ? '#80D8FF' : '#FFE082',
            },
          ]}
        />
      ) : null}
      <LinearGradient
        colors={[color.light, color.main, color.dark]}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={[
          styles.part,
          {
            width: baseW,
            height: baseH,
            bottom: 0,
            left: (size - baseW) / 2,
            borderRadius: size,
          },
        ]}
      />
      <LinearGradient
        colors={[color.light, color.main, color.dark]}
        locations={[0, 0.4, 1]}
        start={{x: 0, y: 0.5}}
        end={{x: 1, y: 0.5}}
        style={[
          styles.part,
          {
            width: bodyW,
            height: bodyH,
            bottom: baseH * 0.45,
            left: (size - bodyW) / 2,
            borderTopLeftRadius: bodyW * 0.45,
            borderTopRightRadius: bodyW * 0.45,
            borderBottomLeftRadius: bodyW * 0.2,
            borderBottomRightRadius: bodyW * 0.2,
          },
        ]}
      />
      <LinearGradient
        colors={[color.light, color.main, color.dark]}
        locations={[0, 0.45, 1]}
        start={{x: 0.2, y: 0.1}}
        end={{x: 0.9, y: 0.9}}
        style={[
          styles.part,
          styles.center,
          {
            width: head,
            height: head,
            bottom: baseH * 0.45 + bodyH - head * 0.35,
            left: (size - head) / 2,
            borderRadius: head / 2,
          },
        ]}>
        {glyph ? (
          <AppText
            style={{
              fontSize: head * 0.55,
              lineHeight: head * 0.8,
              color: '#FFFFFF',
            }}>
            {glyph}
          </AppText>
        ) : null}
      </LinearGradient>
      <View
        style={[
          styles.part,
          {
            width: head * 0.28,
            height: head * 0.22,
            bottom: baseH * 0.45 + bodyH + head * 0.28,
            left: size / 2 - head * 0.26,
            borderRadius: head,
            backgroundColor: 'rgba(255,255,255,0.75)',
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  abs: {position: 'absolute', left: 0, top: 0},
  pawn: {flex: 1},
  figure: {position: 'relative'},
  part: {position: 'absolute'},
  center: {alignItems: 'center', justifyContent: 'center'},
});
