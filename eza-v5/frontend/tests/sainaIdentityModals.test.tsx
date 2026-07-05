import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import IdentityModal from '@/components/plan/IdentityModal';
import UpgradeModal from '@/components/plan/UpgradeModal';
import {
  SAINA_IDENTITY_MODAL_REGISTER,
  SAINA_UPGRADE_MODAL_TITLE,
  SAINA_UPGRADE_PLAN_COMING_SOON,
  SAINA_UPGRADE_STANDARD_BADGE,
} from '@/lib/eza/sainaCopy';

vi.mock('next/navigation', () => ({
  usePathname: () => '/standalone',
}));

describe('SAINA identity modals', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    onClose.mockClear();
    window.history.replaceState({}, '', '/standalone?chat=abc');
  });

  describe('IdentityModal', () => {
    it('builds auth links with full return URL including query', () => {
      render(<IdentityModal open onClose={onClose} />);

      const register = screen.getByTestId('saina-identity-register-cta');
      expect(register).toHaveAttribute(
        'href',
        '/platform/register?return=%2Fstandalone%3Fchat%3Dabc'
      );

      const login = screen.getByTestId('saina-identity-login-cta');
      expect(login).toHaveAttribute(
        'href',
        '/platform/login?return=%2Fstandalone%3Fchat%3Dabc'
      );
    });

    it('lists register CTA before login for new-user hierarchy', () => {
      render(<IdentityModal open onClose={onClose} />);

      const register = screen.getByTestId('saina-identity-register-cta');
      const login = screen.getByTestId('saina-identity-login-cta');
      expect(register.compareDocumentPosition(login)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      expect(register).toHaveTextContent(SAINA_IDENTITY_MODAL_REGISTER);
      expect(register.className).toContain('saina-modal-cta--primary');
    });

    it('closes on Escape', () => {
      render(<IdentityModal open onClose={onClose} />);
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('exposes 44px touch targets on close and CTAs', () => {
      render(<IdentityModal open onClose={onClose} />);
      expect(screen.getByLabelText('Kapat').className).toContain('saina-modal-close-btn');
      expect(screen.getByTestId('saina-identity-register-cta').className).toContain('saina-modal-cta');
    });
  });

  describe('UpgradeModal', () => {
    it('shows three account plan cards with coming-soon CTAs', () => {
      render(<UpgradeModal open onClose={onClose} feature="pattern" />);

      expect(screen.getByText(SAINA_UPGRADE_MODAL_TITLE)).toBeInTheDocument();
      expect(screen.getByTestId('saina-upgrade-plan-mini')).toBeInTheDocument();
      expect(screen.getByTestId('saina-upgrade-plan-standard')).toBeInTheDocument();
      expect(screen.getByTestId('saina-upgrade-plan-premium')).toBeInTheDocument();
      expect(screen.getByText(SAINA_UPGRADE_STANDARD_BADGE)).toBeInTheDocument();

      const premiumCta = screen.getByTestId('saina-upgrade-plan-cta-premium');
      expect(premiumCta).toBeDisabled();
      expect(premiumCta).toHaveTextContent(SAINA_UPGRADE_PLAN_COMING_SOON);
      fireEvent.click(premiumCta);
      expect(onClose).not.toHaveBeenCalled();
    });

    it('closes on Escape', () => {
      render(<UpgradeModal open onClose={onClose} />);
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
