import {router} from 'expo-router';
import {useState} from 'react';
import {StyleSheet, useWindowDimensions, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {LudoBoard} from '../components/board/LudoBoard.tsx';
import {Dice} from '../components/dice/Dice.tsx';
import {EnvironmentLayer} from '../components/environment/EnvironmentLayer.tsx';
import {PlayersBar} from '../components/game/PlayersBar.tsx';
import {FinalRanking, FinishedPrompt} from '../components/game/ResultModal.tsx';
import {AppText} from '../components/ui/AppText.tsx';
import {Button} from '../components/ui/Button.tsx';
import {useActiveTheme} from '../components/ui/theme.ts';
import {CLASSIC_PAWN_ID, getCharacter} from '../content/characters.ts';
import {getDice} from '../content/dice.ts';
import {getEnvironment} from '../environment/environments.ts';
import type {PlayerColor} from '../game/types.ts';
import {useLocalMatch} from '../hooks/useLocalMatch.ts';
import {getMatchSetup} from '../state/matchSetup.ts';
import {useSettings} from '../state/settings.tsx';

export default function GameScreen() {
  const [setup] = useState(getMatchSetup);
  const game = useLocalMatch(setup);
  const theme = useActiveTheme();
  const {settings} = useSettings();
  const {width, height} = useWindowDimensions();
  const [dismissedFinal, setDismissedFinal] = useState(false);
  const boardSize = Math.min(width - 12, height * 0.58);
  const {state} = game;
  const current = state.players.find(p => p.color === state.currentColor);
  const humanCharacter = getCharacter(settings.equippedCharacterId);
  const glyph = (color: PlayerColor) =>
    game.humanColors.includes(color) && humanCharacter.id !== CLASSIC_PAWN_ID
      ? humanCharacter.glyph
      : '';
  const diceDefinition = getDice(
    game.humanColors.includes(state.currentColor)
      ? settings.equippedDiceId
      : 'classic_dice'
  );

  const spectating =
    game.humanColors.length > 0 &&
    game.humanColors.every(
      c => state.players.find(p => p.color === c)?.status !== 'active'
    ) &&
    state.phase.kind !== 'finished';

  const turnText =
    state.phase.kind === 'finished'
      ? 'Partie terminée'
      : game.dice.rolling
        ? 'Lancer en cours…'
        : game.canRoll
          ? `${current?.displayName ?? ''} : lancez le dé`
          : game.movable.size > 0
            ? `${current?.displayName ?? ''} : choisissez un pion (${game.dice.value ?? ''})`
            : `Au tour de ${current?.displayName ?? ''}`;

  return (
    <View style={styles.root}>
      <EnvironmentLayer
        environment={getEnvironment(theme.environmentId)}
        quality={settings.graphics}
        reduceMotion={settings.reduceMotion}
        width={width}
        height={height}
      />
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Button
            label="Quitter"
            variant="ghost"
            onPress={() => router.back()}
          />
          <View style={styles.flex}>
            {state.duel ? (
              <AppText variant="heading" color="#FFD54F" style={styles.center}>
                DUEL FINAL
              </AppText>
            ) : spectating ? (
              <AppText variant="label" style={styles.center}>
                Mode spectateur
              </AppText>
            ) : null}
            {state.config.adventure ? (
              <AppText variant="caption" muted style={styles.center}>
                Adventure · {state.config.adventure.seed}
              </AppText>
            ) : null}
          </View>
        </View>

        <PlayersBar state={state} theme={theme} />

        <View style={styles.boardWrap}>
          <LudoBoard
            state={state}
            theme={theme}
            size={boardSize}
            movable={game.movable}
            onPawnPress={game.movePawn}
            animations={game.animations}
            characterGlyph={glyph}
            reduceMotion={settings.reduceMotion}
          />
        </View>

        <View
          style={[styles.controls, {backgroundColor: theme.palette.surface}]}>
          <Dice
            definition={diceDefinition}
            value={game.dice.value}
            rollId={game.dice.rollId}
            size={56}
            canRoll={game.canRoll}
            reduceMotion={settings.reduceMotion}
            onPress={game.roll}
            onRollEnd={game.onDiceAnimationEnd}
          />
          <View style={styles.flex}>
            <AppText variant="label" accessibilityLiveRegion="polite">
              {turnText}
            </AppText>
            {game.log.slice(0, 3).map((line, i) => (
              <AppText
                key={`${i}-${line}`}
                variant="caption"
                muted
                numberOfLines={1}>
                {line}
              </AppText>
            ))}
          </View>
        </View>
      </SafeAreaView>

      {game.finishedPrompt ? (
        <FinishedPrompt
          color={game.finishedPrompt}
          state={state}
          theme={theme}
          onStay={game.dismissFinishedPrompt}
          onLeave={() => router.back()}
        />
      ) : null}
      {state.phase.kind === 'finished' && !dismissedFinal ? (
        <FinalRanking
          state={state}
          theme={theme}
          onClose={() => setDismissedFinal(true)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  safe: {flex: 1, paddingHorizontal: 6, gap: 8},
  header: {flexDirection: 'row', alignItems: 'center', gap: 8},
  flex: {flex: 1},
  center: {textAlign: 'center'},
  boardWrap: {alignItems: 'center'},
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 14,
  },
});
