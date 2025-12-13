/**
 * Root Page - Portal Selection
 * Landing page with links to all portals
 */

'use client';

import Link from 'next/link';

export default function HomePage() {
  const portals = [
    {
      name: 'Standalone',
      path: '/standalone',
      description: 'Standalone AI chat interface',
      color: 'bg-blue-500 hover:bg-blue-600',
    },
    {
      name: 'Proxy',
      path: '/proxy',
      description: 'Proxy management dashboard',
      color: 'bg-indigo-500 hover:bg-indigo-600',
    },
    {
      name: 'Proxy Lite',
      path: '/proxy-lite',
      description: 'Lightweight proxy interface',
      color: 'bg-purple-500 hover:bg-purple-600',
    },
    {
      name: 'Corporate',
      path: '/corporate',
      description: 'Corporate portal',
      color: 'bg-green-500 hover:bg-green-600',
    },
    {
      name: 'Admin',
      path: '/admin',
      description: 'Admin panel',
      color: 'bg-red-500 hover:bg-red-600',
    },
    {
      name: 'Regulator',
      path: '/regulator',
      description: 'Regulator portal',
      color: 'bg-yellow-500 hover:bg-yellow-600',
    },
    {
      name: 'Login',
      path: '/login',
      description: 'Authentication page',
      color: 'bg-gray-500 hover:bg-gray-600',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">EZA-Core V6</h1>
          <p className="text-xl text-gray-600 mb-2">Ethical Zekâ Altyapısı</p>
          <p className="text-sm text-gray-500">Select a portal to continue</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {portals.map((portal) => (
            <Link
              key={portal.path}
              href={portal.path}
              className="block p-6 bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow duration-200"
            >
              <div className={`w-12 h-12 ${portal.color} rounded-lg mb-4 flex items-center justify-center text-white font-bold text-xl`}>
                {portal.name[0]}
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">{portal.name}</h2>
              <p className="text-gray-600 text-sm">{portal.description}</p>
            </Link>
          ))}
        </div>

        <div className="mt-12 text-center text-sm text-gray-500">
          <p>EZA Proxy UI System - V1.0</p>
        </div>
      </div>
    </div>
  );
}

