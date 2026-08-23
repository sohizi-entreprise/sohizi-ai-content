import { WAVE_SPEED_VENDOR } from '@/features/ai/agent/core/vendor';
import { MediaConfigurationError } from '../errors';
import type { MediaEngineProvider } from './type';
import { WaveSpeedProvider } from './wave-speed';

export type MediaProviderName = typeof WAVE_SPEED_VENDOR;

type MediaProviderConstructor = new (apiKey: string) => MediaEngineProvider;

const PROVIDER_CLASSES = {
    [WAVE_SPEED_VENDOR]: WaveSpeedProvider,
} satisfies Record<MediaProviderName, MediaProviderConstructor>;

function isMediaProviderName(name: string): name is MediaProviderName {
    return name in PROVIDER_CLASSES;
}

function resolveProvider(name: string): {
    name: MediaProviderName;
    ProviderClass: MediaProviderConstructor;
} {
    if (!isMediaProviderName(name)) {
        throw new MediaConfigurationError(`Unknown media provider: ${name}`);
    }
    return { name, ProviderClass: PROVIDER_CLASSES[name] };
}

function getProviderApiKey(name: MediaProviderName): string {
    switch (name) {
        case WAVE_SPEED_VENDOR: {
            const apiKey = process.env.WAVESPEED_API_KEY;
            if (!apiKey) {
                throw new MediaConfigurationError('WAVESPEED_API_KEY is not set');
            }
            return apiKey;
        }
    }
}

export function getProviderClass(name: string): MediaProviderConstructor {
    return resolveProvider(name).ProviderClass;
}

export function createProvider(name: string): MediaEngineProvider {
    const { name: providerName, ProviderClass } = resolveProvider(name);
    return new ProviderClass(getProviderApiKey(providerName));
}
