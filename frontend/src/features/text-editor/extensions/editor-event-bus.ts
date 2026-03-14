

import { Extension } from "@tiptap/core";
import { EventMap } from "../type";

export type EventType = keyof EventMap & string;
export type EventHandler<T extends EventType> = (payload: EventMap[T]) => void;
export type UnsubscribeFn = () => void;

export class EventBus {
  private listeners = new Map<string, Set<Function>>();

  /**
   * Subscribe to an event.
   * Returns an unsubscribe function — safe to return directly from `useEffect`.
   *
   * @example
   * const off = bus.on("node:created", (p) => console.log(p.nodeType));
   * off(); // unsubscribe
   */
  on<T extends EventType>(type: T, handler: EventHandler<T>): UnsubscribeFn {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(handler);
    return () => this.off(type, handler);
  }

  /** Remove a specific handler */
  off<T extends EventType>(type: T, handler: EventHandler<T>): void {
    this.listeners.get(type)?.delete(handler);
  }

  /**
   * Emit an event to all current subscribers.
   *
   * @example
   * bus.emit("node:created", { nodeType: "heading", text: "Hello" });
   */
  emit<T extends EventType>(type: T, payload: EventMap[T]): void {
    this.listeners.get(type)?.forEach((h) => {
      try {
        h(payload);
      } catch (err) {
        console.error(`[EventBus] Handler for "${type}" threw:`, err);
      }
    });
  }

  /** Remove all handlers for one event type, or clear the entire bus */
  clear(type?: EventType): void {
    type ? this.listeners.delete(type) : this.listeners.clear();
  }

  /** Number of active subscriptions across all event types */
  get size(): number {
    let total = 0;
    this.listeners.forEach((s) => (total += s.size));
    return total;
  }
}

declare module '@tiptap/core' {
  interface Storage {
    editorEventBus: { bus: EventBus };
  }
}

export const EditorEventBusExtension = Extension.create({
    name: 'editorEventBus',
    addStorage() {
        return { bus: new EventBus() };
    }
})