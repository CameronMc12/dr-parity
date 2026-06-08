import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Dr Parity ClickUp',
  description: 'Owned ClickUp shell reconstruction for Dr Parity.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark" style={{ colorScheme: 'dark' }}>
      <body className="cu-os-mac">{children}</body>
    </html>
  );
}
