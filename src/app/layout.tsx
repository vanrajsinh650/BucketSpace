import React from 'react';
import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Plus_Jakarta_Sans, Newsreader } from 'next/font/google';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
});

const newsreader = Newsreader({
  subsets: ['latin'],
  variable: '--font-newsreader',
});

export const metadata: Metadata = {
  title: 'BucketSpace - A place for everything',
  description: 'Beautifully simple cloud storage for your digital life.',
};

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
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
    <html lang="en" className="dark" style={{ backgroundColor: '#0a0a0a', colorScheme: 'dark' }}>
      <body
        style={{ backgroundColor: '#0a0a0a', color: '#f5f5f4', margin: 0 }}
        className={`${jakarta.variable} ${newsreader.variable} ${GeistSans.variable} ${GeistMono.variable} min-h-[100dvh] bg-[#0a0a0a] text-stone-50 font-sans antialiased selection:bg-stone-50 selection:text-black`}
      >
        {children}
      </body>
    </html>
  );
}
