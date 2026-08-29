export const CREDIT_RATE = 0.01; // 1 credit = $0.01 of user-facing list value
export const TOKEN_OVERHEAD_RATE = 0.20; // 20% overhead rate
export const IMAGE_OVERHEAD_RATE = 0.25; // 25% overhead rate
export const AUDIO_OVERHEAD_RATE = 0.25; // 25% overhead rate
export const VIDEO_OVERHEAD_RATE = 0.30; // 30% overhead rate
export const TOPUP_TARGET_MARGIN = 0.70; // 70% target margin
export const PAYMENT_FEE_RESERVE = 0.03; // 3% payment fee rate

// Multiplier applied to all cost estimates before reserving credits.
// Overbooking protects against under-charging: it is safer to reserve a bit
// too much and refund the difference on settle than to under-reserve and
// lose money on the overage.
export const ESTIMATE_OVERBOOKING_FACTOR = 1.15; // 15% overbooking
