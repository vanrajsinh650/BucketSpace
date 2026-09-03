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
        <a
          href="#main-content"
          style={{ position: 'absolute', left: '-9999px', top: 'auto', width: '1px', height: '1px', overflow: 'hidden' }}
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[999] focus:px-4 focus:py-2.5 focus:bg-white focus:text-black focus:rounded-xl focus:font-semibold focus:text-xs focus:shadow-2xl focus:outline-none"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
