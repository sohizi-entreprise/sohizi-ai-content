import type { ToolResult } from "./tool-definition";

export function success(output: string): ToolResult {
    return { success: true, output };
}

export function failure(output: string): ToolResult {
    return { success: false, output };
}