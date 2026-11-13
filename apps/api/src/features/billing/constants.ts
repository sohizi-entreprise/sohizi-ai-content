export const LOADED_COST_USD_PER_CREDIT = 0.003
export const TOKEN_OVERHEAD_RATE = 0.08 // 8% overhead rate
export const IMAGE_OVERHEAD_RATE = 0.1 // 10% overhead rate
export const AUDIO_OVERHEAD_RATE = 0.1 // 10% overhead rate
export const VIDEO_OVERHEAD_RATE = 0.15 // 15% overhead rate

// Multiplier applied to all cost estimates before reserving credits.
// Overbooking protects against under-charging: it is safer to reserve a bit
// too much and refund the difference on settle than to under-reserve and
// lose money on the overage.
export const ESTIMATE_OVERBOOKING_FACTOR = 1.15 // 15% overbooking
