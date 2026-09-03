# BucketSpace Privacy Policy

Effective Date: September 3, 2026

## 1. Overview

BucketSpace is an open-source personal cloud storage software project designed to let individuals store files using Telegram's MTProto infrastructure as a storage layer. The software consists of:

- A browser-based client application providing a private drive user interface and client-side encryption.
- A Node.js backend service acting as a relay for Telegram MTProto API connections.
- Optional public link sharing functionality.
- Client-side encryption of file payloads before transmission to the backend.

This Privacy Policy explains what technical information and data BucketSpace processes, where that information is handled, and the technical mechanisms implemented in the current software.

---

## 2. Information BucketSpace May Process

BucketSpace processes only the information necessary to provide authentication, client-side encryption, file uploads, file downloads, and optional link sharing.

### Telegram Account Information
To authenticate with Telegram, the software processes:
- **Phone Number**: Entered into the browser onboarding modal and transmitted over HTTPS to the backend (`POST /api/v1/telegram/auth/send-code`). It is held ephemerally in server memory for the duration of the login handshake (up to 10 minutes) and is not persisted to any database or disk.
- **Telegram Verification Code**: Sent by Telegram to your device, entered in the browser, and transmitted over HTTPS to the backend (`POST /api/v1/telegram/auth/verify-code`) to complete authentication. It is discarded from server memory once the sign-in attempt completes or fails.
- **Two-Factor Authentication (2FA) Password**: If your Telegram account has cloud password protection enabled, the password is transmitted over HTTPS to the backend (`POST /api/v1/telegram/auth/verify-2fa`) to complete the MTProto SRP authentication challenge. It is not saved to disk, database, or logs.
- **Telegram Session Credentials**: Upon successful authentication, Telegram issues a serialized session string (`sessionString`). The backend returns this credential to your browser, where it is stored in browser `localStorage`. During subsequent upload, download, and vault operations, your browser transmits this session credential to the backend within the `x-telegram-session` HTTP request header. The backend maintains an in-memory connection pool for active MTProto clients (automatically evicted after 30 minutes of inactivity).

### File Information
When you select files to store in BucketSpace:
- **File Payloads**: Files are divided into logical chunks in your browser and encrypted client-side using AES-256-GCM before transmission. The backend receives only encrypted binary ciphertext.
- **Filenames and Types**: Filenames, MIME types, and file sizes are handled in browser memory and stored in browser `localStorage`.
- **Chunk Metadata & Integrity Hashes**: For each chunk, the browser computes a SHA-256 checksum and cryptographic initialization vector (IV) to verify bit-exact integrity during subsequent downloads. This metadata is maintained in browser `localStorage`.

### Browser Storage
BucketSpace uses browser `localStorage` exclusively on your local device. It persists the following keys:
- `bucketspace_master_encryption_key`: A 256-bit AES-GCM master encryption key generated or imported locally in your browser. This key never leaves your browser and is never transmitted to the backend or Telegram.
- `bucketspace_active_provider`: Your active storage provider configuration, including your Telegram session string.
- `bucketspace_file_metadata`: Your file catalog, chunk manifests, file sizes, and SHA-256 integrity hashes.
- `bucketspace_resumable_*`: Temporary chunk progress markers used to resume interrupted multipart uploads.
- `bucketspace_shares`: Records of public share links you have generated locally.

### Public Sharing
If you choose to create a public share link for a file:
- A unique URL share token is generated.
- If you configure an optional passcode, the passcode is sent to the backend to protect download authorization.
- The share record (token, shared filename, chunk IDs, and expiration timestamp) is registered with the backend's in-memory share cache.
- Anyone in possession of the public share URL (and passcode, if set) can request and download the file.

---

## 3. How File Encryption Works

BucketSpace uses a client-side encryption architecture:

