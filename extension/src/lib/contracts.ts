/**
 * Convenient aliases over the generated OpenAPI types.
 *
 * `types.ts` is generated from the backend schema (`npm run gen:types`) and
 * must never be hand-edited. Everything else imports the contract from here.
 */
import type { components } from "./types"

export type CaptureRequest = components["schemas"]["CaptureRequest"]
export type CaptureResponse = components["schemas"]["CaptureResponse"]
export type UploadUrlRequest = components["schemas"]["UploadUrlRequest"]
export type UploadUrlResponse = components["schemas"]["UploadUrlResponse"]
export type SessionResponse = components["schemas"]["SessionResponse"]
export type SetActiveSpaceRequest = components["schemas"]["SetActiveSpaceRequest"]
export type Space = components["schemas"]["Space"]
export type SpaceSummary = components["schemas"]["SpaceSummary"]
export type SpaceListResponse = components["schemas"]["SpaceListResponse"]
export type User = components["schemas"]["User"]
export type SourceType = components["schemas"]["SourceType"]
export type CreditsBalance = components["schemas"]["CreditsBalance"]

/**
 * The normalized output of a pure extractor: the capture fields it can derive
 * from the DOM. `space_id` is injected by the background worker (the only
 * holder of session state), so it is omitted here.
 */
export type ExtractedCapture = Omit<CaptureRequest, "space_id">
