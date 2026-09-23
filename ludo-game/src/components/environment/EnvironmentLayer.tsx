import {memo, useEffect, useMemo, useRef} from 'react';
import {Animated, Easing, StyleSheet, View} from 'react-native';
import {
  planParticles,
  type PlannedParticle,
} from '../../environment/particles.ts';
import type {
  EnvironmentDefinition,
  GraphicsQuality,
} from '../../environment/types.ts';

function Particle({
  p,
  width,
  height,
}: {
  readonly p: PlannedParticle;
  readonly width: number;
  readonly height: number;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: p.durationMs,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    const timer = setTimeout(() => loop.start(), p.delayMs);
    return () => {
      clearTimeout(timer);
      loop.stop();
    };
  }, [p.durationMs, p.delayMs, progress]);

  const startX = p.startX * width;
  const startY =
    p.direction === 'down'
      ? -p.size
      : p.direction === 'up'
        ? height + p.size
        : p.startY * height;
  const endY =
    p.direction === 'down'
      ? height + p.size
      : p.direction === 'up'
        ? -p.size
        : startY;
  const endX =
    p.direction === 'across' ? width + p.size : startX + p.driftX * width;
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [p.direction === 'across' ? -p.size : startX, endX],
  });
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [startY, endY],
  });
  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [
      '0deg',
      p.shape === 'petal' || p.shape === 'leaf' ? '540deg' : '0deg',
    ],
  });
  const borderRadius =
    p.shape === 'petal' || p.shape === 'leaf' ? p.size * 0.6 : p.size / 2;
  return (
    <Animated.View
      style={[
        styles.particle,
        {
          width: p.size,
          height:
            p.shape === 'petal' || p.shape === 'leaf' ? p.size * 0.65 : p.size,
          borderRadius,
          backgroundColor: p.color,
          opacity: p.opacity,
          transform: [{translateX}, {translateY}, {rotate}],
        },
      ]}
    />
  );
}

/** Subtle animated environment. Purely visual: it never touches the game state. */
export const EnvironmentLayer = memo(function EnvironmentLayer({
  environment,
  quality,
  reduceMotion,
  width,
  height,
}: {
  readonly environment: EnvironmentDefinition;
  readonly quality: GraphicsQuality;
  readonly reduceMotion: boolean;
  readonly width: number;
  readonly height: number;
}) {
  const particles = useMemo(
    () => planParticles(environment, quality, {reduceMotion}),
    [environment, quality, reduceMotion]
  );
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {backgroundColor: environment.skyGradient[1]},
      ]}>
      <View
        style={[styles.sky, {backgroundColor: environment.skyGradient[0]}]}
      />
      {particles.map(p => (
        <Particle key={p.key} p={p} width={width} height={height} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  sky: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '55%',
    opacity: 0.9,
  },
  particle: {position: 'absolute', left: 0, top: 0},
});
