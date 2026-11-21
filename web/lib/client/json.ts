// Minimal JSON client for the Saksi API. Errors follow the shared `{ error: { code, message } }` shape
// (ApiError in lib/shared/types.ts); the message is English and safe to show in the UI.
import type { ApiError } from '../shared/types'

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}

function isApiError(body: unknown): body is ApiError {
  if (typeof body !== 'object' || body === null || !('error' in body)) return false
  const error = (body as { error: unknown }).error
  return typeof error === 'object' && error !== null && 'code' in error && 'message' in error
}

const NETWORK = 'Could not reach the Saksi server. Check your connection.'

export async function requestJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...init })
  } catch {
    throw new ApiClientError(0, 'NETWORK', NETWORK)
  }
  let data: unknown = null
  try {
    data = res.status === 204 ? null : await res.json()
  } catch {
    // Empty or non-JSON body (for example a proxy error page); handled below.
  }
  if (!res.ok) {
    if (isApiError(data)) throw new ApiClientError(res.status, data.error.code, data.error.message)
    throw new ApiClientError(res.status, 'HTTP_ERROR', `The server answered with status ${res.status}.`)
  }
  return data as T
}

export const getJson = <T>(url: string) => requestJson<T>(url)

export const postJson = <T>(url: string, body: unknown) =>
  requestJson<T>(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
