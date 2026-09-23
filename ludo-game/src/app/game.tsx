import {router} from 'expo-router';
import {useState} from 'react';
import {GameView} from '../components/game/GameView.tsx';
import {useLocalMatch} from '../hooks/useLocalMatch.ts';
import {getMatchSetup} from '../state/matchSetup.ts';

export default function GameScreen() {
  const [setup] = useState(getMatchSetup);
  const game = useLocalMatch(setup);
  return (
    <GameView
      game={{
        ...game,
        localColors: game.humanColors,
        onQuit: () => router.back(),
      }}
    />
  );
}
