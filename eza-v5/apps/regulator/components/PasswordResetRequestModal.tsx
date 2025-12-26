/**
 * Password Reset Request Modal
 * 
 * Controlled password reset request flow.
 * NO automatic reset - manual approval required.
 */

'use client';

import { useState } from 'react';

interface PasswordResetRequestModalProps {
  onClose: () => void;
  apiBaseUrl: string;
}

export function PasswordResetRequestModal({
  onClose,
  apiBaseUrl,
}: PasswordResetRequestModalProps) {
  const [email, setEmail] = useState('');
  const [institution, setInstitution] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Note: This endpoint should be created in backend
      // For now, we'll use a placeholder that shows the expected flow
      // Backend should create a password_reset_request record with:
      // - user_email
      // - request_time
      // - source = "REGULATOR_PANEL"
      // - status = "PENDING"
      // - Audit log: regulator_password_reset_requested

      const response = await fetch(`${apiBaseUrl}/api/auth/password-reset-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          institution: institution || undefined,
          description: description || undefined,
          source: 'REGULATOR_PANEL',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Request failed' }));
        throw new Error(errorData.detail || 'Talep oluşturulamadı');
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="mb-4">
              <svg
                className="mx-auto h-12 w-12 text-green-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Talep Alındı
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              Talebiniz alınmıştır. Yetkiniz doğrulandıktan sonra sistem yöneticisi sizinle iletişime geçecektir.
            </p>
            <button
              onClick={onClose}
              className="w-full bg-regulator-primary text-white rounded px-4 py-2 font-medium hover:bg-regulator-secondary"
            >
              Tamam
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Şifre Sıfırlama Talebi
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="bg-blue-50 border-l-4 border-blue-400 p-3 mb-4">
          <p className="text-sm text-blue-800">
            <strong>Önemli:</strong> Bu panel yalnızca yetkilendirilmiş düzenleyiciler içindir.
            Şifre sıfırlama işlemleri otomatik değildir. Talebiniz yetkiniz doğrulandıktan sonra manuel olarak işlenir.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className="w-full border border-gray-300 rounded px-3 py-2 disabled:bg-gray-100"
              placeholder="email@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kurum / Regülatör Adı
            </label>
            <input
              type="text"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              disabled={loading}
              className="w-full border border-gray-300 rounded px-3 py-2 disabled:bg-gray-100"
              placeholder="Örn: RTÜK, BTK"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Açıklama
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
              rows={3}
              className="w-full border border-gray-300 rounded px-3 py-2 disabled:bg-gray-100"
              placeholder="İsteğe bağlı açıklama..."
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 border border-gray-300 text-gray-700 rounded px-4 py-2 font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-regulator-primary text-white rounded px-4 py-2 font-medium hover:bg-regulator-secondary disabled:opacity-50"
            >
              {loading ? 'Gönderiliyor...' : 'Talep Oluştur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

