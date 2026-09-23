/**
 * Minimal typed event bus. Presentation systems (animation, audio, UI,
 * environment, statistics) subscribe to engine events; they never mutate the
 * game state.
 */
export type Listener<E> = (event: E) => void;

export interface EventBus<E extends {type: string}> {
  subscribe(listener: Listener<E>): () => void;
  on<T extends E['type']>(
    type: T,
    listener: Listener<Extract<E, {type: T}>>
  ): () => void;
  publish(events: readonly E[]): void;
  listenerCount(): number;
}

export function createEventBus<E extends {type: string}>(
  onListenerError?: (error: unknown, event: E) => void
): EventBus<E> {
  const listeners = new Set<Listener<E>>();
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    on(type, listener) {
      const wrapped: Listener<E> = event => {
        if (event.type === type) {
          listener(event as Extract<E, {type: typeof type}>);
        }
      };
      listeners.add(wrapped);
      return () => {
        listeners.delete(wrapped);
      };
    },
    publish(events) {
      for (const event of events) {
        for (const listener of [...listeners]) {
          try {
            listener(event);
          } catch (error) {
            // A broken presentation listener must never break the game loop.
            onListenerError?.(error, event);
          }
        }
      }
    },
    listenerCount() {
      return listeners.size;
    },
  };
}
