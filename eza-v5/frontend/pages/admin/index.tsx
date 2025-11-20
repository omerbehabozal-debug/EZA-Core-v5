/**
 * Admin Panel Page
 */

import AuthGuard from '@/components/AuthGuard';
import LayoutAdmin from '@/components/LayoutAdmin';

export default function AdminPage() {
  return (
    <AuthGuard allowedRoles={['admin']}>
      <LayoutAdmin>
        <div className="max-w-7xl mx-auto p-6">
          <h1 className="text-2xl font-bold mb-6">Admin Panel</h1>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-white rounded-lg shadow">
              <h2 className="text-lg font-semibold mb-2">Users</h2>
              <p className="text-gray-600">Manage users and roles</p>
            </div>
            <div className="p-6 bg-white rounded-lg shadow">
              <h2 className="text-lg font-semibold mb-2">Statistics</h2>
              <p className="text-gray-600">View system statistics</p>
            </div>
            <div className="p-6 bg-white rounded-lg shadow">
              <h2 className="text-lg font-semibold mb-2">Settings</h2>
              <p className="text-gray-600">System configuration</p>
            </div>
          </div>
        </div>
      </LayoutAdmin>
    </AuthGuard>
  );
}

