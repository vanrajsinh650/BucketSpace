# API Specification & Webhook Contracts (10_API_SPECIFICATION.md)

## 1. Executive Summary & Protocol Standards
All **BucketSpace** APIs adhere to strict RESTful conventions, JSON request/response formats, RFC 7807 problem details error objects, and OpenAPI 3.0 specifications. Real-time updates utilize WebSocket protocols with JSON-encoded event frames.

---

## 2. API Endpoint Matrix

| Method | Endpoint Path | Description | Authorization |
|---|---|---|---|
| `POST` | `/api/v1/auth/token` | Issue JWT bearer token via OAuth2 authorization code | Public |
| `GET` | `/api/v1/workspaces` | List accessible workspaces for authenticated user | Bearer JWT |
| `GET` | `/api/v1/workspaces/:wsId/buckets` | List all registered storage buckets in workspace | Workspace Member |
| `POST` | `/api/v1/workspaces/:wsId/buckets` | Register new cloud storage bucket credentials | Admin / Owner |
| `GET` | `/api/v1/buckets/:bucketId/files` | List object files in bucket (with prefix filtering) | Workspace Viewer |
| `POST` | `/api/v1/files/upload/presign` | Request direct S3/R2 presigned multipart URLs | Workspace Editor |
| `POST` | `/api/v1/files/upload/complete` | Confirm completed multipart upload and trigger indexing | Workspace Editor |
| `GET` | `/api/v1/files/:fileId/presign-download` | Get presigned download URL for object preview | Workspace Viewer |
| `DELETE`| `/api/v1/files/:fileId` | Soft delete object and remove from vector search | Workspace Editor |
| `POST` | `/api/v1/search/hybrid` | Execute hybrid exact keyword + vector semantic query | Workspace Viewer |

---

## 3. Core Request / Response Specifications

### 3.1 Presigned Upload Initiation (`POST /api/v1/files/upload/presign`)

#### Request Payload
```json
{
  "bucketId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "s3Key": "renders/2026/product_banner_4k.png",
  "filename": "product_banner_4k.png",
  "sizeBytes": 524288000,
  "mimeType": "image/png",
  "sha256Hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}
```

#### Response Payload (HTTP 200 OK)
```json
{
  "fileId": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
  "uploadId": "s3-multipart-upload-id-998877",
  "partSizeBytes": 8388608,
  "parts": [
    {
      "partNumber": 1,
      "presignedUrl": "https://my-bucket.s3.us-east-1.amazonaws.com/renders/2026/product_banner_4k.png?uploadId=s3-multipart-upload-id-998877&partNumber=1&X-Amz-Signature=..."
    },
    {
      "partNumber": 2,
      "presignedUrl": "https://my-bucket.s3.us-east-1.amazonaws.com/renders/2026/product_banner_4k.png?uploadId=s3-multipart-upload-id-998877&partNumber=2&X-Amz-Signature=..."
    }
  ]
}
```

---

### 3.2 Hybrid Vector Search Query (`POST /api/v1/search/hybrid`)

#### Request Payload
```json
{
  "workspaceId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "queryText": "dark blue futuristic architectural rendering",
  "limit": 20,
  "filters": {
    "mimeTypes": ["image/png", "image/jpeg", "image/webp"],
    "minSizeBytes": 1048576,
    "createdAfter": "2026-01-01T00:00:00Z"
  }
}
```

#### Response Payload (HTTP 200 OK)
```json
{
  "totalMatches": 42,
  "executionTimeMs": 34,
  "results": [
    {
      "fileId": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
      "filename": "futuristic_building_render_v2.png",
      "s3Key": "architecture/futuristic_building_render_v2.png",
      "bucketName": "studio-assets-prod",
      "provider": "CLOUDFLARE_R2",
      "mimeType": "image/png",
      "sizeBytes": 14589204,
      "similarityScore": 0.8942,
      "thumbnailPresignedUrl": "https://r2.bucketspace.io/thumbnails/a1b2c3d4.webp?token=..."
    }
  ]
}
```

---

## 4. Real-Time WebSocket Protocol

WebSocket connection endpoint: `wss://api.bucketspace.io/v1/ws?token={JWT_TOKEN}`

```typescript
// WebSocket Event Frame Contract
export interface WSEventFrame<T = unknown> {
  event: 'FILE_UPLOADED' | 'FILE_DELETED' | 'USER_PRESENCE_UPDATED' | 'SYNC_PROGRESS';
  workspaceId: string;
  timestamp: string;
  payload: T;
}
```

---

## 5. Cross-References
- Database Schema: [09_DATABASE.md](file:///c:/Users/Vanrajsinh/Desktop/DevVault/Building-Hub/BucketSpace/context/09_DATABASE.md)
- Authorization & Security Rules: [12_AUTHORIZATION_SECURITY.md](file:///c:/Users/Vanrajsinh/Desktop/DevVault/Building-Hub/BucketSpace/context/12_AUTHORIZATION_SECURITY.md)
- Error Handling Formats: [21_ERROR_HANDLING.md](file:///c:/Users/Vanrajsinh/Desktop/DevVault/Building-Hub/BucketSpace/context/21_ERROR_HANDLING.md)
