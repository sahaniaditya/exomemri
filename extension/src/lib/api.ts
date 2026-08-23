/**
 * Typed client for the exomemri capture backend.
 *
 * Only the background worker imports this. Every request carries the logged-in
 * user's Supabase JWT (from the stored session) as a Bearer token; the backend
 * verifies it on all `/v1/session` and `/v1/sources` routes.
 */
import type {
  CaptureRequest,
  CaptureResponse,
  SessionResponse,
  SpaceListResponse,
  UploadUrlRequest,
  UploadUrlResponse,
} from "./contracts"
import { getAccessToken } from "./session-store"

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
  const token = await getAccessToken()
  let resp: Response
  try {
    resp = await fetch(`${BASE_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
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

  listSpaces: () => request<SpaceListResponse>("/v1/spaces"),

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
