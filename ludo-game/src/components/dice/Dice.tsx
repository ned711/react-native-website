import {useEffect, useRef, useState} from 'react';
import {Animated, Pressable, StyleSheet, View} from 'react-native';
import {buildDiceRollSequence, PIP_LAYOUT} from '../../animations/dice.ts';
import type {DiceDefinition} from '../../content/dice.ts';
import type {DieValue} from '../../game/types.ts';
import {createSeededRandom} from '../../utils/random.ts';
import {AppText} from '../ui/AppText.tsx';

export interface DiceProps {
  readonly definition: DiceDefinition;
  /** Real result decided by the engine/server before the animation starts. */
  readonly value: DieValue | null;
  /** Changes each time a new roll must be animated. */
  readonly rollId: number;
  readonly size: number;
  readonly canRoll: boolean;
  readonly reduceMotion: boolean;
  readonly onPress: () => void;
  readonly onRollEnd: () => void;
}

export function DiceFace({
  value,
  size,
  definition,
}: {
  readonly value: DieValue;
  readonly size: number;
  readonly definition: DiceDefinition;
}) {
  const pip = size * 0.16;
  return (
    <View
      style={[
        styles.face,
        {
          width: size,
          height: size,
          borderRadius: size * 0.18,
          backgroundColor: definition.faceColor,
          borderColor: definition.edgeColor,
        },
      ]}>
      {PIP_LAYOUT[value].map(([row, col]) => (
        <View
          key={`${row}-${col}`}
          style={[
            styles.pip,
            {
              width: pip,
              height: pip,
              borderRadius: pip / 2,
              backgroundColor: definition.pipColor,
              top: size * (0.2 + row * 0.3) - pip / 2,
              left: size * (0.2 + col * 0.3) - pip / 2,
            },
          ]}
        />
      ))}
    </View>
  );
}

export function Dice({
  definition,
  value,
  rollId,
  size,
  canRoll,
  reduceMotion,
  onPress,
  onRollEnd,
}: DiceProps) {
  const [face, setFace] = useState<DieValue>(value ?? 1);
  const rotation = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(0)).current;
  const onEnd = useRef(onRollEnd);
  onEnd.current = onRollEnd;

  useEffect(() => {
    if (rollId === 0 || value === null) return undefined;
    const frames = buildDiceRollSequence(
      value,
      createSeededRandom(`visual:${rollId}`),
      {
        spinFrames: 8,
        reducedMotion: reduceMotion,
      }
    );
    const timers: ReturnType<typeof setTimeout>[] = [];
    let elapsed = 0;
    for (const frame of frames) {
      elapsed += frame.delayMs;
      timers.push(
        setTimeout(() => {
          setFace(frame.face);
          rotation.setValue(frame.rotation % 360);
          lift.setValue(frame.lift);
        }, elapsed)
      );
    }
    timers.push(setTimeout(() => onEnd.current(), elapsed + 60));
    return () => timers.forEach(clearTimeout);
  }, [rollId, value, reduceMotion, rotation, lift]);

  const rotate = rotation.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });
  const translateY = lift.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -size * 0.25],
  });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={canRoll ? 'Lancer le dé' : `Dé : ${face}`}
      accessibilityState={{disabled: !canRoll}}
      disabled={!canRoll}
      onPress={onPress}
      style={styles.wrap}>
      <Animated.View style={{transform: [{translateY}, {rotate}]}}>
        <DiceFace value={face} size={size} definition={definition} />
      </Animated.View>
      {canRoll ? (
        <AppText variant="caption" style={styles.hint}>
          Touchez pour lancer
        </AppText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 72,
    minHeight: 72,
  },
  face: {borderWidth: 2, elevation: 6},
  pip: {position: 'absolute'},
  hint: {textAlign: 'center'},
});
