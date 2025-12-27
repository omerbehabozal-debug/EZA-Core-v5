'use client';

import Link from 'next/link';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-finance-background">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-4">
          Yetkisiz Erişim
        </h1>
        <p className="text-gray-700 mb-6">
          Bu panele erişim yetkiniz bulunmamaktadır.
          <br />
          Yalnızca finansal düzenleyici yetkili rolleri (REGULATOR_FINANCE, REGULATOR_BDDK, REGULATOR_SPK) erişebilir.
        </p>
        <Link
          href="/login"
          className="text-finance-primary hover:text-finance-secondary underline"
        >
          Giriş sayfasına dön
        </Link>
      </div>
    </div>
  );
}

