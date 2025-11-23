/**
 * Proxy API Client
 */

import { apiRequest } from "./api_client";

export interface ProxyEvalRequest {
  message: string;
  model?: string;
  depth?: "fast" | "deep";
}

export interface ProxyEvalResponse {
  ok: boolean;
  mode: string;
  analysis?: any;
  error?: any;
}

export function evaluateProxy(
  message: string,
  model: string = "gpt-4",
  depth: "fast" | "deep" = "fast"
): Promise<ProxyEvalResponse> {
  return apiRequest<ProxyEvalResponse>("/api/proxy/eval", "POST", {
    message,
    model,
    depth,
  });
}

