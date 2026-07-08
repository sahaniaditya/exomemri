const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
 
export async function apiFetch(endpoint: string, options: RequestInit = {}, explicitToken?: string | null) {
  const token = explicitToken || (typeof window !== "undefined" ? localStorage.getItem("atlas_token") : null);
  const headers = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };
  return fetch(`${BACKEND_URL}${endpoint}`, {
    ...options,
    headers,
    // Auth/profile checks must never be served from Next's Data Cache —
    // a stale cached response here is exactly what causes login/onboarding
    // redirect loops. Always hit the backend fresh.
    cache: "no-store",
  });
}