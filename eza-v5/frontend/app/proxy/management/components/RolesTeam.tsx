/**
 * Roles & Team Component
 * Invite users, assign roles
 */

"use client";

import { useState, useEffect } from "react";
import { API_BASE_URL } from "@/api/config";

interface TeamMember {
  id: string;
  email: string;
  role: 'admin' | 'reviewer' | 'auditor' | 'readonly';
  invited_at: string;
  status?: 'active' | 'invited' | 'suspended';
}

interface RolesTeamProps {
  orgId: string | null;
}

const ROLE_LABELS = {
  admin: 'Yönetici',
  reviewer: 'İnceleyici',
  auditor: 'Denetçi',
  readonly: 'Salt Okunur',
};

const ROLE_COLORS = {
  admin: '#E84343',
  reviewer: '#007AFF',
  auditor: '#FF9500',
  readonly: '#8E8E93',
};

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: 'invited' | 'accepted' | 'expired';
  created_at: string;
  expires_at: string;
}

export default function RolesTeam({ orgId }: RolesTeamProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<'admin' | 'reviewer' | 'auditor' | 'readonly'>('readonly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (orgId) {
      loadUsers();
    }
  }, [orgId]);

  const loadUsers = async () => {
    if (!orgId) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('eza_token');
      const apiKey = localStorage.getItem('proxy_api_key');
      
      const res = await fetch(`${API_BASE_URL}/api/platform/organizations/${orgId}/users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Api-Key': apiKey || '',
          'x-org-id': orgId, // Required by organization guard middleware
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: 'Unknown error' }));
        const errorMessage = errorData.detail || errorData.message || `HTTP ${res.status}: ${res.statusText}`;
        setError(`Kullanıcılar yüklenemedi: ${errorMessage}`);
        return;
      }

      const data = await res.json();
      if (data.ok) {
        // Map active users
        const mappedMembers: TeamMember[] = (data.users || []).map((user: any) => ({
          id: user.id,
          email: user.email,
          role: mapBackendRoleToFrontend(user.role),
          invited_at: user.joined_at || new Date().toISOString(),
          status: 'active', // Always active for OrganizationUser
        }));
        setMembers(mappedMembers);
        
        // Map pending invitations
        const mappedInvitations: Invitation[] = (data.invitations || []).map((inv: any) => ({
          id: inv.id,
          email: inv.email,
          role: inv.role,
          status: inv.status,
          created_at: inv.created_at,
          expires_at: inv.expires_at,
        }));
        setInvitations(mappedInvitations);
      } else {
        setMembers([]);
        setInvitations([]);
      }
    } catch (err: any) {
      setError(`Kullanıcılar yüklenemedi: ${err?.message || 'Ağ hatası'}`);
    } finally {
      setLoading(false);
    }
  };

  const mapBackendRoleToFrontend = (backendRole: string): 'admin' | 'reviewer' | 'auditor' | 'readonly' => {
    // Map backend roles (org_admin, user, ops) to frontend roles
    if (backendRole === 'org_admin' || backendRole === 'admin') return 'admin';
    if (backendRole === 'ops') return 'reviewer';
    if (backendRole === 'auditor') return 'auditor';
    return 'readonly';
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !orgId) return;

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('eza_token');
      const apiKey = localStorage.getItem('proxy_api_key');
      
      // Map frontend role to backend role
      const backendRole = mapFrontendRoleToBackend(inviteRole);
      
      const res = await fetch(`${API_BASE_URL}/api/platform/organizations/${orgId}/users/invite`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Api-Key': apiKey || '',
          'x-org-id': orgId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: inviteEmail.trim().toLowerCase(),
          role: backendRole,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: 'Bilinmeyen hata' }));
        const errorMessage = errorData.detail || errorData.message || `HTTP ${res.status}: ${res.statusText}`;
        setError(`Davet gönderilemedi: ${errorMessage}`);
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (data.ok) {
        // Reload users list
        await loadUsers();
        setInviteEmail("");
        setError(null);
      } else {
        setError(`Davet gönderilemedi: ${data.message || 'Bilinmeyen hata'}`);
      }
    } catch (err: any) {
      setError(`Davet gönderilemedi: ${err?.message || 'Ağ hatası'}`);
    } finally {
      setLoading(false);
    }
  };

  const mapFrontendRoleToBackend = (frontendRole: 'admin' | 'reviewer' | 'auditor' | 'readonly'): string => {
    // Map frontend roles to backend roles
    if (frontendRole === 'admin') return 'org_admin';
    if (frontendRole === 'reviewer') return 'ops';
    if (frontendRole === 'auditor') return 'auditor';
    return 'user'; // readonly -> user
  };

  return (
    <div className="space-y-6">
      {/* Invite User */}
      <div
        className="rounded-xl p-6"
        style={{
          backgroundColor: '#1C1C1E',
          border: '1px solid #2C2C2E',
        }}
      >
        <h2 className="text-xl font-bold mb-4" style={{ color: '#E5E5EA' }}>
          Kullanıcı Davet Et
        </h2>

        <form onSubmit={handleInvite} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="E-posta adresi..."
              disabled={loading}
              className="px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
              style={{
                backgroundColor: '#000000',
                border: '1px solid #2C2C2E',
                color: '#E5E5EA',
              }}
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as any)}
              className="px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
              style={{
                backgroundColor: '#000000',
                border: '1px solid #2C2C2E',
                color: '#E5E5EA',
              }}
            >
              <option value="readonly">Salt Okunur</option>
              <option value="auditor">Denetçi</option>
              <option value="reviewer">İnceleyici</option>
              <option value="admin">Yönetici</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={loading || !inviteEmail.trim()}
            className="px-6 py-3 rounded-xl font-medium transition-opacity disabled:opacity-50"
            style={{
              backgroundColor: '#007AFF',
              color: '#FFFFFF',
            }}
          >
            {loading ? 'Davet ediliyor...' : 'Davet Et'}
          </button>
        </form>
      </div>

      {/* Team Members */}
      <div
        className="rounded-xl p-6"
        style={{
          backgroundColor: '#1C1C1E',
          border: '1px solid #2C2C2E',
        }}
      >
        <h2 className="text-xl font-bold mb-4" style={{ color: '#E5E5EA' }}>
          Ekip Üyeleri ({members.length + invitations.length})
        </h2>

        {loading ? (
          <p className="text-sm" style={{ color: '#8E8E93' }}>Yükleniyor...</p>
        ) : members.length === 0 && invitations.length === 0 ? (
          <p className="text-sm" style={{ color: '#8E8E93' }}>Henüz ekip üyesi yok</p>
        ) : (
          <div className="space-y-3">
            {/* Active Users */}
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-4 rounded-lg"
                style={{
                  backgroundColor: '#000000',
                  border: '1px solid #2C2C2E',
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-semibold"
                    style={{
                      backgroundColor: member.status === 'invited' 
                        ? '#E8434320' 
                        : member.status === 'active'
                        ? '#34C75920'
                        : `${ROLE_COLORS[member.role]}20`,
                      color: member.status === 'invited'
                        ? '#E84343'
                        : member.status === 'active'
                        ? '#34C759'
                        : ROLE_COLORS[member.role],
                    }}
                  >
                    {member.email[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium" style={{ color: '#E5E5EA' }}>
                      {member.email}
                    </div>
                    <div className="text-xs" style={{ color: '#8E8E93' }}>
                      {member.status === 'invited' 
                        ? `Davet: ${new Date(member.invited_at).toLocaleString('tr-TR')}`
                        : `Katılım: ${new Date(member.invited_at).toLocaleString('tr-TR')}`
                      }
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {member.status === 'invited' && (
                    <span
                      className="px-2 py-1 rounded text-xs font-medium"
                      style={{
                        backgroundColor: '#E8434320',
                        color: '#E84343',
                      }}
                    >
                      Davet Bekliyor
                    </span>
                  )}
                  {member.status === 'active' && (
                    <span
                      className="px-2 py-1 rounded text-xs font-medium"
                      style={{
                        backgroundColor: '#34C75920',
                        color: '#34C759',
                      }}
                    >
                      Aktif
                    </span>
                  )}
                  <span
                    className="px-3 py-1 rounded text-sm font-medium"
                    style={{
                      backgroundColor: `${ROLE_COLORS[member.role]}20`,
                      color: ROLE_COLORS[member.role],
                    }}
                  >
                    {ROLE_LABELS[member.role]}
                  </span>
                </div>
              </div>
            ))}
            
            {/* Pending Invitations */}
            {invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex items-center justify-between p-4 rounded-lg"
                style={{
                  backgroundColor: '#000000',
                  border: '1px solid #2C2C2E',
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-semibold"
                    style={{
                      backgroundColor: '#E8434320',
                      color: '#E84343',
                    }}
                  >
                    {invitation.email[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium" style={{ color: '#E5E5EA' }}>
                      {invitation.email}
                    </div>
                    <div className="text-xs" style={{ color: '#8E8E93' }}>
                      Davet: {new Date(invitation.created_at).toLocaleString('tr-TR')}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="px-2 py-1 rounded text-xs font-medium"
                    style={{
                      backgroundColor: '#E8434320',
                      color: '#E84343',
                    }}
                  >
                    Davet Bekliyor
                  </span>
                  <span
                    className="px-3 py-1 rounded text-sm font-medium"
                    style={{
                      backgroundColor: `${ROLE_COLORS[mapBackendRoleToFrontend(invitation.role)]}20`,
                      color: ROLE_COLORS[mapBackendRoleToFrontend(invitation.role)],
                    }}
                  >
                    {ROLE_LABELS[mapBackendRoleToFrontend(invitation.role)]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div
          className="rounded-xl p-4"
          style={{
            backgroundColor: '#E8434320',
            border: '1px solid #E84343',
          }}
        >
          <p className="text-sm" style={{ color: '#E84343' }}>{error}</p>
        </div>
      )}
    </div>
  );
}

