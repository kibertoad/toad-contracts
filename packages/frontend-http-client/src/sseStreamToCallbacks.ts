type MaybePromise<T> = T | Promise<T>;

export type SseEventCallbacks<TEvent extends { type: string; data: unknown }> = {
  onEvent: {
    [K in TEvent["type"]]: (data: Extract<TEvent, { type: K }>["data"]) => MaybePromise<void>;
  };
  onError?: (error: unknown) => MaybePromise<void>;
  /**
   * Called once after the server closes the stream naturally (without error). Not called on
   * aborted streams; `onError` is the signal for those.
   */
  onDone?: () => MaybePromise<void>;
};

/**
 * Consumes an SSE `AsyncIterable` (as returned by `sendByApiContract`) and dispatches
 * typed events to per-event callbacks, bridging the callback-based pattern with the
 * `sendByApiContract` API.
 *
 * Iteration runs in the background. To abort early, pass an `AbortSignal` to `sendByApiContract`
 * and call `abort()` on its controller.
 *
 * @example
 * ```typescript
 * const controller = new AbortController()
 *
 * const { result } = await sendByApiContract(client, myContract, {
 *   signal: controller.signal,
 * })
 *
 * sseStreamToCallbacks(result.body, {
 *   onEvent: {
 *     'item.updated': (data) => console.log(data),
 *     done: (data) => console.log(data.total),
 *   },
 *   onError: (err) => console.error(err),
 *   onDone: () => console.log('stream closed'),
 * })
 *
 * // later, to stop early:
 * controller.abort()
 * ```
 */
export function sseStreamToCallbacks<TEvent extends { type: string; data: unknown }>(
  stream: AsyncIterable<TEvent>,
  callbacks: SseEventCallbacks<TEvent>,
): void {
  void (async () => {
    try {
      for await (const event of stream) {
        const handler = callbacks.onEvent[event.type as TEvent["type"]];
        await handler(event.data);
      }
      await callbacks.onDone?.();
    } catch (err) {
      if (!callbacks.onError) {
        throw err;
      }
      callbacks.onError(err);
    }
  })();
}
