import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: 'Sports Bet Companion',
  description: 'Live game scores and updates for sports betting',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers><Suspense>{children}</Suspense></Providers>
      </body>
    </html>
  );
}
