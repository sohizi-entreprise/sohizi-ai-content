import { SubmitPayload } from "./type";
import { getVendorParamsMapping } from "../repo";

function isMediaUrl(value: string): boolean {
    if (value.startsWith('data:')) return true;
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

function urlsFromValue(value: unknown): string[] {
    if (typeof value === 'string') {
        return isMediaUrl(value) ? [value] : [];
    }
    if (Array.isArray(value)) {
        return value.flatMap(urlsFromValue);
    }
    if (value && typeof value === 'object') {
        return Object.values(value as Record<string, unknown>).flatMap(urlsFromValue);
    }
    return [];
}

export function extractOutputUrls(data: unknown): string[] {
    return [...new Set(urlsFromValue(data))];
}

export const mapVendorPayload = async (vendor: string, modelId: string, payload: SubmitPayload) => {
    const parameters: string[] = [];
    const values: string[] = [];

    const parameterMap: Record<string, string> = {};
    const optionMap: Record<string, string> = {};

    for (const [key, value] of Object.entries(payload)) {
        if(key === 'prompt'){
            continue;
        }
        parameters.push(key);
        if(typeof value === 'string'){
            values.push(value);
            continue;
        }
        if(Array.isArray(value)){
            for(const item of value){
                if(typeof item === 'string'){
                    values.push(item);
                }
            }
            continue;
        }
    }

    const parametersMapping = await getVendorParamsMapping(vendor, modelId, parameters);

    for (const parameter of parametersMapping) {
        if(parameter.vendorParameter){
            parameterMap[parameter.parameter] = parameter.vendorParameter;
        }
        if(parameter.optionValue && parameter.vendorOption){
            optionMap[parameter.optionValue] = parameter.vendorOption;
        }
    }

    const mappedPayload: SubmitPayload = {};

    for (const value of values) {
        if(optionMap[value]){
            mappedPayload[optionMap[value]] = value;
        }
    }

    for (const [key, value] of Object.entries(payload)) {
        
        const mappedKey = parameterMap[key] || key;
        let optionMapped = value;

        if(Array.isArray(value)){
            optionMapped = value.map(item => typeof item === 'string' ? optionMap[item] || item : item);
        }else if(typeof value === 'string'){
            optionMapped = optionMap[value] || value;
        }

        mappedPayload[mappedKey] = optionMapped;
    }

    return mappedPayload;
}