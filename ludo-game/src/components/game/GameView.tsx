import {useState, type ReactNode} from 'react';
import {Pressable, StyleSheet, useWindowDimensions, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {CLASSIC_PAWN_ID, getCharacter} from '../../content/characters.ts';
import {getDice} from '../../content/dice.ts';
import {getEnvironment} from '../../environment/environments.ts';
import type {DieValue, GameState, PlayerColor} from '../../game/types.ts';
import {useSettings} from '../../state/settings.tsx';
import {useProfile} from '../../state/profile.tsx';
import {sceneryFor} from '../../themes/scenery.ts';
import {LudoBoard} from '../board/LudoBoard.tsx';
import type {PawnAnimation} from '../board/Pawn.tsx';
import {Dice} from '../dice/Dice.tsx';
import {EnvironmentLayer} from '../environment/EnvironmentLayer.tsx';
import {AppText} from '../ui/AppText.tsx';
import {router} from 'expo-router';
import {useActiveTheme} from '../ui/theme.ts';
import {PlayerCard} from './PlayerCard.tsx';
import {FinalRanking, FinishedPrompt} from './ResultModal.tsx';

export interface GameViewModel {
  readonly state: GameState;
  readonly dice: {
    readonly value: DieValue | null;
    readonly rollId: number;
    readonly rolling: boolean;
  };
  readonly animations: ReadonlyMap<string, PawnAnimation>;
  readonly movable: ReadonlySet<string>;
  readonly canRoll: boolean;
  /** Colours controlled on this device (their skins are shown). */
  readonly localColors: readonly PlayerColor[];
  readonly log: readonly string[];
  readonly finishedPrompt: PlayerColor | null;
  roll(): void;
  movePawn(color: PlayerColor, pawnIndex: number): void;
  onDiceAnimationEnd(): void;
  dismissFinishedPrompt(): void;
  onQuit(): void;
}

/** Game screen body shared by offline and online matches. */
export function GameView({
  game,
  banner,
}: {
  readonly game: GameViewModel;
  readonly banner?: ReactNode;
}) {
  const theme = useActiveTheme();
  const {settings} = useSettings();
  const {width, height} = useWindowDimensions();
  const [dismissedFinal, setDismissedFinal] = useState(false);
  const boardSize = Math.min(width - 8, height * 0.56);
  const {state} = game;
  const current = state.players.find(p => p.color === state.currentColor);
  const humanCharacter = getCharacter(settings.equippedCharacterId);
  const glyph = (color: PlayerColor) =>
    game.localColors.includes(color) && humanCharacter.id !== CLASSIC_PAWN_ID
      ? humanCharacter.glyph
      : '';
  const diceDefinition = getDice(
    game.localColors.includes(state.currentColor)
      ? settings.equippedDiceId
      : 'classic_dice'
  );
  const spectating =
    game.localColors.length === 0 ||
    (game.localColors.every(
      c => state.players.find(p => p.color === c)?.status !== 'active'
    ) &&
      state.phase.kind !== 'finished');
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

  const {profile} = useProfile();
  const cardSize = Math.min(64, width * 0.15);
  const labels = Object.fromEntries(
    state.players.map(p => [p.color, p.displayName])
  );
  const Pill = ({icon, value}: {icon: string; value: string}) => (
    <View style={[styles.pill, {borderColor: theme.palette.surfaceAlt}]}>
      <AppText variant="label">{icon}</AppText>
      <AppText variant="label">{value}</AppText>
    </View>
  );
  return (
    <View style={styles.root}>
      <EnvironmentLayer
        environment={getEnvironment(theme.environmentId)}
        quality={settings.graphics}
        reduceMotion={settings.reduceMotion}
        width={width}
        height={height}
        scenery={sceneryFor(theme)}
      />
      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quitter la partie"
            onPress={game.onQuit}
            style={styles.iconBtn}>
            <AppText variant="heading">☰</AppText>
          </Pressable>
          <Pill icon="🪙" value={profile ? String(profile.coins) : '—'} />
          <Pill icon="💎" value={profile ? String(profile.gems) : '—'} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Paramètres"
            onPress={() => router.push('/settings')}
            style={styles.iconBtn}>
            <AppText variant="heading">⚙</AppText>
          </Pressable>
        </View>
        <View style={styles.flex} />
        <View style={styles.cornerRow}>
          <PlayerCard
            state={state}
            color="green"
            theme={theme}
            size={cardSize}
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
              <AppText variant="caption" style={styles.center}>
                Adventure · {state.config.adventure.seed}
              </AppText>
            ) : null}
          </View>
          <PlayerCard
            state={state}
            color="yellow"
            theme={theme}
            size={cardSize}
          />
        </View>
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
            playerLabels={labels}
          />
        </View>
        <View style={styles.cornerRow}>
          <PlayerCard state={state} color="red" theme={theme} size={cardSize} />
          <View
            style={[
              styles.diceBox,
              {
                backgroundColor: theme.palette.surface,
                borderColor: sceneryFor(theme).frame.trim,
              },
            ]}>
            <Dice
              definition={diceDefinition}
              value={game.dice.value}
              rollId={game.dice.rollId}
              size={52}
              canRoll={game.canRoll}
              reduceMotion={settings.reduceMotion}
              onPress={game.roll}
              onRollEnd={game.onDiceAnimationEnd}
            />
          </View>
          <PlayerCard
            state={state}
            color="blue"
            theme={theme}
            size={cardSize}
          />
        </View>
        <View
          style={[styles.infoBar, {backgroundColor: theme.palette.surface}]}>
          <AppText
            variant="label"
            accessibilityLiveRegion="polite"
            numberOfLines={1}>
            {turnText}
          </AppText>
          {game.log.slice(0, 2).map((line, i) => (
            <AppText
              key={`${i}-${line}`}
              variant="caption"
              muted
              numberOfLines={1}>
              {line}
            </AppText>
          ))}
        </View>
        {banner}
      </SafeAreaView>
      {game.finishedPrompt ? (
        <FinishedPrompt
          color={game.finishedPrompt}
          state={state}
          theme={theme}
          onStay={game.dismissFinishedPrompt}
          onLeave={game.onQuit}
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
  safe: {flex: 1, paddingHorizontal: 4, gap: 6},
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 4,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,20,40,0.75)',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: 'rgba(20,20,40,0.75)',
    minWidth: 90,
    justifyContent: 'center',
  },
  cornerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  flex: {flex: 1},
  center: {textAlign: 'center'},
  boardWrap: {alignItems: 'center'},
  diceBox: {borderRadius: 14, borderWidth: 2, padding: 6},
  infoBar: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    opacity: 0.92,
  },
});
