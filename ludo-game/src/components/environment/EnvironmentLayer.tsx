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
import type {SceneryDefinition} from '../../themes/types.ts';
import {Scenery} from './Scenery.tsx';

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

  const leafy = p.shape === 'petal' || p.shape === 'leaf';
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
  const x0 = p.direction === 'across' ? -p.size : startX;
  const endX =
    p.direction === 'across' ? width + p.size : startX + p.driftX * width;
  // Wind: drift plus a gentle side-to-side sway for petals and leaves.
  const swing = leafy ? p.size * 3 : 0;
  const translateX = progress.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [
      x0,
      x0 + (endX - x0) * 0.25 + swing,
      x0 + (endX - x0) * 0.5,
      x0 + (endX - x0) * 0.75 - swing,
      endX,
    ],
  });
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [startY, endY],
  });
  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', leafy ? '540deg' : '0deg'],
  });
  const flip = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, leafy ? 0.3 : 1, 1],
  });
  return (
    <Animated.View
      style={[
        styles.particle,
        {
          width: p.size,
          height: leafy ? p.size * 0.65 : p.size,
          borderRadius: leafy ? p.size * 0.6 : p.size / 2,
          borderTopLeftRadius: leafy ? p.size * 0.1 : p.size / 2,
          backgroundColor: p.color,
          opacity: p.opacity,
          transform: [{translateX}, {translateY}, {rotate}, {scaleX: flip}],
        },
      ]}
    />
  );
}

/** Animated environment. Purely visual: it never touches the game state. */
export const EnvironmentLayer = memo(function EnvironmentLayer({
  environment,
  quality,
  reduceMotion,
  width,
  height,
  scenery,
}: {
  readonly environment: EnvironmentDefinition;
  readonly quality: GraphicsQuality;
  readonly reduceMotion: boolean;
  readonly width: number;
  readonly height: number;
  readonly scenery?: SceneryDefinition;
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
      {scenery ? (
        <Scenery scenery={scenery} width={width} height={height} />
      ) : (
        <View
          style={[styles.sky, {backgroundColor: environment.skyGradient[0]}]}
        />
      )}
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
