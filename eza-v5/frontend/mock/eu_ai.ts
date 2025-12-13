/**
 * Mock EU AI Act Data
 */

export interface EUModel {
  id: number;
  model_name: string;
  version: string;
  risk_profile: Record<string, any> | null;
  provider: string | null;
  compliance_status: string | null;
  created_at: string;
}

export interface EURiskProfile {
  risk_profile: Record<string, any>;
}

export const MOCK_EU_MODELS: EUModel[] = [
  {
    id: 1,
    model_name: 'GPT-4',
    version: '4.0',
    risk_profile: {
      risk_score: 0.45,
      risk_level: 'medium',
      computed_at: {},
    },
    provider: 'OpenAI',
    compliance_status: 'approved',
    created_at: new Date().toISOString(),
  },
  {
    id: 2,
    model_name: 'Claude-3',
    version: '3.0',
    risk_profile: {
      risk_score: 0.35,
      risk_level: 'low',
      computed_at: {},
    },
    provider: 'Anthropic',
    compliance_status: 'pending',
    created_at: new Date().toISOString(),
  },
];

export const MOCK_EU_RISK_PROFILE: EURiskProfile = {
  risk_profile: {
    risk_score: 0.45,
    risk_level: 'medium',
    computed_at: {},
  },
};

