import type { ReactNode } from 'react';
import './globals.css';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="sl">
      <body>{children}</body>
    </html>
  );
}
