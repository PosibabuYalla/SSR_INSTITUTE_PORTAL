import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/store/auth-store";
import { ApiErrorResponse } from "@/types/auth";

// Centralized API base URL — every API call in the app (axios client below, and any plain
// `fetch` in server components that can't use the browser-oriented axios client) resolves the
// backend origin from here, so there's exactly one place that needs to change per environment.
//
// The localhost fallback only applies outside production (local `next dev`/`next build` with no
// .env.local still works). In a production build, a missing NEXT_PUBLIC_API_URL throws instead of
// silently resolving to a URL that can never work from a deployed browser — a wrong-but-present
// URL produces a confusing CORS error with no indication of the real cause; a build/render
// failure with this message is unambiguous.
if (!process.env.NEXT_PUBLIC_API_URL && process.env.NODE_ENV === "production") {
  throw new Error(
    "NEXT_PUBLIC_API_URL is not set. Set it in the Vercel project's Environment Variables " +
      "(Production) to your deployed backend's URL, e.g. https://ssr-institute-portal.onrender.com/api/v1, then redeploy."
  );
}

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api/v1";

export const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// Separate instance for the refresh call so its own 401s don't recurse into the interceptor below.
const refreshClient = axios.create({ baseURL: API_URL, withCredentials: true });

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

let refreshPromise: Promise<string | null> | null = null;

/** Exchanges the httpOnly refresh cookie for a new in-memory access token (deduplicated across
 * concurrent callers). Returns null when there is no live session. */
export async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = refreshClient
      .post<{ data: { accessToken: string } }>("/auth/refresh-token")
      .then((res) => res.data.data.accessToken)
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorResponse>) => {
    const originalRequest = error.config as RetriableConfig | undefined;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      const newToken = await refreshAccessToken();

      if (newToken) {
        useAuthStore.getState().setAccessToken(newToken);
        originalRequest.headers.set("Authorization", `Bearer ${newToken}`);
        return apiClient(originalRequest);
      }

      useAuthStore.getState().clearAuth();
      if (typeof window !== "undefined") {
        // Outside the React tree here (axios interceptor) — no router instance available.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

interface ZodLikeIssue {
  path?: (string | number)[];
  message?: string;
}

function firstIssueDetail(errors: unknown[]): string | null {
  const first = errors[0] as ZodLikeIssue | undefined;
  if (!first?.message) return null;
  const field = first.path?.join(".");
  return field ? `${field}: ${first.message}` : first.message;
}

export function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiErrorResponse | undefined;
    if (data?.errors?.length) {
      const detail = firstIssueDetail(data.errors);
      if (detail) return detail;
    }
    return data?.message ?? error.message ?? "Something went wrong";
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong";
}
