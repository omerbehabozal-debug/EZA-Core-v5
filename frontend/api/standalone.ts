/**
 * Standalone API Client
 */

import { apiRequest } from "./api_client";

export interface StandaloneChatRequest {
  text: string;
}

export interface StandaloneChatResponse {
  answer: string;
  safety: "Safe" | "Warning" | "Blocked";
  confidence: number;
}

export function askStandalone(text: string): Promise<StandaloneChatResponse> {
  return apiRequest<StandaloneChatResponse>(
    "/api/standalone/standalone_chat",
    "POST",
    { text }
  );
}

