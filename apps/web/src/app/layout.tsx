import React from 'react';
import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';

export const metadata: Metadata = {
  title: 'BucketSpace — Personal Cloud Storage',
  description: 'Clean, high-performance decentralized personal cloud storage powered by Telegram MTProto and multi-provider backends.',
};

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${GeistSans.variable} ${GeistMono.variable} min-h-[100dvh] bg-black text-zinc-100 font-sans antialiased selection:bg-zinc-800 selection:text-white`}>
        {children}
      </body>
    </html>
  );
}
