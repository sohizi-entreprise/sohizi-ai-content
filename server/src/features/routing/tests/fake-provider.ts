import type {
    CancelResponse,
    EstimateRequestPriceResponse,
    GetRequestDataResponse,
    MediaEngineProvider,
    SubmitPayload,
    SubmitResponse,
} from '@/features/media-engine/providers/type'

export type FakeScript = {
    submit?: (apiName: string, payload: SubmitPayload) => Promise<SubmitResponse>
    submitError?: unknown
    poll?: (requestId: string) => Promise<GetRequestDataResponse>
    estimate?: (apiName: string, payload: SubmitPayload) => Promise<EstimateRequestPriceResponse>
}

const scripts = new Map<string, FakeScript>()
const pollCounts = new Map<string, number>()
const submitCounts = new Map<string, number>()

export function setFakeScript(vendorName: string, script: FakeScript): void {
    scripts.set(vendorName, script)
}

export function resetFakeVendors(): void {
    scripts.clear()
    pollCounts.clear()
    submitCounts.clear()
}

export function fakeSubmitCount(vendorName: string): number {
    return submitCounts.get(vendorName) ?? 0
}

export function fakePollCount(vendorName: string): number {
    return pollCounts.get(vendorName) ?? 0
}

export function createFakeProviderClass(vendorName: string) {
    return class FakeMediaProvider implements MediaEngineProvider {
        constructor(private readonly apiKey: string) {}

        async submitRequest(apiName: string, payload: SubmitPayload): Promise<SubmitResponse> {
            submitCounts.set(vendorName, (submitCounts.get(vendorName) ?? 0) + 1)
            const script = scripts.get(vendorName)
            if (script?.submitError) {
                throw script.submitError
            }
            if (script?.submit) {
                return script.submit(apiName, payload)
            }
            return { requestId: `${vendorName}-job`, status: 'created' }
        }

        async getRequestData(requestId: string): Promise<GetRequestDataResponse> {
            pollCounts.set(vendorName, (pollCounts.get(vendorName) ?? 0) + 1)
            const script = scripts.get(vendorName)
            if (script?.poll) {
                return script.poll(requestId)
            }
            return { status: 'processing' }
        }

        async cancelRequest(requestId: string): Promise<CancelResponse> {
            return { requestId, ok: true }
        }

        async estimateRequestPrice(apiName: string, payload: SubmitPayload): Promise<EstimateRequestPriceResponse> {
            const script = scripts.get(vendorName)
            if (script?.estimate) {
                return script.estimate(apiName, payload)
            }
            return { ok: true, priceUSD: 0.01 }
        }
    }
}
