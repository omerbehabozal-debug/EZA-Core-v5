/**
 * Unauthorized Page
 * 
 * Shown when user does not have regulator role.
 */

'use client';

import Link from 'next/link';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-regulator-background">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
        <p className="text-gray-700 mb-6">
          You do not have the required role to access the Regulator Panel.
        </p>
        <p className="text-sm text-gray-500 mb-6">
          Required roles: REGULATOR_READONLY or REGULATOR_AUDITOR
        </p>
        <Link
          href="/login"
          className="inline-block bg-regulator-primary text-white rounded px-4 py-2 font-medium hover:bg-regulator-secondary"
        >
          Back to Login
        </Link>
      </div>
    </div>
  );
}

