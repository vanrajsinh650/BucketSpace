# Telegram Cloud Storage Architecture (13_STORAGE_ARCHITECTURE.md)

## 1. Executive Summary & Design Goals
The **BucketSpace Storage Engine** (`packages/storage-adapters`) implements Telegram cloud storage as the dedicated storage backend via `IStorageProvider`, supporting native MTProto 2.0 streaming and Bot API fallbacks.

---

## 2. Storage Provider Topology

```mermaid
graph TD
    Client[Storage Service Core] -->|Unified Interface| Adapter[IStorageProvider Interface]
    Adapter -->|GramJS MTProto 2.0| TG_MTProto[Telegram MTProto 2.0 Adapter]
    Adapter -->|HTTPS Bot API| TG_Bot[Telegram Bot API Adapter]
    Adapter -->|Ephemeral Memory| Mem[InMemory Test Adapter]
```

---

## 3. MTProto 2.0 Streaming Chunk Ingestion Workflow

```mermaid
sequenceDiagram
    autonumber
    participant Client as Client Browser / Node.js
    participant Service as StorageApplicationService
    participant Adapter as TelegramStorageAdapter (MTProto 2.0)
    participant TG as Telegram Data Centers (DC)

    Client->>Service: Upload File (e.g. 500 MB video)
    Service->>Service: Slice file into bounded chunks (512KB-20MB)
    Service->>Service: Encrypt chunk with client-side AES-256-GCM
    Service->>Service: Compute Chunk SHA-256 Digest
    Service->>Adapter: putChunk(chunkData, hash)
    Adapter->>TG: uploadFile() -> saveBigFilePart()
    Adapter->>TG: sendFile() as document media
    TG-->>Adapter: Return Message with Document metadata (dcId, docId, accessHash)
    Adapter-->>Service: Return ProviderChunkRef (opaque JSON)
    Service->>Service: Store Chunk record in SQLite DB
    Service-->>Client: Chunk Verified & Stored
```

---

## 4. SHA-256 Integrity & Deduplication Invariant

Every chunk uploaded to Telegram is validated against its SHA-256 hash before storage, during download streaming, and upon final reassembly:

```typescript
export function verifyChunkIntegrity(
  downloadedBytes: Uint8Array,
  expectedHash: string
): boolean {
  const actualHash = createHash('sha256').update(downloadedBytes).digest('hex');
  return actualHash === expectedHash;
}
```

---

## 5. Cross-References
- System Architecture: [04_SYSTEM_ARCHITECTURE.md](file:///c:/Users/Vanrajsinh/Desktop/DevVault/Building-Hub/BucketSpace/context/04_SYSTEM_ARCHITECTURE.md)
- Database Schema: [09_DATABASE.md](file:///c:/Users/Vanrajsinh/Desktop/DevVault/Building-Hub/BucketSpace/context/09_DATABASE.md)
- Telegram Credentials Guide: [TELEGRAM_CREDENTIALS_GUIDE.md](file:///c:/Users/Vanrajsinh/Desktop/DevVault/Building-Hub/BucketSpace/context/TELEGRAM_CREDENTIALS_GUIDE.md)

