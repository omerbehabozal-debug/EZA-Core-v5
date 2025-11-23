/**
 * Gateway API Client
 */

import { apiRequest } from "./api_client";

export interface GatewayTestRequest {
  prompt: string;
  provider?: string;
  model?: string;
  policy_pack?: string;
}

export interface GatewayTestResponse {
  output: string;
  provider: string;
  policy_result: any;
  analysis?: any;
}

export function testGateway(
  prompt: string,
  provider: string = "openai",
  model?: string,
  policyPack: string = "eu_ai"
): Promise<GatewayTestResponse> {
  return apiRequest<GatewayTestResponse>("/api/gateway/test-call", "POST", {
    prompt,
    provider,
    model,
    policy_pack: policyPack,
  });
}

