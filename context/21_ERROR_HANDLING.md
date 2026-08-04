# Universal Error Handling Architecture (21_ERROR_HANDLING.md)

## 1. Executive Summary & Philosophy
**BucketSpace** enforces a unified, typed error taxonomy across all backend microservices, storage adapters, background workers, and React UI components. Errors are never swallowed silently; they are mapped to standard RFC 7807 problem details response frames and logged with trace IDs.

---

## 2. Universal Error Code Taxonomy

| Standard Error Code | HTTP Status | Description & User Action |
|---|---|---|
| `VALIDATION_ERROR` | `400 Bad Request` | Invalid payload format or missing required Zod fields. |
| `UNAUTHORIZED` | `401 Unauthorized` | Missing or expired JWT bearer token. |
| `FORBIDDEN` | `403 Forbidden` | User lacks required RBAC/ABAC role permissions. |
| `FILE_NOT_FOUND` | `404 Not Found` | File object metadata or S3 key does not exist. |
| `STORAGE_PROVIDER_ERROR` | `502 Bad Gateway` | Upstream cloud provider (AWS S3, R2) returned an API error. |
| `PRESIGNED_URL_EXPIRED` | `410 Gone` | Presigned PUT/GET URL expiration timestamp passed. |
| `VECTOR_INDEX_ERROR` | `500 Internal Error` | PostgreSQL `pgvector` HNSW distance query failed. |
| `RATE_LIMIT_EXCEEDED` | `429 Too Many Requests` | User exceeded bucket operation token bucket limits. |

---

## 3. Custom Application Error Hierarchy

```typescript
// Custom Base Domain Error Class
export class AppError extends Error {
  constructor(
    public readonly errorCode: string,
    message: string,
    public readonly statusCode: number = 500,
    public readonly details: unknown = null
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class StorageProviderError extends AppError {
  constructor(providerName: string, originalMessage: string) {
    super(
      'STORAGE_PROVIDER_ERROR',
      `Upstream storage provider (${providerName}) failed: ${originalMessage}`,
      502
    );
  }
}
```

---

## 4. Exponential Backoff & Retry Logic

Network calls to cloud object stores or vector embedding services execute using a jittered exponential backoff policy:

```typescript
export async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 200
): Promise<T> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      if (attempt >= maxRetries) throw error;
      const jitter = Math.random() * 100;
      const delay = Math.pow(2, attempt) * baseDelayMs + jitter;
      await new Promise((res) => setTimeout(res, delay));
    }
  }
  throw new Error('Unreachable backoff state');
}
```

---

## 5. Cross-References
- Backend Architecture: [07_BACKEND_ARCHITECTURE.md](file:///c:/Users/Vanrajsinh/Desktop/DevVault/Building-Hub/BucketSpace/context/07_BACKEND_ARCHITECTURE.md)
- Logging Specifications: [22_LOGGING.md](file:///c:/Users/Vanrajsinh/Desktop/DevVault/Building-Hub/BucketSpace/context/22_LOGGING.md)
- API Specs: [10_API_SPECIFICATION.md](file:///c:/Users/Vanrajsinh/Desktop/DevVault/Building-Hub/BucketSpace/context/10_API_SPECIFICATION.md)
