import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft, Shield, ExternalLink } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy — BucketSpace',
  description: 'Technical privacy disclosures and data handling practices for BucketSpace.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-200 font-sans selection:bg-stone-50 selection:text-black">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-[#222]">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to BucketSpace</span>
          </Link>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-zinc-400" />
            <span className="text-xs font-semibold text-zinc-300">Privacy Policy</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-12 md:py-16">
        <article className="space-y-10 text-sm leading-relaxed text-zinc-300">
          {/* Document Header */}
          <div className="border-b border-[#222] pb-8">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-100 mb-3 font-sans">
              BucketSpace Privacy Policy
            </h1>
            <p className="text-xs text-zinc-500 font-mono">
              Effective Date: September 3, 2026
            </p>
          </div>

          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-zinc-100">1. Overview</h2>
            <p>
              BucketSpace is an open-source personal cloud storage software project designed to let individuals store files using Telegram&apos;s MTProto infrastructure as a storage layer. The software consists of:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-zinc-400">
              <li>A browser-based client application providing a personal vault drive interface and client-side encryption.</li>
              <li>A Node.js backend service acting as a relay for Telegram MTProto connections.</li>
              <li>Optional public link sharing functionality.</li>
              <li>Client-side encryption of file payloads before transmission to the backend.</li>
            </ul>
            <p>
              This Privacy Policy explains what technical information and data BucketSpace processes, where that information is handled, and the technical mechanisms implemented in the current software.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-zinc-100">2. Information BucketSpace May Process</h2>
            <p>
              BucketSpace processes only the information necessary to provide authentication, client-side encryption, file uploads, file downloads, and optional link sharing.
            </p>

            <div className="space-y-3 pl-2 border-l border-[#262626]">
              <h3 className="text-sm font-semibold text-zinc-200">Telegram Account Information</h3>
              <p className="text-zinc-400">
                To authenticate with Telegram, the software processes:
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-zinc-400">
                <li>
                  <strong className="text-zinc-200">Phone Number:</strong> Entered into the onboarding modal and transmitted over HTTPS to the backend (<code className="text-xs bg-[#161616] px-1.5 py-0.5 rounded border border-[#262626] font-mono text-zinc-300">POST /api/v1/telegram/auth/send-code</code>). It is held ephemerally in server memory for the duration of the login handshake (up to 10 minutes) and is not saved to any database or disk.
                </li>
                <li>
                  <strong className="text-zinc-200">Telegram Verification Code:</strong> Sent by Telegram to your device, entered in your browser, and transmitted over HTTPS to the backend (<code className="text-xs bg-[#161616] px-1.5 py-0.5 rounded border border-[#262626] font-mono text-zinc-300">POST /api/v1/telegram/auth/verify-code</code>) to complete sign-in. It is discarded from server memory once authentication succeeds or fails.
                </li>
                <li>
                  <strong className="text-zinc-200">Two-Factor Authentication (2FA) Password:</strong> If your Telegram account has cloud password protection enabled, the password is transmitted over HTTPS to the backend (<code className="text-xs bg-[#161616] px-1.5 py-0.5 rounded border border-[#262626] font-mono text-zinc-300">POST /api/v1/telegram/auth/verify-2fa</code>) to complete the MTProto SRP challenge. It is not saved to disk, database, or server logs.
                </li>
                <li>
                  <strong className="text-zinc-200">Telegram Session Credentials:</strong> Upon successful authentication, Telegram issues a serialized session string (<code className="text-xs bg-[#161616] px-1.5 py-0.5 rounded border border-[#262626] font-mono text-zinc-300">sessionString</code>). The backend returns this credential to your browser, where it is stored in browser <code className="text-xs bg-[#161616] px-1.5 py-0.5 rounded border border-[#262626] font-mono text-zinc-300">localStorage</code>. During subsequent upload, download, and vault operations, your browser transmits this session credential to the backend within the <code className="text-xs bg-[#161616] px-1.5 py-0.5 rounded border border-[#262626] font-mono text-zinc-300">x-telegram-session</code> HTTP header. The backend maintains an in-memory connection pool for active MTProto clients (automatically evicted after 30 minutes of inactivity).
                </li>
              </ul>
            </div>

            <div className="space-y-3 pl-2 border-l border-[#262626]">
              <h3 className="text-sm font-semibold text-zinc-200">File Information</h3>
              <ul className="list-disc pl-6 space-y-1.5 text-zinc-400">
                <li>
                  <strong className="text-zinc-200">File Payloads:</strong> Files are divided into logical chunks in your browser and encrypted client-side using AES-256-GCM before transmission. The backend receives only encrypted binary ciphertext.
                </li>
                <li>
                  <strong className="text-zinc-200">Filenames and Types:</strong> Filenames, MIME types, and file sizes are handled in browser memory and stored in browser <code className="text-xs bg-[#161616] px-1.5 py-0.5 rounded border border-[#262626] font-mono text-zinc-300">localStorage</code>.
                </li>
                <li>
                  <strong className="text-zinc-200">Chunk Metadata & Integrity Hashes:</strong> For each chunk, the browser computes a SHA-256 checksum and cryptographic initialization vector (IV) to verify bit-exact integrity during subsequent downloads. This metadata is maintained in browser <code className="text-xs bg-[#161616] px-1.5 py-0.5 rounded border border-[#262626] font-mono text-zinc-300">localStorage</code>.
                </li>
              </ul>
            </div>

            <div className="space-y-3 pl-2 border-l border-[#262626]">
              <h3 className="text-sm font-semibold text-zinc-200">Browser Storage</h3>
              <p className="text-zinc-400">
                BucketSpace uses browser <code className="text-xs bg-[#161616] px-1.5 py-0.5 rounded border border-[#262626] font-mono text-zinc-300">localStorage</code> on your local device. It persists the following keys:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-zinc-400">
                <li><code className="text-xs bg-[#161616] px-1.5 py-0.5 rounded border border-[#262626] font-mono text-zinc-300">bucketspace_master_encryption_key</code>: 256-bit AES-GCM master key (never sent to the server or Telegram).</li>
                <li><code className="text-xs bg-[#161616] px-1.5 py-0.5 rounded border border-[#262626] font-mono text-zinc-300">bucketspace_active_provider</code>: Active provider ID and session credentials.</li>
                <li><code className="text-xs bg-[#161616] px-1.5 py-0.5 rounded border border-[#262626] font-mono text-zinc-300">bucketspace_file_metadata</code>: Local file list and chunk manifests.</li>
                <li><code className="text-xs bg-[#161616] px-1.5 py-0.5 rounded border border-[#262626] font-mono text-zinc-300">bucketspace_resumable_*</code>: Multipart upload progress markers.</li>
                <li><code className="text-xs bg-[#161616] px-1.5 py-0.5 rounded border border-[#262626] font-mono text-zinc-300">bucketspace_shares</code>: Locally saved public share tokens.</li>
              </ul>
            </div>

            <div className="space-y-3 pl-2 border-l border-[#262626]">
              <h3 className="text-sm font-semibold text-zinc-200">Public Sharing</h3>
              <p className="text-zinc-400">
                When you create a public share link, the share token, optional passcode, shared file metadata, and chunk IDs are registered in the backend service&apos;s in-memory cache to allow authorized recipients to fetch the encrypted file parts.
              </p>
            </div>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-zinc-100">3. How File Encryption Works</h2>
            <div className="p-4 bg-[#141414] border border-[#262626] rounded-xl font-mono text-xs text-zinc-300 space-y-1 overflow-x-auto">
              <div>Browser File Chunk → AES-256-GCM Encryption → Encrypted Binary Data → Backend Relay → Telegram Cloud</div>
            </div>
            <p>
              The current application encrypts file chunks in the browser before they are sent to the storage backend:
            </p>
            <ol className="list-decimal pl-6 space-y-1.5 text-zinc-400">
              <li>A 256-bit AES key is generated in your browser using the standard Web Crypto API (<code className="text-xs bg-[#161616] px-1.5 py-0.5 rounded border border-[#262626] font-mono text-zinc-300">window.crypto.subtle</code>).</li>
              <li>Files are sliced into bounded chunks (configurable, default 16 MB) in browser memory.</li>
              <li>Each chunk is encrypted using AES-256-GCM with a unique, cryptographically random 12-byte Initialization Vector (IV). A 128-bit authentication tag is appended to guarantee tamper detection.</li>
              <li>The encrypted binary payload is transmitted over HTTPS to the backend.</li>
              <li>When downloading, encrypted chunks are retrieved from Telegram via the backend, verified for SHA-256 integrity, and decrypted inside your browser using your locally held master key.</li>
            </ol>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-zinc-100">4. What BucketSpace Can and Cannot See</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-[#141414] border border-[#262626] rounded-xl space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">Backend Can Process</h3>
                <ul className="list-disc pl-5 space-y-1 text-xs text-zinc-400">
                  <li>Incoming HTTP requests, paths, and headers.</li>
                  <li>The <code className="text-[11px] font-mono">x-telegram-session</code> authentication header.</li>
                  <li>Ephemeral login parameters during sign-in.</li>
                  <li>Encrypted chunk ciphertext and byte sizes.</li>
                  <li>Public share tokens and optional passcodes.</li>
                  <li>IP addresses available to hosting infrastructure.</li>
                </ul>
              </div>
              <div className="p-4 bg-[#141414] border border-[#262626] rounded-xl space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">Backend Does Not Intentionally Receive</h3>
                <ul className="list-disc pl-5 space-y-1 text-xs text-zinc-400">
                  <li>Plaintext file contents (encrypted in browser prior to transmission).</li>
                  <li>Your 256-bit AES-GCM master encryption key.</li>
                  <li>Master passphrases used to derive encryption keys.</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-zinc-100">5. Telegram</h2>
            <p>
              BucketSpace uses Telegram as a third-party storage provider via MTProto. Users should understand:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-zinc-400">
              <li>Telegram is an independent third-party service; Telegram&apos;s own terms and privacy policies govern your account and stored data.</li>
              <li>BucketSpace does not operate, own, or control Telegram&apos;s servers, data centers, or network policies.</li>
              <li>Encrypted chunks are stored as documents within your account&apos;s Telegram cloud storage (in your dedicated vault channel).</li>
              <li>
                You can review Telegram&apos;s Privacy Policy at:{' '}
                <a
                  href="https://telegram.org/privacy"
                  target="_blank"
                  rel="noreferrer"
                  className="text-zinc-200 underline hover:text-white inline-flex items-center gap-1"
                >
                  telegram.org/privacy
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
            </ul>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-zinc-100">6. Hosting Providers: Vercel and Render</h2>
            <p>
              BucketSpace is designed to run across two cloud hosting environments:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-zinc-400">
              <li><strong className="text-zinc-200">Vercel:</strong> Hosts frontend web assets and user interface pages.</li>
              <li><strong className="text-zinc-200">Render:</strong> Hosts the long-running Node.js backend relay for MTProto uploads and downloads.</li>
            </ul>
            <p>
              These infrastructure providers process technical connection data according to their own privacy policies:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-zinc-400">
              <li>
                <a
                  href="https://vercel.com/legal/privacy-notice"
                  target="_blank"
                  rel="noreferrer"
                  className="text-zinc-200 underline hover:text-white inline-flex items-center gap-1"
                >
                  Vercel Privacy Notice
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                <a
                  href="https://render.com/privacy"
                  target="_blank"
                  rel="noreferrer"
                  className="text-zinc-200 underline hover:text-white inline-flex items-center gap-1"
                >
                  Render Privacy Policy
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
            </ul>
          </section>

          {/* Section 7 */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-zinc-100">7. Cookies and Local Storage</h2>
            <p>
              BucketSpace does not use browser HTTP cookies or <code className="text-xs bg-[#161616] px-1.5 py-0.5 rounded border border-[#262626] font-mono text-zinc-300">sessionStorage</code>. BucketSpace relies exclusively on browser <code className="text-xs bg-[#161616] px-1.5 py-0.5 rounded border border-[#262626] font-mono text-zinc-300">localStorage</code> on your local device to store your encryption key, active provider session string, and file metadata catalog across visits.
            </p>
          </section>

          {/* Section 8 */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-zinc-100">8. Analytics and Tracking</h2>
            <p>
              Based on the current application implementation, BucketSpace does not intentionally integrate a third-party analytics or advertising tracker.
            </p>
          </section>

          {/* Section 9 */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-zinc-100">9. Logs and Technical Data</h2>
            <p>
              The backend service prints operational diagnostics, error traces, and Telegram MTProto status messages to standard output for server monitoring. Hosting layers (Vercel and Render) log technical connection data including IP addresses, timestamps, request URLs, and user agents. BucketSpace does not maintain a database of user request logs or browsing history.
            </p>
          </section>

          {/* Section 10 */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-zinc-100">10. Data Retention</h2>
            <ul className="list-disc pl-6 space-y-1.5 text-zinc-400">
              <li><strong className="text-zinc-200">Browser Storage:</strong> Stored locally until you clear browser data or click &ldquo;Disconnect&rdquo;.</li>
              <li><strong className="text-zinc-200">Server In-Memory State:</strong> Login sessions expire in 10 minutes; MTProto clients evict after 30 minutes of inactivity; share records in memory clear upon backend server restart.</li>
              <li><strong className="text-zinc-200">Telegram Cloud Data:</strong> Files remain on Telegram until deleted. Deleting files inside BucketSpace purges local metadata; permanent removal from Telegram requires deleting the corresponding message in your Telegram vault channel.</li>
            </ul>
          </section>

          {/* Section 11 */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-zinc-100">11. User Controls</h2>
            <p>
              You have direct control over your local data:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-zinc-400">
              <li><strong className="text-zinc-200">Disconnect Account:</strong> Clears session credentials from your browser.</li>
              <li><strong className="text-zinc-200">Delete Files:</strong> Move files to Trash or permanently purge local metadata.</li>
              <li><strong className="text-zinc-200">Revoke Shares:</strong> Remove generated public share tokens from your vault.</li>
              <li><strong className="text-zinc-200">Clear Storage:</strong> Clearing your browser data removes all local keys and metadata.</li>
            </ul>
          </section>

          {/* Section 12 */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-zinc-100">12. Security Architecture</h2>
            <p>
              BucketSpace implements client-side AES-256-GCM cryptography, HTTPS transport encryption, server-side secret management via environment variables, origin-based CORS validation, and SHA-256 integrity verification.
            </p>
            <p className="text-xs text-zinc-400 italic">
              Notice: No security architecture can guarantee absolute protection or 100% security against all potential threats, software defects, or compromised client devices.
            </p>
          </section>

          {/* Section 13 */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-zinc-100">13. Children&apos;s Privacy</h2>
            <p>
              BucketSpace is not directed to children under 13 years of age (or the applicable minimum legal age in your jurisdiction), and we do not knowingly collect personal information from children.
            </p>
          </section>

          {/* Section 14 */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-zinc-100">14. International Data Transfers</h2>
            <p>
              BucketSpace relies on third-party infrastructure (including Vercel, Render, and Telegram) operating globally. Data may be transferred, processed, and stored internationally subject to the terms and privacy policies of those services.
            </p>
          </section>

          {/* Section 15 */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-zinc-100">15. Changes to This Policy</h2>
            <p>
              This Privacy Policy may be updated as software features or infrastructure configurations evolve. Any updates will be published with a revised effective date.
            </p>
          </section>

          {/* Section 16 */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-zinc-100">16. Contact</h2>
            <p>
              For questions or inquiries regarding this Privacy Policy or BucketSpace, please contact:
            </p>
            <p className="text-zinc-200 font-medium">
              Vanraj Solanki<br />
              Email:{' '}
              <a href="mailto:vanrajsolanki2875@gmail.com" className="underline hover:text-white">
                vanrajsolanki2875@gmail.com
              </a>
            </p>
          </section>

          {/* Section 17 */}
          <section className="p-4 bg-[#141414] border border-[#262626] rounded-xl text-xs text-zinc-400 leading-relaxed">
            <strong className="text-zinc-200 block mb-1">17. Legal Disclaimer</strong>
            This privacy policy is a product disclosure document and is not legal advice. It should be reviewed by qualified legal counsel before commercial/public launch.
          </section>
        </article>
      </main>

      {/* Page Footer */}
      <footer className="border-t border-[#222] py-8 px-6 text-center text-xs text-zinc-500 font-mono">
        BucketSpace &bull; Open-Source Personal Cloud Storage
      </footer>
    </div>
  );
}
