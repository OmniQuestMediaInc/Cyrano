import type { ReactNode } from 'react';

export const metadata = {
  title: 'Cyrano™ Layer 2 — Persistent Worlds',
  description: 'VIP/Diamond persistent-worlds whisper console for ChatNow.Zone™.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