$$\text{Browser File Chunk} \xrightarrow{\text{Web Crypto AES-256-GCM}} \text{Encrypted Binary Chunk} \xrightarrow{\text{HTTPS POST}} \text{Backend Service} \xrightarrow{\text{MTProto}} \text{Telegram Cloud}$$

1. **Key Generation**: A 256-bit AES key is generated in your browser using the standard Web Crypto API (`window.crypto.subtle`).
2. **Chunk Division**: Files are sliced into bounded chunks (configurable, default 16 MB) in browser memory.
3. **Payload Encryption**: Each chunk is encrypted using AES-256-GCM with a unique, cryptographically random 12-byte Initialization Vector (IV). A 128-bit authentication tag is appended to guarantee tamper detection.
4. **Transmission**: The encrypted binary payload (`[IV] + [Ciphertext + Auth Tag]`) is transmitted over HTTPS to the backend.
5. **Decryption**: When downloading, encrypted chunks are fetched from Telegram via the backend, verified for SHA-256 integrity, and decrypted inside your browser using your locally held master key.

The current application encrypts file chunks in the browser before they are sent to the storage backend. Because file contents are encrypted client-side, the backend receives encrypted binary data rather than plaintext files.

---

## 4. What BucketSpace Can and Cannot See

### What the BucketSpace Backend Can Process
- Incoming HTTP request headers, request metadata, and IP addresses handled by the hosting infrastructure.
- The `x-telegram-session` header provided by your browser to authenticate MTProto API calls on your behalf.
- Ephemeral login parameters (phone number, verification code, 2FA password) during an active sign-in flow.
- Encrypted file chunk payloads and chunk size numbers during upload and download requests.
- Public share tokens, optional passcodes, and shared chunk IDs when public links are created and accessed.

### What the BucketSpace Backend Does Not Intentionally Receive
- **Plaintext File Contents**: File chunks are encrypted client-side in the browser prior to HTTP transmission.
- **Master Encryption Key**: The AES-256-GCM master key is generated and stored exclusively in browser `localStorage`. It is not transmitted to the backend.
- **Master Passphrase**: Passphrases used to derive master keys are processed locally via PBKDF2 in the browser and are not transmitted.

---

## 5. Telegram

BucketSpace uses Telegram as an external storage provider through MTProto 2.0. Users should be aware:
- Telegram is an independent third-party service operated by Telegram FZ-LLC / Telegram Messenger Inc.
- Telegram's own Terms of Service and Privacy Policy govern your Telegram account, phone number, and data stored on Telegram's network.
- BucketSpace does not operate, own, or control Telegram's servers, data centers, or network policies.
- Encrypted file chunks uploaded via BucketSpace are stored as documents within your account's Telegram storage (typically in a dedicated storage channel).
- You should review Telegram's Privacy Policy at: https://telegram.org/privacy

---

## 6. Hosting Providers: Vercel and Render

BucketSpace is architected to run across modern cloud hosting infrastructure:

- **Vercel**: Hosts the Next.js frontend, static assets, and user interface pages.
- **Render**: Hosts the Node.js backend service that maintains persistent MTProto socket connections to Telegram.

These infrastructure providers necessarily receive standard web request information (such as IP addresses, browser user agents, timestamps, and request paths) to route and serve traffic according to their own operational policies.

You can review their respective privacy policies here:
- **Vercel Privacy Notice**: https://vercel.com/legal/privacy-notice
- **Render Privacy Policy**: https://render.com/privacy

---

## 7. Cookies and Local Storage

- **Cookies**: BucketSpace does not set or read browser HTTP cookies.
- **Session Storage**: BucketSpace does not use `sessionStorage`.
- **Local Storage**: BucketSpace uses browser `localStorage` on your device to persist your encryption key, active provider session string, resumable upload markers, and local file catalog metadata across browser sessions. You can delete this data at any time through your browser settings or via the in-app "Disconnect" button.

---

## 8. Analytics and Tracking

