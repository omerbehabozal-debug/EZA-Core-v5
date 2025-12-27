/**
 * Alerts Page
 * 
 * Observational alerts only - NO action buttons.
 * Alerts are derived from audit log patterns (frontend-only).
 */

'use client';

import { useEffect, useState } from 'react';
import { RegulatorLayout } from '@/components/RegulatorLayout';
import { InfoTooltip } from '@/components/InfoTooltip';
import { apiClient, AuditLogEntry } from '@/lib/api-client';
import { maskOrganizationId } from '@/lib/organization-mask';
import { useRegulatorAuth } from '@/lib/auth-guard';

interface Alert {
  id: string;
  timestamp: string;
  organizationId: string;
  policySet: string;
  riskLevel: 'high' | 'medium' | 'low';
  flagType: string;
  threshold: string;
}

export default function AlertsPage() {
  const { isAuthorized, loading } = useRegulatorAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(true);

  useEffect(() => {
    if (!isAuthorized || loading) return;

    const fetchAlerts = async () => {
      try {
        setLoadingAlerts(true);
        
        // Get recent audit logs (last 24 hours)
        const toDate = new Date().toISOString();
        const fromDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const response = await apiClient.get<{
          ok: boolean;
          count: number;
          results: AuditLogEntry[];
        }>(`/api/proxy/audit/search?from_date=${fromDate}&to_date=${toDate}`);

        if (!response.ok) {
          throw new Error('Failed to fetch audit logs');
        }

        // Derive alerts from patterns (frontend-only)
        const logs = response.results || [];
        const derivedAlerts: Alert[] = [];

        // Pattern 1: High risk threshold (ethical score < 30)
        logs.forEach((log) => {
          const score = log.risk_scores?.ethical_index || 50;
          if (score < 30) {
            derivedAlerts.push({
              id: `high-risk-${log.id}`,
              timestamp: log.created_at,
              organizationId: log.organization_id,
              policySet: log.sector || 'Unknown',
              riskLevel: 'high',
              flagType: 'High Risk Score',
              threshold: `Ethical score: ${score} (threshold: < 30)`,
            });
          }
        });

        // Pattern 2: Multiple flags
        logs.forEach((log) => {
          const flags = log.flags
            ? Array.isArray(log.flags)
              ? log.flags
              : log.flags.flags || []
            : [];
          if (flags.length >= 3) {
            derivedAlerts.push({
              id: `multiple-flags-${log.id}`,
              timestamp: log.created_at,
              organizationId: log.organization_id,
              policySet: log.sector || 'Unknown',
              riskLevel: 'medium',
              flagType: 'Multiple Flags',
              threshold: `${flags.length} flags detected`,
            });
          }
        });

        // Sort by timestamp (newest first)
        derivedAlerts.sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        setAlerts(derivedAlerts);
      } catch (err) {
        console.error('Error fetching alerts:', err);
      } finally {
        setLoadingAlerts(false);
      }
    };

    fetchAlerts();
  }, [isAuthorized, loading]);

  if (loading || !isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-green-100 text-green-800 border-green-200';
    }
  };

  return (
    <RegulatorLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          Uyarılar
          <InfoTooltip text="Bu uyarılar yalnızca gözlemseldir. Herhangi bir müdahale veya işlem imkânı sunmaz." />
        </h1>

        <div className="bg-blue-50 border border-blue-200 rounded p-4">
          <p className="text-sm text-blue-800">
            <strong>Observational Only:</strong> These alerts are derived from audit log patterns.
            No intervention or action capabilities are provided.
          </p>
        </div>

        {loadingAlerts ? (
          <div className="text-center py-12">
            <div className="text-lg">Loading alerts...</div>
          </div>
        ) : alerts.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-gray-500">No alerts detected in the last 24 hours</p>
          </div>
        ) : (
          <div className="space-y-4">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`bg-white rounded-lg shadow p-4 border-l-4 ${getRiskColor(
                  alert.riskLevel
                )}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded ${getRiskColor(
                          alert.riskLevel
                        )}`}
                      >
                        {alert.riskLevel.toUpperCase()}
                      </span>
                      <span className="text-sm text-gray-500">
                        {new Date(alert.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm">
                        <strong>Organization:</strong>{' '}
                        {maskOrganizationId(alert.organizationId)}
                      </p>
                      <p className="text-sm">
                        <strong>Policy Set:</strong> {alert.policySet}
                      </p>
                      <p className="text-sm">
                        <strong>Flag Type:</strong> {alert.flagType}
                      </p>
                      <p className="text-sm">
                        <strong>Threshold:</strong> {alert.threshold}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </RegulatorLayout>
  );
}

