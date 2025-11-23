/**
 * Select Portal Page
 */

'use client';

import { useRouter } from 'next/navigation';
import { ShieldCheck, Network, Building2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { useTenantStore } from '@/lib/tenantStore';

const portals = [
  {
    id: 'regulator',
    title: 'Regulator Portal',
    description: 'Resmi denetleyici kurumlar için.',
    icon: ShieldCheck,
    route: '/proxy/regulator',
    tenantId: 'rtuk', // Default regulator tenant
    color: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
  },
  {
    id: 'platform',
    title: 'Platform Portal',
    description: 'İçerik platformları ve API entegrasyonları.',
    icon: Network,
    route: '/proxy/platform',
    tenantId: 'platform',
    color: 'bg-green-50 border-green-200 hover:bg-green-100',
  },
  {
    id: 'corporate',
    title: 'Corporate Portal',
    description: 'Şirket içi AI denetimi ve güvenlik.',
    icon: Building2,
    route: '/proxy/corporate',
    tenantId: 'corporate',
    color: 'bg-purple-50 border-purple-200 hover:bg-purple-100',
  },
];

export default function SelectPortalPage() {
  const router = useRouter();
  const { setTenant } = useTenantStore();

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-semibold text-gray-900 mb-4">
            Kurumsal Proxy Paneli
          </h1>
          <p className="text-lg text-gray-600">
            Lütfen portalınızı seçin
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {portals.map((portal) => {
            const Icon = portal.icon;
            return (
              <Card
                key={portal.id}
                className={`cursor-pointer transition-all duration-200 hover:scale-105 ${portal.color}`}
                onClick={() => {
                  setTenant(portal.tenantId);
                  router.push(`${portal.route}?tenant=${portal.tenantId}`);
                }}
              >
                <CardHeader>
                  <div className="flex items-center justify-center mb-4">
                    <Icon className="w-12 h-12 text-gray-700" />
                  </div>
                  <CardTitle className="text-center">{portal.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 text-center">
                    {portal.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