Based on the current application implementation, BucketSpace does not intentionally integrate a third-party analytics or advertising tracker. There are no tracking scripts, third-party analytics libraries (such as Google Analytics, PostHog, or Plausible), or advertising pixels included in the application bundle.

---

## 9. Logs and Technical Data

- **Server Diagnostics**: The backend service outputs operational diagnostics, error traces, and MTProto status messages to standard output (`stdout`/`stderr`) for monitoring and debugging.
- **Technical Request Data**: The underlying hosting platforms (Vercel and Render) generate operational access logs containing IP addresses, request URLs, HTTP status codes, and user-agent strings.
- BucketSpace does not maintain a custom database of user request logs or tracking profiles.

---

## 10. Data Retention

- **Browser Local Storage**: Information stored in browser `localStorage` remains on your device until you manually clear it, clear your browser cache, or use the in-app "Disconnect" action.
- **Backend In-Memory State**: Authentication sessions expire and are removed within 10 minutes. MTProto client connections in the backend connection pool are evicted after 30 minutes of inactivity. In-memory public share records are ephemeral and are cleared whenever the backend process restarts.
- **Telegram Cloud Storage**: Files stored in Telegram remain on Telegram's network until deleted. Moving a file to Trash or purging it inside BucketSpace deletes the local metadata record from your browser. Users wishing to permanently purge files from Telegram should delete the corresponding messages within their Telegram storage channel.

---

## 11. User Controls

BucketSpace provides the following controls within the application:
- **Disconnect Account**: Using the "Disconnect" button in the application header clears your Telegram session credentials and local active provider configuration from `localStorage`.
- **Delete Files**: You can move files to the in-app Trash and permanently purge their metadata records from your browser.
- **Manage Public Shares**: You can inspect and revoke active share tokens created from your device.
- **Clear Encryption Keys**: Clearing browser site data or `localStorage` removes your local master encryption key. Note: If you lose your master key without a backup, previously encrypted files cannot be decrypted.

---

## 12. Security Architecture

BucketSpace implements multiple layers of technical security:
- **Client-Side Cryptography**: AES-256-GCM encryption with 12-byte random IVs and 128-bit authentication tags executed via the standard Web Crypto API.
- **Transport Security**: All HTTP communication between your browser, Vercel, and Render is conducted over TLS/HTTPS.
- **Session Isolation**: Every backend MTProto operation requires an explicit `x-telegram-session` header; sessions are scoped strictly per-request and are never shared across users.
- **CORS Protection**: Origin validation middleware ensures only authorized web origins can communicate with backend API endpoints.
- **Integrity Verification**: SHA-256 checksums are calculated and verified to detect tampering or corruption.

*Security Notice*: No software architecture or transmission method can be guaranteed to be 100% secure, unhackable, or immune from compromise. The security of client-side encryption depends on the integrity of the user's client device, browser environment, and operating system.

---

## 13. Children's Privacy

BucketSpace is not directed to individuals under the age of 13 (or the minimum applicable legal age in your jurisdiction). We do not knowingly collect or solicit personal information from children.

---

## 14. International Data Transfers

BucketSpace relies on third-party infrastructure providers (including Vercel, Render, and Telegram) that operate servers and facilities worldwide. By using the software, technical data and encrypted files may be transferred, processed, and stored across multiple countries subject to the terms and privacy policies of those service providers.

---

## 15. Changes to This Policy

This Privacy Policy may be updated from time to time as software features, legal requirements, or infrastructure configurations change. Any updates will be reflected in the repository with an updated effective date.

---

## 16. Contact

For questions, feedback, or inquiries regarding this Privacy Policy or the BucketSpace software, please contact:

**Vanraj Solanki**  
Email: [vanrajsolanki2875@gmail.com](mailto:vanrajsolanki2875@gmail.com)

---

## 17. Legal Disclaimer

This privacy policy is a product disclosure document and is not legal advice. It should be reviewed by qualified legal counsel before commercial/public launch.
