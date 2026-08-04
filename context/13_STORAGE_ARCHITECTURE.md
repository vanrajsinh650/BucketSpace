# Multi-Cloud Storage Architecture (13_STORAGE_ARCHITECTURE.md)

## 1. Executive Summary & Design Goals
The **BucketSpace Storage Engine** (`packages/storage-adapters`) abstracts multi-cloud object storage engines into a single unified driver interface (`IStorageProvider`).

---

## 2. Multi-Cloud Provider Abstraction Engine

```mermaid
graph TD
    Client[Storage Service Core] -->|Unified Interface| Adapter[IStorageProvider Interface]
    Adapter -->|S3 Protocol| AWS[AWS S3 Adapter]
    Adapter -->|S3 Protocol| R2[Cloudflare R2 Adapter]
    Adapter -->|GCS API| GCP[GCP Storage Adapter]
    Adapter -->|Blob API| Azure[Azure Blob Adapter]
    Adapter -->|S3 API| MinIO[Local / MinIO Adapter]
```

---

## 3. Presigned Multipart Upload Workflow

```mermaid
sequenceDiagram
    autonumber
    participant Client as Browser (Web Worker)
    participant Gateway as BucketSpace API
    participant S3 as AWS S3 / Cloudflare R2

    Client->>Gateway: Request presigned upload for file (Size: 1GB)
    Gateway->>Gateway: Calculate optimal part size (8MB per part)
    Gateway->>S3: Call InitiateMultipartUpload
    S3-->>Gateway: Return UploadId
    
    loop For each part (Part 1 .. 128)
        Gateway->>S3: Generate presigned PUT URL for Part N
    end
    Gateway-->>Client: Return array of Presigned Part URLs

    par Parallel Upload Threads (up to 6 threads)
        Client->>S3: PUT Part 1 Chunk Payload
        Client->>S3: PUT Part 2 Chunk Payload
        Client->>S3: PUT Part 3 Chunk Payload
    end

    Client->>Gateway: Complete Multipart Request (Send array of PartNumbers & ETags)
    Gateway->>S3: Call CompleteMultipartUpload(UploadId, Parts)
    S3-->>Gateway: Success Confirmation
    Gateway-->>Client: Return HTTP 201 Created
```

---

## 4. SHA-256 Deduplication & Deduplication Engine

Before uploading any file larger than 1MB, the client Web Worker computes the SHA-256 hash of the file payload.

```typescript
export async function checkDeduplication(
  workspaceId: string,
  sha256Hash: string
): Promise<{ isDuplicate: boolean; existingFileId?: string }> {
  const existing = await prisma.fileObject.findFirst({
    where: {
      bucket: { workspaceId },
      sha256Hash,
      status: 'PROCESSED',
    },
  });

  if (existing) {
    return { isDuplicate: true, existingFileId: existing.id };
  }
  return { isDuplicate: false };
}
```

If a duplicate file payload is detected within the workspace, the system creates a zero-copy pointer metadata entry without re-uploading duplicate bytes to cloud storage.

---

## 5. Cross-References
- API Presign Endpoints: [10_API_SPECIFICATION.md](file:///c:/Users/Vanrajsinh/Desktop/DevVault/Building-Hub/BucketSpace/context/10_API_SPECIFICATION.md)
- Web Worker Upload Engine: [08_FRONTEND_ARCHITECTURE.md](file:///c:/Users/Vanrajsinh/Desktop/DevVault/Building-Hub/BucketSpace/context/08_FRONTEND_ARCHITECTURE.md)
- Security & Encryption: [12_AUTHORIZATION_SECURITY.md](file:///c:/Users/Vanrajsinh/Desktop/DevVault/Building-Hub/BucketSpace/context/12_AUTHORIZATION_SECURITY.md)
