/**
 * Mock Proxy-Lite Data
 */

import { ProxyLiteAnalyzeResponse } from '@/api/proxy_lite';

export const MOCK_LITE_RESULT: ProxyLiteAnalyzeResponse = {
  risk_level: 'medium',
  risk_category: 'content_moderation',
  violated_rule_count: 2,
  summary: 'İçerik orta seviyede risk içermektedir. Bazı ifadeler gözden geçirilmelidir.',
  recommendation: 'İçeriği yayınlamadan önce hassas bölümleri gözden geçirmeniz önerilir. Özellikle kullanıcı yorumları ve etkileşimler için ek kontroller yapılmalıdır.',
};

