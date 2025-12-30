"use client";

import { useEffect } from "react";

export default function ScrollRestoration() {
  useEffect(() => {
    // Scroll restoration'ı manuel olarak kontrol et
    if (typeof window !== 'undefined') {
      // Tarayıcının otomatik scroll restoration'ını devre dışı bırak
      if ('scrollRestoration' in window.history) {
        window.history.scrollRestoration = 'manual';
      }
    }
  }, []);

  return null;
}

