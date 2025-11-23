/**
 * Navbar Component
 */

import Link from 'next/link';
import { Shield } from 'lucide-react';

export default function Navbar() {
  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-blue-600" />
          <span className="text-xl font-semibold text-gray-900">EZA Proxy</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/proxy-lite" className="text-sm text-gray-600 hover:text-gray-900">
            Proxy-Lite
          </Link>
          <Link href="/proxy/login" className="text-sm text-gray-600 hover:text-gray-900">
            Kurumsal Giriş
          </Link>
        </div>
      </div>
    </nav>
  );
}

