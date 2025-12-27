/**
 * Observational Alerts - Health
 * 
 * Early warning for clinical risks.
 * Alerts are informational, non-punitive, logged only.
 */

'use client';

import { useEffect, useState } from 'react';
import { HealthLayout } from '@/components/HealthLayout';
import { apiClient, HealthAlertsResponse } from '@/lib/api-client';
import { useHealthAuth } from '@/lib/auth-guard';

export default function AlertsPage() {
  const { isAuthorized, loading } = useHealthAuth();
  const [alerts, setAlerts] = useState<HealthAlertsResponse | null>(null);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthorized || loading) return;

    const fetchAlerts = async () => {
      try {
        setLoadingAlerts(true);
        const response = await apiClient.get<HealthAlertsResponse>('/api/proxy/health/alerts');
        
        if (response.ok) {
          setAlerts(response);
        }
      } catch (err) {
        console.error('Error fetching alerts:', err);
        setError(err instanceof Error ? err.message : 'Uyarılar yüklenirken hata oluştu');
      } finally {
        setLoadingAlerts(false);
      }
    };

    fetchAlerts();
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchAlerts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isAuthorized, loading]);

  if (loading || !isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <HealthLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900" translate="no">
          Gözlemsel Uyarılar
        </h1>

        {/* Info Banner */}
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
          <p className="text-sm text-blue-900">
            <strong>Bilgilendirme:</strong> Bu uyarılar yalnızca gözlem amaçlıdır.
            Uyarılar bilgilendirici, cezai olmayan, yalnızca kayıt altına alınmış durumdadır.
            Hasta güvenliği ve klinik AI davranışı için erken uyarı sağlar.
          </p>
        </div>

        {loadingAlerts ? (
          <div className="text-center py-12">
            <div className="text-lg">Uyarılar yükleniyor...</div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded p-4">
            <p className="text-red-800">Hata: {error}</p>
          </div>
        ) : alerts && alerts.alerts.length > 0 ? (
          <div className="space-y-4">
            {alerts.alerts.map((alert, idx) => {
              const severityColor = 
                alert.severity === 'High' ? 'border-red-500 bg-red-50' :
                alert.severity === 'Medium' ? 'border-yellow-500 bg-yellow-50' :
                'border-blue-500 bg-blue-50';
              
              const severityTextColor = 
                alert.severity === 'High' ? 'text-red-900' :
                alert.severity === 'Medium' ? 'text-yellow-900' :
                'text-blue-900';
              
              return (
                <div key={idx} className={`border-l-4 rounded p-4 ${severityColor}`}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          alert.severity === 'High' ? 'bg-red-200 text-red-800' :
                          alert.severity === 'Medium' ? 'bg-yellow-200 text-yellow-800' :
                          'bg-blue-200 text-blue-800'
                        }`}>
                          {alert.severity}
                        </span>
                        <span className="font-semibold text-gray-900">{alert.type}</span>
                      </div>
                      <p className={`text-sm ${severityTextColor}`}>
                        {alert.description}
                      </p>
                      {alert.fail_safe_count !== undefined && (
                        <p className="text-xs text-gray-600 mt-2">
                          Fail-safe sayısı: {alert.fail_safe_count} (%{alert.fail_safe_rate} oran)
                        </p>
                      )}
                      {alert.high_risk_count !== undefined && (
                        <p className="text-xs text-gray-600 mt-2">
                          Yüksek risk olay sayısı: {alert.high_risk_count} (%{alert.high_risk_rate} oran)
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-2">
                        {new Date(alert.timestamp).toLocaleString('tr-TR')}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-gray-500">Şu anda aktif klinik uyarı bulunmamaktadır.</p>
          </div>
        )}
      </div>
    </HealthLayout>
  );
}

