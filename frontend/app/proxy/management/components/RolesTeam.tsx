/**
 * Roles & Team Component
 * Invite users, assign roles
 */

"use client";

import { useState } from "react";

interface TeamMember {
  id: string;
  email: string;
  role: 'admin' | 'reviewer' | 'auditor' | 'readonly';
  invited_at: string;
}

interface RolesTeamProps {
  orgId: string | null;
}

const ROLE_LABELS = {
  admin: 'Admin',
  reviewer: 'Reviewer',
  auditor: 'Auditor',
  readonly: 'ReadOnly',
};

const ROLE_COLORS = {
  admin: '#E84343',
  reviewer: '#007AFF',
  auditor: '#FF9500',
  readonly: '#8E8E93',
};

export default function RolesTeam({ orgId }: RolesTeamProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<'admin' | 'reviewer' | 'auditor' | 'readonly'>('readonly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setLoading(true);
    setError(null);

    // TODO: Call API to invite user
    setTimeout(() => {
      setMembers([
        ...members,
        {
          id: Date.now().toString(),
          email: inviteEmail,
          role: inviteRole,
          invited_at: new Date().toISOString(),
        },
      ]);
      setInviteEmail("");
      setLoading(false);
    }, 500);
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
              <option value="readonly">ReadOnly</option>
              <option value="auditor">Auditor</option>
              <option value="reviewer">Reviewer</option>
              <option value="admin">Admin</option>
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
          Ekip Üyeleri ({members.length})
        </h2>

        {members.length === 0 ? (
          <p className="text-sm" style={{ color: '#8E8E93' }}>Henüz ekip üyesi yok</p>
        ) : (
          <div className="space-y-3">
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
                      backgroundColor: `${ROLE_COLORS[member.role]}20`,
                      color: ROLE_COLORS[member.role],
                    }}
                  >
                    {member.email[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium" style={{ color: '#E5E5EA' }}>
                      {member.email}
                    </div>
                    <div className="text-xs" style={{ color: '#8E8E93' }}>
                      Davet: {new Date(member.invited_at).toLocaleString('tr-TR')}
                    </div>
                  </div>
                </div>
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

