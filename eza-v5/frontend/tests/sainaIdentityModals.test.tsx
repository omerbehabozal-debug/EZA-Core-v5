import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import IdentityModal from '@/components/plan/IdentityModal';
import UpgradeModal from '@/components/plan/UpgradeModal';
import { SAINA_IDENTITY_MODAL_REGISTER, SAINA_PREMIUM_MODAL_CTA } from '@/lib/eza/sainaCopy';

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
    it('shows disabled premium CTA without closing modal on click', () => {
      render(<UpgradeModal open onClose={onClose} feature="pattern" />);

      const premiumCta = screen.getByTestId('saina-premium-upgrade-cta');
      expect(premiumCta).toBeDisabled();
      expect(premiumCta).toHaveTextContent(SAINA_PREMIUM_MODAL_CTA);
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
