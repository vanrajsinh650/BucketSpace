import React from 'react';
import './globals.css';

export const metadata = {
  title: 'BucketSpace | Unlimited Cloud Storage Workspace',
  description: 'High-performance visual cloud drive powered by Telegram MTProto and multi-provider storage.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#07090E] text-slate-100 font-sans antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
        {children}
      </body>
    </html>
  );
}
