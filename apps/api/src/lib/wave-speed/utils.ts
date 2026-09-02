type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'TOO_MANY_REQUESTS'
  | 'INTERNAL_SERVER_ERROR'
  | 'ACCOUNT_ISSUE'
  | 'GENERATION_FAILED'
  | 'REQUEST_TIMEOUT'
  | 'UNKNOWN'

type SubmitJobResponse = {
  code: number
  message: string
  data: {
    id: string
    status: 'created'
    urls: {
      get: string
    }
  }
}

type GetJobResultResponse = {
  status:
    'completed' | 'failed' | 'cancelled' | 'timeout' | 'processing' | 'created'
  outputs: unknown
}

const buildHeader = (
  apiKey: string,
  authOnly: boolean = false,
): HeadersInit => {
  if (authOnly) {
    return {
      Authorization: `Bearer ${apiKey}`,
    }
  }
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }
}

export class WaveSpeedError extends Error {
  code: number
  errorCode: ErrorCode
  constructor(code: number, message: string, errorCode: ErrorCode) {
    super(message)
    this.name = 'WaveSpeedError'
    this.code = code
    this.errorCode = errorCode
  }
}

// Submit a job to the WaveSpeed API for media generation
export const submitJob = async (
  apiKey: string,
  modelId: string,
  input: unknown,
) => {
  const url = `https://api.wavespeed.ai/api/v3/${modelId}`
  const options: RequestInit = {
    method: 'POST',
    headers: buildHeader(apiKey),
    body: JSON.stringify(input),
  }
  const result = (await requestJson(url, options)) as SubmitJobResponse
  return {
    jobId: result.data.id,
    status: result.data.status,
    resultUrl: result.data.urls.get,
  }
}

export const getJobResult = async (apiKey: string, jobId: string) => {
  const url = `https://api.wavespeed.ai/api/v3/predictions/${jobId}/result`
  const options: RequestInit = {
    method: 'GET',
    headers: buildHeader(apiKey, true),
  }
  const result = (await requestJson(url, options)) as {
    data: GetJobResultResponse
  }
  const status = result.data.status

  if (['failed', 'cancelled', 'timeout'].includes(status))
    throw new WaveSpeedError(
      500,
      JSON.stringify(result.data),
      'GENERATION_FAILED',
    )
  if (!['created', 'processing', 'completed'].includes(status))
    throw new WaveSpeedError(500, 'Unexpected status: ' + status, 'UNKNOWN')

  return {
    status,
    outputs: result.data.outputs,
  }
}

export const deleteJob = async (apiKey: string, jobIds: string[]) => {
  const url = `https://api.wavespeed.ai/api/v3/predictions/delete`
  const options: RequestInit = {
    method: 'POST',
    headers: buildHeader(apiKey, true),
    body: JSON.stringify({ ids: jobIds }),
  }
  const result = (await requestJson(url, options)) as {
    data: { deleted_count: number }
  }
  return result.data.deleted_count
}

export const getInferencePrice = async (
  apiKey: string,
  modelId: string,
  input: unknown,
) => {
  const url = `https://api.wavespeed.ai/api/v3/model/price`
  const options = {
    method: 'POST',
    headers: buildHeader(apiKey),
    body: JSON.stringify({ model_id: modelId, inputs: input }),
  }
  const result = (await requestJson(url, options)) as {
    data: { price: number; currency: 'USD' }
  }
  return {
    price: result.data.price,
    currency: result.data.currency,
  }
}

async function requestJson(url: string, options: RequestInit = {}) {
  const response = await fetch(url, options)
  if (!response.ok) {
    const status = response.status
    const error = await response.text()
    if (status === 401) {
      throw new WaveSpeedError(401, 'Invalid API Key', 'UNAUTHORIZED')
    }
    if (status === 400) {
      throw new WaveSpeedError(400, 'Invalid Parameters', 'BAD_REQUEST')
    }
    if (status === 429) {
      throw new WaveSpeedError(429, 'Too Many Requests', 'TOO_MANY_REQUESTS')
    }
    if (status === 500) {
      console.error('WaveSpeed API Error:', error)
      throw new WaveSpeedError(
        500,
        'Internal Server Error',
        'INTERNAL_SERVER_ERROR',
      )
    }
    throw new WaveSpeedError(status, error, 'UNKNOWN')
  }
  return response.json()
}
