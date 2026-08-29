import { isAxiosError } from 'axios'

export function getErrorMessage(
  err: unknown,
  fallback = 'An error occurred',
): string {
  if (isAxiosError(err)) {
    const data = err.response?.data as
      | { error?: string; message?: string }
      | undefined
    return data?.error || data?.message || err.message || fallback
  }

  if (err instanceof Error && err.message) {
    return err.message
  }

  return fallback
}

export function throwApiError(
  error: unknown,
  fallback: string,
  options?: { notFound?: string },
): never {
  if (isAxiosError(error)) {
    if (error.response?.status === 404) {
      throw new Error(options?.notFound ?? getErrorMessage(error, 'Not found'))
    }
    if (error.response?.status && error.response.status >= 500) {
      throw new Error(`${fallback}: Internal Server Error`)
    }
    if (error.code === 'ERR_NETWORK') {
      throw new Error('Network Error: try later!')
    }
  }

  throw new Error(getErrorMessage(error, fallback))
}
