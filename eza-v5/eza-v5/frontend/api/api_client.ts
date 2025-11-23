/**
 * API Client - Centralized request handler
 */

import { API_BASE_URL } from "./config";
import { getToken } from "@/lib/auth";

export interface ApiError {
  detail?: string;
  message?: string;
  error?: string;
}

export async function apiRequest<T = any>(
  path: string,
  method: string = "GET",
  body: any = null
): Promise<T> {
  try {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    // Add auth token if available
    const token = getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
    });

    // Handle 401 - redirect to login
    if (response.status === 401) {
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      throw new Error("Unauthorized");
    }

    if (!response.ok) {
      let error: ApiError = {};
      try {
        error = await response.json();
      } catch {
        // If response is not JSON, use status text
        error = { detail: response.statusText || "API Error" };
      }
      throw new Error(error.detail || error.message || error.error || "API Error");
    }

    // Handle empty responses
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      return {} as T;
    }

    return await response.json();
  } catch (err) {
    // Silent error handling - errors are handled by SWR with fallback data
    if (err instanceof Error) {
      throw err;
    }
    throw new Error("Network error occurred");
  }
}

