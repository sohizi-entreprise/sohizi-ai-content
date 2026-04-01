// abortManager.ts
import Redis from 'ioredis';
import { redis } from '@/lib';

type CancellationMessage = {
    id: string;
};

class AbortManager {
    private readonly redis: Redis;
    private readonly activeGenerations: Map<string, AbortController>;

    constructor(redis: Redis) {
        this.redis = redis;
        this.activeGenerations = new Map<string, AbortController>();
    }

    registerGeneration(id: string): AbortController {
        const controller = new AbortController();
        this.activeGenerations.set(id, controller);
        return controller;
    }

    cleanupGeneration(id: string) {
        this.activeGenerations.delete(id);
    }

    async broadcastCancellation(id: string) {
        return await this.redis.publish('request:cancellations', JSON.stringify({ id }));
    }

    private async ensureSubscriberConnected(subscriber: Redis) {
        if (subscriber.status === 'wait') {
            await subscriber.connect();
            return;
        }

        if (subscriber.status === 'ready' || subscriber.status === 'connect') {
            console.log('Subscriber already connected');
            return;
        }

        await new Promise<void>((resolve, reject) => {
            const handleReady = () => {
                cleanup();
                resolve();
            };

            const handleError = (error: Error) => {
                cleanup();
                reject(error);
            };

            const cleanup = () => {
                subscriber.off('ready', handleReady);
                subscriber.off('connect', handleReady);
                subscriber.off('error', handleError);
            };

            subscriber.on('ready', handleReady);
            subscriber.on('connect', handleReady);
            subscriber.on('error', handleError);
        });
    }

    async listenForCancellations() {
        const subscriber = this.redis.duplicate();
        await this.ensureSubscriberConnected(subscriber);
        await subscriber.subscribe('request:cancellations');
        subscriber.on('message', (channel, message) => {
            if (channel !== 'request:cancellations') {
                return;
            }

            const { id } = JSON.parse(message) as CancellationMessage;
            if (this.activeGenerations.has(id)) {
                console.log(`Aborting generation: ${id}`);
                this.activeGenerations.get(id)?.abort();
                this.activeGenerations.delete(id);
            }
        });
    }
}

export const abortManager = new AbortManager(redis);