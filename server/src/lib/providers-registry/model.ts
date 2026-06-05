type ModelPurpose = 'text' | 'image' | 'video' | 'audio';
type ChargeType = 'token' | 'unit' | 'duration';

type ModelInitParams = {
    provider: string;
    modelId: string;
    purpose: ModelPurpose;
    chargeType: ChargeType;
    rate: number;
    maxContextTokens?: number;
}

class ProviderModel {
    public readonly provider: string;
    public purpose: ModelPurpose;
    public chargeType: ChargeType;
    public readonly rate: number;
    public readonly modelId: string;
    public readonly maxContextTokens?: number;

    constructor(params: ModelInitParams){
        this.provider = params.provider;
        this.modelId = params.modelId;
        this.purpose = params.purpose;
        this.chargeType = params.chargeType;
        this.rate = params.rate;
        this.maxContextTokens = params.maxContextTokens;
    }

    estimateCostUsd(usage: number): number {
        return 0;
    }
}