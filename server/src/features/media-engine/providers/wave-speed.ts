import { CancelResponse, EstimateRequestPriceResponse, GetRequestDataResponse, MediaEngineProvider, SubmitResponse, SubmitPayload } from "./type";
import { waveSpeedFuncs } from "@/lib/wave-speed";
import { WAVE_SPEED_VENDOR } from "@/features/ai/agent/core/vendor";
import { mapVendorPayload } from "./utils";
import { getVendorModelApiName } from "../repo";

function toRequestData(outputs: unknown): Array<string | Record<string, string>> {
    if (Array.isArray(outputs)) {
        return outputs.filter((item): item is string | Record<string, string> =>
            typeof item === 'string' || (item !== null && typeof item === 'object' && !Array.isArray(item)),
        );
    }
    if (typeof outputs === 'string') return [outputs];
    if (outputs && typeof outputs === 'object') return [outputs as Record<string, string>];
    return [];
}


export class WaveSpeedProvider implements MediaEngineProvider {

    private modelApiName: string | null = null;
    private payload: SubmitPayload | null = null;

    constructor(private readonly apiKey: string) {
        this.apiKey = apiKey;
        this.modelApiName = null;
        this.payload = null;
    }

    async submitRequest(model: string, payload: SubmitPayload): Promise<SubmitResponse> {
        const [modelApiName, mappedPayload] = await Promise.all([this.getModelApiName(model), this.getPayload(model, payload)]);
        const response = await waveSpeedFuncs.submitJob(this.apiKey, modelApiName, mappedPayload);
        return {
            requestId: response.jobId,
            status: response.status,
        }
    }

    async getRequestData(requestId: string): Promise<GetRequestDataResponse> {
        try {
            const response = await waveSpeedFuncs.getJobResult(this.apiKey, requestId);
            if (response.status === 'completed') {
                return {
                    status: 'completed',
                    data: toRequestData(response.outputs),
                };
            }
            return { status: response.status };
        } catch (error) {
            if (error instanceof waveSpeedFuncs.WaveSpeedError && error.errorCode === 'GENERATION_FAILED') {
                return { status: 'error', error: error.message };
            }
            throw error;
        }
    }

    async cancelRequest(requestId: string): Promise<CancelResponse> {
        const response = await waveSpeedFuncs.deleteJob(this.apiKey, [requestId]);
        return {
            requestId: requestId,
            ok: response > 0,
        }
    }

    async estimateRequestPrice(model: string, payload: SubmitPayload): Promise<EstimateRequestPriceResponse> {
        const [modelApiName, mappedPayload] = await Promise.all([this.getModelApiName(model), this.getPayload(model, payload)]);
        const response = await waveSpeedFuncs.getInferencePrice(this.apiKey, modelApiName, mappedPayload);
        return {
            ok: true,
            priceUSD: response.price,
        }

    }

    async getModelApiName(model: string): Promise<string> {
        if(this.modelApiName){
            return this.modelApiName;
        }
        const result = await getVendorModelApiName(WAVE_SPEED_VENDOR, model);
        this.modelApiName = result.apiName;
        return this.modelApiName;
    }

    async getPayload(model: string, initialPayload: SubmitPayload): Promise<SubmitPayload> {
        if(this.payload){
            return this.payload;
        }
        const result = await mapVendorPayload(WAVE_SPEED_VENDOR, model, initialPayload);
        this.payload = result;
        return this.payload;
    }

}