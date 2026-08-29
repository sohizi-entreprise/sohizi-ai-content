export function getErrorMessage(error: unknown, fallback?: string) {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    if (fallback !== undefined) {
        return fallback;
    }

    return String(error);
}