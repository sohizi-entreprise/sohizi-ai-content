type RequestStatus =
  'completed' | 'failed' | 'cancelled' | 'timeout' | 'processing' | 'created'
type Primitive = string | number | boolean | null | undefined
export type SubmitPayload = Record<string, Primitive | Primitive[]>

export type SubmitResponse = {
  requestId: string
  status: 'created'
}

type RequestData = Array<string | Record<string, string>>

export type GetRequestDataResponse =
  | {
      status: Omit<RequestStatus, 'completed' | 'error'>
    }
  | {
      status: 'completed'
      data: RequestData
    }
  | {
      status: 'error'
      error: string
    }

export type CancelResponse = {
  requestId: string
  ok: boolean
}

export type EstimateRequestPriceResponse =
  | {
      ok: true
      priceUSD: number
    }
  | {
      ok: false
      error: string
    }

export interface MediaEngineProvider {
  submitRequest: (
    model: string,
    payload: SubmitPayload,
  ) => Promise<SubmitResponse>
  getRequestData: (requestId: string) => Promise<GetRequestDataResponse>
  cancelRequest: (requestId: string) => Promise<CancelResponse>
  estimateRequestPrice: (
    model: string,
    payload: SubmitPayload,
  ) => Promise<EstimateRequestPriceResponse>
}
