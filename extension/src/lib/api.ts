/**
 * Typed client for the Atlas capture backend.
 *
 * Only the background worker imports this. All calls include credentials so
 * the session cookie (Phase 2) is attached; in Phase 0 the backend uses a
 * dev-stub session and ignores it.
 */
import type {
  CaptureRequest,
  CaptureResponse,
  SessionResponse,
  UploadUrlRequest,
  UploadUrlResponse,
} from "./contracts"

const BASE_URL: string = import.meta.env.WXT_BACKEND_URL ?? "http://localhost:8000"

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let resp: Response
  try {
    resp = await fetch(`${BASE_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    })
  } catch {
    throw new ApiError(`Network error calling ${path}`, 0)
  }

  if (resp.status === 204) return undefined as T
  const body = await resp.json().catch(() => null)

  if (!resp.ok) {
    const err = body?.error
    throw new ApiError(err?.message ?? `Request failed (${resp.status})`, resp.status, err?.code)
  }
  return body as T
}

export const api = {
  getSession: () => request<SessionResponse>("/v1/session"),

  setActiveSpace: (spaceId: string) =>
    request<void>("/v1/session/active", {
      method: "POST",
      body: JSON.stringify({ space_id: spaceId }),
    }),

  captureSource: (payload: CaptureRequest) =>
    request<CaptureResponse>("/v1/sources", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  createUploadUrl: (payload: UploadUrlRequest) =>
    request<UploadUrlResponse>("/v1/sources/upload-url", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
}
