/**
 * Organizations Management Page
 * List, create, edit, suspend organizations
 */

'use client';

import { useState, useEffect } from 'react';
import { useOrganization, Organization } from '@/context/OrganizationContext';
import RequireAuth from '@/components/auth/RequireAuth';
import { useAuth } from '@/context/AuthContext';
import { getApiUrl } from '@/lib/apiUrl';

function OrganizationsPageContent() {
  const { role } = useAuth();
  const {
    organizations,
    currentOrganization,
    setCurrentOrganization,
    loadOrganizations,
    createOrganization,
    updateOrganization,
    suspendOrganization,
    isLoading,
  } = useOrganization();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [formData, setFormData] = useState<Partial<Organization>>({
    name: '',
    plan: 'free',
    base_currency: 'TRY',
    proxy_access: true,
    status: 'active',
  });

  // Only org_admin and admin can access
  if (role !== 'org_admin' && role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--platform-bg-primary)' }}>
        <div className="text-center p-8">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold mb-4" style={{ color: 'var(--platform-text-primary)' }}>
            Erişim Reddedildi
          </h1>
          <p className="text-sm mb-6" style={{ color: 'var(--platform-text-secondary)' }}>
            Bu sayfaya erişim izniniz yok.
          </p>
        </div>
      </div>
    );
  }

  const handleCreate = async () => {
    const newOrg = await createOrganization(formData);
    if (newOrg) {
      setShowCreateModal(false);
      setFormData({
        name: '',
        plan: 'free',
        base_currency: 'TRY',
        proxy_access: true,
        status: 'active',
      });
    }
  };

  const handleEdit = (org: Organization) => {
    setEditingOrg(org);
    setFormData({
      name: org.name,
      plan: org.plan,
      base_currency: org.base_currency,
      proxy_access: org.proxy_access,
      status: org.status,
      sla_tier: org.sla_tier,
      default_policy_set: org.default_policy_set,
    });
    setShowEditModal(true);
  };

  const handleUpdate = async () => {
    if (editingOrg) {
      const success = await updateOrganization(editingOrg.id, formData);
      if (success) {
        setShowEditModal(false);
        setEditingOrg(null);
      }
    }
  };

  const handleSuspend = async (orgId: string) => {
    if (confirm('Bu organizasyonu askıya almak istediğinizden emin misiniz?')) {
      await suspendOrganization(orgId);
    }
  };

  const handleSwitch = (org: Organization) => {
    setCurrentOrganization(org);
    // Reload page to refresh all components
    window.location.reload();
  };

  const getPlanLabel = (plan: string) => {
    const labels: Record<string, string> = {
      free: 'Free',
      pro: 'Pro',
      enterprise: 'Enterprise',
    };
    return labels[plan] || plan;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      active: 'Aktif',
      suspended: 'Askıya Alındı',
    };
    return labels[status] || status;
  };

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: 'var(--platform-bg-primary)',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div className="border-b pb-6" style={{ borderColor: 'var(--platform-border)' }}>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2" style={{ color: 'var(--platform-text-primary)', fontWeight: 600 }}>
                Organizations
              </h1>
              <p className="text-sm" style={{ color: 'var(--platform-text-muted)' }}>
                Multi-tenant organization management
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-90"
              style={{
                backgroundColor: 'var(--platform-action-primary)',
                color: 'white',
              }}
            >
              ➕ Create Organization
            </button>
          </div>
        </div>

        {/* Organization List */}
        {isLoading ? (
          <div className="text-center py-12">
            <p style={{ color: 'var(--platform-text-secondary)' }}>Loading organizations...</p>
          </div>
        ) : organizations.length === 0 ? (
          <div className="text-center py-12">
            <p style={{ color: 'var(--platform-text-secondary)' }}>No organizations found.</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-90"
              style={{
                backgroundColor: 'var(--platform-action-primary)',
                color: 'white',
              }}
            >
              Create First Organization
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {organizations.map((org) => (
              <div
                key={org.id}
                className="rounded-xl p-6 transition-colors"
                style={{
                  backgroundColor: currentOrganization?.id === org.id ? 'var(--platform-surface-hover)' : 'var(--platform-surface)',
                  border: `1px solid ${currentOrganization?.id === org.id ? 'var(--platform-action-primary)' : 'var(--platform-border)'}`,
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-2">
                      <h3 className="text-xl font-bold" style={{ color: 'var(--platform-text-primary)' }}>
                        {org.name}
                      </h3>
                      {currentOrganization?.id === org.id && (
                        <span
                          className="px-2 py-1 rounded text-xs font-medium"
                          style={{
                            backgroundColor: 'var(--platform-action-primary)20',
                            color: 'var(--platform-action-primary)',
                          }}
                        >
                          Active
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
                      <div>
                        <p className="text-xs mb-1" style={{ color: 'var(--platform-text-muted)' }}>
                          Plan
                        </p>
                        <p className="text-sm font-medium" style={{ color: 'var(--platform-text-primary)' }}>
                          {getPlanLabel(org.plan)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs mb-1" style={{ color: 'var(--platform-text-muted)' }}>
                          Status
                        </p>
                        <p className="text-sm font-medium" style={{ color: 'var(--platform-text-primary)' }}>
                          {getStatusLabel(org.status)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs mb-1" style={{ color: 'var(--platform-text-muted)' }}>
                          Proxy Access
                        </p>
                        <p className="text-sm font-medium" style={{ color: 'var(--platform-text-primary)' }}>
                          {org.proxy_access ? 'Enabled' : 'Disabled'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs mb-1" style={{ color: 'var(--platform-text-muted)' }}>
                          Currency
                        </p>
                        <p className="text-sm font-medium" style={{ color: 'var(--platform-text-primary)' }}>
                          {org.base_currency}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs mb-1" style={{ color: 'var(--platform-text-muted)' }}>
                          Created
                        </p>
                        <p className="text-sm font-medium" style={{ color: 'var(--platform-text-primary)' }}>
                          {new Date(org.created_at).toLocaleDateString('tr-TR')}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {currentOrganization?.id !== org.id && (
                      <button
                        onClick={() => handleSwitch(org)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:opacity-90"
                        style={{
                          backgroundColor: 'var(--platform-action-primary)',
                          color: 'white',
                        }}
                      >
                        🔁 Switch
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(org)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:opacity-90"
                      style={{
                        backgroundColor: 'var(--platform-surface-hover)',
                        color: 'var(--platform-text-primary)',
                        border: '1px solid var(--platform-border)',
                      }}
                    >
                      ✏️ Edit
                    </button>
                    {org.status === 'active' && (
                      <button
                        onClick={() => handleSuspend(org.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:opacity-90"
                        style={{
                          backgroundColor: 'var(--platform-danger-bg)',
                          color: 'var(--platform-danger-text)',
                        }}
                      >
                        🗑 Suspend
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div
              className="rounded-xl p-6 max-w-md w-full mx-4"
              style={{
                backgroundColor: 'var(--platform-surface)',
                border: '1px solid var(--platform-border)',
              }}
            >
              <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--platform-text-primary)' }}>
                Create Organization
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm mb-2" style={{ color: 'var(--platform-text-secondary)' }}>
                    Organization Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg"
                    style={{
                      backgroundColor: 'var(--platform-bg-secondary)',
                      border: '1px solid var(--platform-border)',
                      color: 'var(--platform-text-primary)',
                    }}
                    placeholder="Enter organization name"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-2" style={{ color: 'var(--platform-text-secondary)' }}>
                    Default Plan
                  </label>
                  <select
                    value={formData.plan}
                    onChange={(e) => setFormData({ ...formData, plan: e.target.value as any })}
                    className="w-full px-4 py-2 rounded-lg"
                    style={{
                      backgroundColor: 'var(--platform-bg-secondary)',
                      border: '1px solid var(--platform-border)',
                      color: 'var(--platform-text-primary)',
                    }}
                  >
                    <option value="free">Free</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-2" style={{ color: 'var(--platform-text-secondary)' }}>
                    Base Currency
                  </label>
                  <select
                    value={formData.base_currency}
                    onChange={(e) => setFormData({ ...formData, base_currency: e.target.value as any })}
                    className="w-full px-4 py-2 rounded-lg"
                    style={{
                      backgroundColor: 'var(--platform-bg-secondary)',
                      border: '1px solid var(--platform-border)',
                      color: 'var(--platform-text-primary)',
                    }}
                  >
                    <option value="TRY">TRY</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="proxy_access"
                    checked={formData.proxy_access}
                    onChange={(e) => setFormData({ ...formData, proxy_access: e.target.checked })}
                    className="w-4 h-4"
                    style={{ accentColor: 'var(--platform-action-primary)' }}
                  />
                  <label htmlFor="proxy_access" className="text-sm" style={{ color: 'var(--platform-text-secondary)' }}>
                    Proxy Access Enabled
                  </label>
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button
                  onClick={handleCreate}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-90"
                  style={{
                    backgroundColor: 'var(--platform-action-primary)',
                    color: 'white',
                  }}
                >
                  Create
                </button>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-90"
                  style={{
                    backgroundColor: 'var(--platform-surface-hover)',
                    color: 'var(--platform-text-primary)',
                    border: '1px solid var(--platform-border)',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && editingOrg && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div
              className="rounded-xl p-6 max-w-md w-full mx-4"
              style={{
                backgroundColor: 'var(--platform-surface)',
                border: '1px solid var(--platform-border)',
              }}
            >
              <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--platform-text-primary)' }}>
                Edit Organization
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm mb-2" style={{ color: 'var(--platform-text-secondary)' }}>
                    Organization Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg"
                    style={{
                      backgroundColor: 'var(--platform-bg-secondary)',
                      border: '1px solid var(--platform-border)',
                      color: 'var(--platform-text-primary)',
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-2" style={{ color: 'var(--platform-text-secondary)' }}>
                    Plan
                  </label>
                  <select
                    value={formData.plan}
                    onChange={(e) => setFormData({ ...formData, plan: e.target.value as any })}
                    className="w-full px-4 py-2 rounded-lg"
                    style={{
                      backgroundColor: 'var(--platform-bg-secondary)',
                      border: '1px solid var(--platform-border)',
                      color: 'var(--platform-text-primary)',
                    }}
                  >
                    <option value="free">Free</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-2" style={{ color: 'var(--platform-text-secondary)' }}>
                    Base Currency
                  </label>
                  <select
                    value={formData.base_currency}
                    onChange={(e) => setFormData({ ...formData, base_currency: e.target.value as any })}
                    className="w-full px-4 py-2 rounded-lg"
                    style={{
                      backgroundColor: 'var(--platform-bg-secondary)',
                      border: '1px solid var(--platform-border)',
                      color: 'var(--platform-text-primary)',
                    }}
                  >
                    <option value="TRY">TRY</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="edit_proxy_access"
                    checked={formData.proxy_access}
                    onChange={(e) => setFormData({ ...formData, proxy_access: e.target.checked })}
                    className="w-4 h-4"
                    style={{ accentColor: 'var(--platform-action-primary)' }}
                  />
                  <label htmlFor="edit_proxy_access" className="text-sm" style={{ color: 'var(--platform-text-secondary)' }}>
                    Proxy Access Enabled
                  </label>
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button
                  onClick={handleUpdate}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-90"
                  style={{
                    backgroundColor: 'var(--platform-action-primary)',
                    color: 'white',
                  }}
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingOrg(null);
                  }}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-90"
                  style={{
                    backgroundColor: 'var(--platform-surface-hover)',
                    color: 'var(--platform-text-primary)',
                    border: '1px solid var(--platform-border)',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OrganizationsPage() {
  return (
    <RequireAuth allowedRoles={['admin', 'org_admin']}>
      <OrganizationsPageContent />
    </RequireAuth>
  );
}

