export type ClassifiedRunError =
  | {
      kind: "billing"
      message: string
      billingPath: "/account/billing"
    }
  | {
      kind: "generic"
      message: string
    }

const BILLING_ERROR_PATTERNS = [
  /insufficient\s+credits/i,
  /insufficientcreditserror/i,
  /not\s+enough\s+credits/i,
]

export const BILLING_RUN_ERROR_MESSAGE =
  "You don't have enough credits to complete this request."

export const GENERIC_RUN_ERROR_MESSAGE =
  "Something went wrong while generating the response. Please try again."

export function classifyRunError(
  error: string | null | undefined,
): ClassifiedRunError {
  const raw = error?.trim() ?? ""
  if (
    raw.length > 0 &&
    BILLING_ERROR_PATTERNS.some((pattern) => pattern.test(raw))
  ) {
    return {
      kind: "billing",
      message: BILLING_RUN_ERROR_MESSAGE,
      billingPath: "/account/billing",
    }
  }

  return {
    kind: "generic",
    message: GENERIC_RUN_ERROR_MESSAGE,
  }
}
