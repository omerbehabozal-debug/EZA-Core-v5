/**
 * Multi-Tenant Configuration
 */

export type TenantType = 'regulator' | 'platform' | 'corporate';

export interface TenantConfig {
  id: string;
  label: string;
  type: TenantType;
  primaryColor: string; // Tailwind color name (e.g., "red", "blue", "indigo")
  accentColor: string;
  description: string;
  enabledModules: string[];
}

export const TENANTS: Record<string, TenantConfig> = {
  rtuk: {
    id: 'rtuk',
    label: 'RTÜK – Yayın Denetimi',
    type: 'regulator',
    primaryColor: 'red',
    accentColor: 'amber',
    description: 'Televizyon, radyo ve çevrim içi yayınların etik ve içerik denetimi.',
    enabledModules: ['risk_matrix', 'case_table', 'screening_panel', 'reports', 'audit_log'],
  },
  btk: {
    id: 'btk',
    label: 'BTK – İletişim ve Erişim Güvenliği',
    type: 'regulator',
    primaryColor: 'blue',
    accentColor: 'cyan',
    description: 'İletişim altyapısı ve erişim güvenliği denetimi.',
    enabledModules: ['risk_matrix', 'case_table', 'traffic_risk', 'audit_log'],
  },
  eu_ai: {
    id: 'eu_ai',
    label: 'EU AI Office – Yapay Zekâ Uyum',
    type: 'regulator',
    primaryColor: 'indigo',
    accentColor: 'yellow',
    description: 'Avrupa Birliği Yapay Zekâ Yasası uyumluluk değerlendirmesi.',
    enabledModules: ['risk_matrix', 'model_registry', 'case_table', 'reports', 'audit_log'],
  },
  platform: {
    id: 'platform',
    label: 'Platform Portalı',
    type: 'platform',
    primaryColor: 'green',
    accentColor: 'emerald',
    description: 'İçerik platformları ve API entegrasyonları için moderasyon paneli.',
    enabledModules: ['api_keys', 'content_stream', 'trend_heatmap', 'audit_log'],
  },
  corporate: {
    id: 'corporate',
    label: 'Kurumsal Portal',
    type: 'corporate',
    primaryColor: 'purple',
    accentColor: 'violet',
    description: 'Şirket içi AI denetimi ve güvenlik yönetimi.',
    enabledModules: ['ai_audit', 'policy_config', 'workflow_builder', 'audit_log'],
  },
};

export const REGULATOR_TENANTS = ['rtuk', 'btk', 'eu_ai'] as const;

export const defaultTenant: TenantConfig = TENANTS.rtuk;

export function getTenant(id: string): TenantConfig {
  return TENANTS[id] || defaultTenant;
}

export function getTenantsByType(type: TenantType): TenantConfig[] {
  return Object.values(TENANTS).filter(tenant => tenant.type === type);
}

