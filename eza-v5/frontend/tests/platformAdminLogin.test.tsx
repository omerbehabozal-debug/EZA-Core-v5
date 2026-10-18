import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SainaPlatformAdminLogin from '@/components/saina/SainaPlatformAdminLogin';

const replace = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => ({
  isAuthenticated: false,
  isAuthReady: true,
  user: null as null | { email: string; user_id: string; role: string },
  setAuth: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
}));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth }));

beforeEach(() => {
  replace.mockReset();
  auth.isAuthenticated = false;
  auth.isAuthReady = true;
  auth.user = null;
});

describe('Platform Admin login', () => {
  it('shows dedicated Platform Yönetimi login for anonymous users', () => {
    render(<SainaPlatformAdminLogin />);
    expect(screen.getByTestId('padmin-login-page')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Platform Yönetimi' })).toBeVisible();
    expect(screen.getByText(/yalnızca BiligN platform yöneticileri/i)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Business Yönetimi' })).toHaveAttribute(
      'href',
      '/standalone/business'
    );
  });

  it('forwards existing sessions to /standalone/admin without re-login', async () => {
    auth.isAuthenticated = true;
    auth.user = { email: 'admin@example.test', user_id: 'a1', role: 'admin' };
    render(<SainaPlatformAdminLogin />);
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/standalone/admin');
    });
  });
});
