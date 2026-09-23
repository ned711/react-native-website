import * as Haptics from 'expo-haptics';
import type {HapticsBackend} from '../audio/engine.ts';

export const expoHapticsBackend: HapticsBackend = {
  trigger(pattern) {
    const run = () => {
      switch (pattern) {
        case 'light':
          return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        case 'medium':
          return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        case 'heavy':
          return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        case 'success':
          return Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success
          );
        case 'warning':
          return Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Warning
          );
      }
    };
    // Haptics are unavailable on web / some devices: ignore failures.
    run().catch(() => undefined);
  },
};
