// StreamBus.ts
type Waiter<T> = {
    resolve: (value: IteratorResult<T>) => void;
    reject: (err: unknown) => void;
  };
  
  export type StreamBusOptions<TEvent> = {
    /** Prevent unbounded memory growth. Default: 10_000 */
    maxQueueSize?: number;
  
    /** What to do when queue is full. Default: "drop_oldest" */
    overflow?: "drop_oldest" | "drop_newest" | "throw";
  
    /**
     * Optional: called when the bus closes.
     * Useful to cancel upstream work (AbortController, etc.)
     */
    onClose?: () => void;
  
    /**
     * Optional: if you want the bus to auto-close when all producers end,
     * provide a function that creates the "done" event.
     * If omitted, the bus won't emit a done event; it will just close.
     */
    makeDoneEvent?: () => TEvent;
  
    /**
     * Optional: if you want the bus to emit producer lifecycle events,
     * provide factories for start/end/error. Otherwise, lifecycle tracking is internal only.
     */
    lifecycle?: {
      makeStart?: (producerId: string) => TEvent;
      makeEnd?: (producerId: string) => TEvent;
      makeError?: (producerId: string, error: unknown) => TEvent;
    };
  };
  
  export class StreamBus<TEvent> implements AsyncIterable<TEvent> {
    private queue: TEvent[] = [];
    private waiters: Waiter<TEvent>[] = [];
    private closed = false;
  
    private readonly maxQueueSize: number;
    private readonly overflow: "drop_oldest" | "drop_newest" | "throw";
  
    private activeProducers = new Set<string>();
    private readonly onClose?: () => void;
    private readonly makeDoneEvent?: () => TEvent;
    private readonly lifecycle?: StreamBusOptions<TEvent>["lifecycle"];
  
    constructor(options: StreamBusOptions<TEvent> = {}) {
      this.maxQueueSize = options.maxQueueSize ?? 10_000;
      this.overflow = options.overflow ?? "drop_oldest";
      this.onClose = options.onClose;
      this.makeDoneEvent = options.makeDoneEvent;
      this.lifecycle = options.lifecycle;
    }
  
    /** Push any event into the bus (works for any shape). */
    push(event: TEvent): void {
      if (this.closed) return;
  
      // If someone is awaiting next(), deliver immediately
      const waiter = this.waiters.shift();
      if (waiter) {
        waiter.resolve({ value: event, done: false });
        return;
      }
  
      // Otherwise enqueue, applying overflow policy
      if (this.queue.length >= this.maxQueueSize) {
        if (this.overflow === "throw") {
          throw new Error(`StreamBus queue overflow (maxQueueSize=${this.maxQueueSize})`);
        }
        if (this.overflow === "drop_newest") {
          return; // silently drop this event
        }
        // drop_oldest
        this.queue.shift();
      }
  
      this.queue.push(event);
    }
  
    /** Optional: mark a producer as active; emits a start event if configured. */
    addProducer(producerId: string): void {
      if (this.closed) throw new Error("StreamBus is closed");
      this.activeProducers.add(producerId);
      const ev = this.lifecycle?.makeStart?.(producerId);
      if (ev !== undefined) this.push(ev);
    }
  
    /** Optional: mark a producer as ended; closes bus when all producers ended. */
    endProducer(producerId: string): void {
      if (!this.activeProducers.has(producerId)) return;
  
      const ev = this.lifecycle?.makeEnd?.(producerId);
      if (ev !== undefined) this.push(ev);
  
      this.activeProducers.delete(producerId);
  
      if (this.activeProducers.size === 0) {
        if (this.makeDoneEvent) this.push(this.makeDoneEvent());
        this.close();
      }
    }
  
    /** Optional: emit error event and end the producer (if tracked). */
    producerError(producerId: string, error: unknown): void {
      const ev = this.lifecycle?.makeError?.(producerId, error);
      if (ev !== undefined) this.push(ev);
      this.endProducer(producerId);
    }
  
    /** Close the bus: no further pushes; wakes any waiting consumers. */
    close(): void {
      if (this.closed) return;
      this.closed = true;
      try {
        this.onClose?.();
      } finally {
        while (this.waiters.length) {
          const w = this.waiters.shift()!;
          w.resolve({ value: undefined as any, done: true });
        }
      }
    }
  
    /** Helper: attach an AsyncIterable producer and forward all its events. */
    attachProducer(
      producerId: string,
      stream: AsyncIterable<TEvent> | AsyncIterator<TEvent>
    ): void {
      this.addProducer(producerId);
      (async () => {
        try {
          // Normalize AsyncIterator vs AsyncIterable
          const it =
            Symbol.asyncIterator in (stream as any)
              ? (stream as AsyncIterable<TEvent>)[Symbol.asyncIterator]()
              : (stream as AsyncIterator<TEvent>);
  
          while (true) {
            const { value, done } = await it.next();
            if (done) break;
            this.push(value);
          }
  
          this.endProducer(producerId);
        } catch (e) {
          this.producerError(producerId, e);
        }
      })();
    }
  
    [Symbol.asyncIterator](): AsyncIterator<TEvent> {
      return {
        next: () => {
          const event = this.queue.shift();
          if (event !== undefined) return Promise.resolve({ value: event, done: false });
          if (this.closed) return Promise.resolve({ value: undefined as any, done: true });
  
          return new Promise<IteratorResult<TEvent>>((resolve, reject) => {
            this.waiters.push({ resolve, reject });
          });
        },
        return: async () => {
          // consumer cancelled
          this.close();
          return { value: undefined as any, done: true };
        },
        throw: async (e) => {
          this.close();
          throw e;
        },
      };
    }
  }
  