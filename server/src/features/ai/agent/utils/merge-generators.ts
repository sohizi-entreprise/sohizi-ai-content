type QueueItem<T> = { value: T; done: false } | { done: true };

/**
 * Merges multiple async generators into one stream. Values are yielded in
 * completion order across sources. Each source pushes a terminal marker when
 * it finishes or errors so the merge never deadlocks.
 */
export async function* mergeGenerators<T>(
    ...gens: AsyncGenerator<T>[]
): AsyncGenerator<T> {
    const queue: QueueItem<T>[] = [];
    const waiters: Array<() => void> = [];

    const flushWaiters = () => {
        while (queue.length > 0 && waiters.length > 0) {
            waiters.shift()!();
        }
    };

    const enqueue = (item: QueueItem<T>) => {
        queue.push(item);
        flushWaiters();
    };

    /** Safe when empty: registers a waiter, then flushes if data arrived in the same turn. */
    const waitForItem = (): Promise<void> => {
        if (queue.length > 0) return Promise.resolve();
        return new Promise<void>((resolve) => {
            waiters.push(resolve);
            flushWaiters();
        });
    };

    const errors: unknown[] = [];

    const tasks = gens.map((gen) =>
        (async () => {
            try {
                for await (const value of gen) {
                    enqueue({ value, done: false });
                }
            } catch (e) {
                errors.push(e);
            } finally {
                enqueue({ done: true });
            }
        })()
    );

    let finished = 0;

    try {
        while (finished < gens.length) {
            if (queue.length === 0) {
                await waitForItem();
            }

            while (queue.length > 0) {
                const item = queue.shift()!;
                if (item.done) {
                    finished++;
                } else {
                    yield item.value;
                }
            }
        }

        if (errors.length === 1) {
            throw errors[0];
        }
        if (errors.length > 1) {
            throw new AggregateError(
                errors,
                `mergeGenerators: ${errors.length} producer error(s)`
            );
        }
    } finally {
        await Promise.allSettled(tasks);
    }
}
