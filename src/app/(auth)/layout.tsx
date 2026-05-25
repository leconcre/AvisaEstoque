import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-[1280px] flex-col items-center justify-center px-6 py-10">
        {children}
      </div>
    </div>
  );
}
