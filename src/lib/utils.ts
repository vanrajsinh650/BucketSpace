import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format byte count into human-readable representation */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/** Format timestamp into ISO date string (YYYY-MM-DD) */
export function formatDate(timestamp: number | Date | string): string {
  const d = new Date(timestamp);
  return d.toISOString().split('T')[0];
}

/**
 * Normalizes an API base URL, ensuring it has a protocol and no trailing slashes.
 * Automatically adds 'https://' if the user entered a bare domain without protocol.
 */
export function normalizeApiBase(rawUrl?: string): string {
  // If running in the browser on Vercel and pointing to Railway, prefer same-origin relative path
  // so Vercel's edge proxy routes the request directly to Railway, bypassing ISP-level DNS blocks
  // (such as Jio/Airtel blocking *.up.railway.app in India).
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const isVercel = host.endsWith('.vercel.app') || host === 'bucket-space.vercel.app';
    if (isVercel && (!rawUrl || rawUrl.includes('railway.app'))) {
      return '';
    }
  }

  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let trimmed = rawUrl.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }
  return trimmed;
}


