/**
 * Pipeline Diagram Component
 * DAG visualization of AI safety flow
 */

"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/api/config";
import { useOrganization } from "@/context/OrganizationContext";

interface PipelineNode {
  id: string;
  label: string;
  type: string;
  status: string;
  metadata?: any;
}

interface PipelineEdge {
  source: string;
  target: string;
  label?: string;
}

interface PipelineDiagram {
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  failsafe_active?: boolean;
  failsafe_reason?: string | null;
  failsafe_triggered_at?: string | null;
}

export default function PipelineDiagram() {
  const { currentOrganization, isLoading: orgLoading } = useOrganization();
  const [diagram, setDiagram] = useState<PipelineDiagram | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<PipelineNode | null>(null);

  useEffect(() => {
    // Don't fetch if organization is still loading or not available
    if (orgLoading || !currentOrganization?.id) {
      return;
    }

    const fetchDiagram = async () => {
      try {
        const token = localStorage.getItem('eza_token');
        
        if (!token) {
          console.error('[Pipeline] No token found');
          setLoading(false);
          return;
        }
        
        const res = await fetch(`${API_BASE_URL}/api/proxy/pipeline/diagram`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'x-org-id': currentOrganization.id, // Use organization ID from context
          },
        });

        if (!res.ok) {
          if (res.status === 403) {
            console.warn('[Pipeline] Access denied - missing or invalid organization context');
          }
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();
        setDiagram(data);
      } catch (error) {
        console.error('[Pipeline] Fetch error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDiagram();
    const interval = setInterval(fetchDiagram, 5000); // Refresh every 5s
    return () => clearInterval(interval);
  }, [currentOrganization?.id, orgLoading]);

  const getNodeColor = (status: string) => {
    switch (status) {
      case 'active': return '#22BF55';
      case 'warning': return '#FF9500';
      case 'error': return '#E84343';
      default: return '#8E8E93';
    }
  };

  const getNodeDescription = (node: PipelineNode): string => {
    switch (node.type) {
      case 'input':
        return 'Kullanıcı tarafından girilen içerik bu aşamada alınır ve işleme hazırlanır.';
      case 'llm':
        return 'Büyük Dil Modeli (LLM) sağlayıcısı içeriği analiz eder ve risk değerlendirmesi yapar.';
      case 'engine':
        return 'EZA Risk Engine, LLM çıktılarını işleyerek detaylı risk skorları ve ihlal tespitleri üretir.';
      case 'policy':
        return 'Tanımlı politika setleri (TRT, FINTECH, HEALTH) uygulanarak içerik uyumluluğu kontrol edilir.';
      case 'output':
        return 'İşlenmiş ve güvenli hale getirilmiş içerik kullanıcıya sunulur.';
      default:
        return 'Bu aşama içeriğin işlenmesinde kritik bir rol oynar.';
    }
  };

  const formatMetadata = (metadata: any): string => {
    if (!metadata || Object.keys(metadata).length === 0) {
      return 'Ek bilgi yok';
    }
    
    if (Array.isArray(metadata.policies)) {
      return `Aktif Politikalar: ${metadata.policies.join(', ')}`;
    }
    
    if (metadata.provider) {
      return `Sağlayıcı: ${metadata.provider}`;
    }
    
    if (metadata.version) {
      return `Versiyon: ${metadata.version}`;
    }
    
    if (metadata.type) {
      return `Tip: ${metadata.type}`;
    }
    
    return JSON.stringify(metadata, null, 2);
  };

  // Show loading if organization is loading or diagram is loading
  if (orgLoading || loading || !diagram) {
    return (
      <div className="text-center py-8">
        <p className="text-sm" style={{ color: '#8E8E93' }}>
          {orgLoading ? 'Organizasyon yükleniyor...' : 'Yükleniyor...'}
        </p>
      </div>
    );
  }

  // Show message if no organization is selected
  if (!currentOrganization?.id) {
    return (
      <div className="text-center py-8">
        <p className="text-sm" style={{ color: '#8E8E93' }}>
          Lütfen bir organizasyon seçin
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Simple DAG Visualization */}
      <div
        className="rounded-xl p-6"
        style={{
          backgroundColor: '#1C1C1E',
          border: '1px solid #2C2C2E',
        }}
      >
        <h3 className="text-lg font-semibold mb-6" style={{ color: '#E5E5EA' }}>
          AI Güvenlik Akışı
        </h3>
        
        <div className="space-y-4">
          {diagram.nodes.map((node, idx) => (
            <div key={node.id} className="flex items-center gap-4">
              {/* Node - Clickable */}
              <div
                className="px-4 py-3 rounded-lg font-medium cursor-pointer transition-all hover:scale-105"
                style={{
                  backgroundColor: '#000000',
                  border: `2px solid ${getNodeColor(node.status)}`,
                  color: '#E5E5EA',
                  minWidth: '150px',
                  boxShadow: selectedNode?.id === node.id ? `0 0 10px ${getNodeColor(node.status)}40` : 'none',
                }}
                onClick={() => setSelectedNode(selectedNode?.id === node.id ? null : node)}
                title="Detaylar için tıklayın"
              >
                {node.label}
              </div>
              
              {/* Arrow - Visual indicator only */}
              {idx < diagram.nodes.length - 1 && (
                <div className="flex-1 flex items-center" title="Veri akış yönü">
                  <div className="flex-1 h-0.5" style={{ backgroundColor: '#2C2C2E' }} />
                  <div
                    className="w-0 h-0 border-t-4 border-b-4 border-l-8"
                    style={{
                      borderTopColor: 'transparent',
                      borderBottomColor: 'transparent',
                      borderLeftColor: '#8E8E93',
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
        
        {/* Node Details Modal */}
        {selectedNode && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setSelectedNode(null)}
          >
            <div
              className="rounded-xl p-6 max-w-md w-full mx-4"
              style={{
                backgroundColor: '#1C1C1E',
                border: `2px solid ${getNodeColor(selectedNode.status)}`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-bold" style={{ color: '#E5E5EA' }}>
                  {selectedNode.label}
                </h4>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="text-2xl leading-none"
                  style={{ color: '#8E8E93' }}
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-3">
                <div>
                  <p className="text-xs mb-1" style={{ color: '#8E8E93' }}>Durum</p>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: getNodeColor(selectedNode.status) }}
                    />
                    <span className="text-sm capitalize" style={{ color: '#E5E5EA' }}>
                      {selectedNode.status === 'active' ? 'Aktif' : 
                       selectedNode.status === 'warning' ? 'Uyarı' : 
                       selectedNode.status === 'error' ? 'Hata' : 'Bilinmiyor'}
                    </span>
                  </div>
                </div>
                
                <div>
                  <p className="text-xs mb-1" style={{ color: '#8E8E93' }}>Açıklama</p>
                  <p className="text-sm" style={{ color: '#E5E5EA' }}>
                    {getNodeDescription(selectedNode)}
                  </p>
                </div>
                
                {selectedNode.metadata && Object.keys(selectedNode.metadata).length > 0 && (
                  <div>
                    <p className="text-xs mb-1" style={{ color: '#8E8E93' }}>Detaylar</p>
                    <p className="text-sm" style={{ color: '#E5E5EA' }}>
                      {formatMetadata(selectedNode.metadata)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fail-Safe Alert - Only show if active */}
      {diagram.failsafe_active && (
        <div
          className="rounded-xl p-4 animate-pulse"
          style={{
            backgroundColor: '#E8434320',
            border: '2px solid #E84343',
          }}
        >
          <p className="text-sm font-semibold mb-2" style={{ color: '#E84343' }}>
            ⚠️ Fail-Safe Durumu Aktif
          </p>
          {diagram.failsafe_reason && (
            <p className="text-xs mb-1" style={{ color: '#E84343' }}>
              <strong>Sebep:</strong> {diagram.failsafe_reason}
            </p>
          )}
          {diagram.failsafe_triggered_at && (
            <p className="text-xs" style={{ color: '#8E8E93' }}>
              <strong>Tetiklenme:</strong> {new Date(diagram.failsafe_triggered_at).toLocaleString('tr-TR')}
            </p>
          )}
          <p className="text-xs mt-2" style={{ color: '#8E8E93' }}>
            Sistem güvenlik modunda çalışıyor. Yüksek riskli içerik tespit edildi.
          </p>
        </div>
      )}
    </div>
  );
}

