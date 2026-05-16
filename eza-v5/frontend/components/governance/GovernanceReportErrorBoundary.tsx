'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class GovernanceReportErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[GovernanceReport]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <p className="text-lg font-medium text-stone-900">Rapor görüntülenemedi</p>
          <p className="mt-2 text-sm text-stone-600">
            Sayfayı yenileyin. Sorun sürerse oturumu kapatıp tekrar giriş yapın.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
