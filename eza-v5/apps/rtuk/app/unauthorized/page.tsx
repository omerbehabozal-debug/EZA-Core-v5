'use client';

import Link from 'next/link';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-rtuk-background">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-4">
          Yetkisiz Erişim
        </h1>
        <p className="text-gray-700 mb-6">
          Bu panele erişim yetkiniz bulunmamaktadır.
          <br />
          Yalnızca RTÜK yetkili rolleri (REGULATOR_RTUK, REGULATOR_MEDIA_AUDITOR) erişebilir.
        </p>
        <Link
          href="/login"
          className="text-rtuk-primary hover:text-rtuk-secondary underline"
        >
          Giriş sayfasına dön
        </Link>
      </div>
    </div>
  );
}

