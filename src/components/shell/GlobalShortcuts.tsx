'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Atalhos globais (HANDOFF §4.8):
 *  - Tecla `N` → /batches/new   (exceto quando foco está em input/textarea/select)
 */
export function GlobalShortcuts() {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'n') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && /input|textarea|select/i.test(t.tagName)) return;
      if (t && (t as HTMLElement).isContentEditable) return;
      e.preventDefault();
      router.push('/batches/new');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);
  return null;
}
