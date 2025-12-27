'use client';

import Link from 'next/link';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-sanayi-background">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-4">
          Yetkisiz Erişim
        </h1>
        <p className="text-gray-700 mb-6">
          Bu panele erişim yetkiniz bulunmamaktadır.
          <br />
          Yalnızca Sanayi Bakanlığı yetkili rolleri (REGULATOR_SANAYI, REGULATOR_TECH_AUDITOR) erişebilir.
        </p>
        <Link
          href="/login"
          className="text-sanayi-primary hover:text-sanayi-secondary underline"
        >
          Giriş sayfasına dön
        </Link>
      </div>
    </div>
  );
}

