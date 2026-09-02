import { MediaError } from '@/features/media-engine/errors'

export class NoRouteError extends MediaError {
  readonly isRetriable = false
  readonly code = 'NO_ROUTE'

  constructor(modelId: string) {
    super(`No enabled media vendor route for model ${modelId}`)
  }
}

export class AllVendorsSaturatedError extends MediaError {
  readonly isRetriable = false
  readonly code = 'VENDORS_SATURATED'

  constructor(modelId: string) {
    super(`All media vendors are saturated for model ${modelId}`)
  }
}
