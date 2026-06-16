import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import SainaMessageBody from '@/components/standalone/SainaMessageBody';

describe('SainaMessageBody markdown', () => {
  it('renders bold and list markdown for assistant messages', () => {
    render(
      <SainaMessageBody
        role="ai"
        message={'**Önemli:**\n\n- Birinci madde\n- İkinci madde'}
      />
    );

    expect(screen.getByTestId('saina-msg-prose')).toBeInTheDocument();
    expect(screen.getByText('Önemli:')).toBeInTheDocument();
    expect(screen.getByText('Birinci madde')).toBeInTheDocument();
    expect(screen.getByText('İkinci madde')).toBeInTheDocument();
    expect(document.querySelector('.saina-msg-prose-strong')).toBeTruthy();
    expect(document.querySelectorAll('.saina-msg-prose-list li').length).toBe(2);
  });

  it('renders inline code without showing raw backticks', () => {
    render(<SainaMessageBody role="ai" message="Şunu dene: `npm run dev`" />);

    expect(screen.getByText('npm run dev')).toBeInTheDocument();
    expect(document.querySelector('.saina-msg-prose-code')).toBeTruthy();
  });

  it('renders user messages with markdown prose wrapper', () => {
    render(<SainaMessageBody role="user" message="Merhaba **dünya**" />);

    expect(screen.getByTestId('saina-msg-prose')).toHaveClass('saina-msg-prose--user');
    expect(screen.getByText('dünya')).toBeInTheDocument();
  });
});
