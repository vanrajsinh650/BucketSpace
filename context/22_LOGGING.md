# Structured Logging & Audit Trail Standards (22_LOGGING.md)

## 1. Executive Summary & Logging Philosophy
All application components in **BucketSpace** emit structured JSON logs with mandatory contextual metadata, environment tags, and W3C trace context identifiers. Human-formatted unstructured string output is strictly forbidden in production.

---

## 2. Structured JSON Log Record Schema

```json
{
  "level": "INFO",
  "timestamp": "2026-08-04T10:30:15.123Z",
  "service": "bucketspace-api",
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
  "spanId": "00f067aa0ba902b7",
  "workspaceId": "ws_998877665544",
  "userId": "usr_11223344",
  "event": "FILE_PRESIGNED_UPLOAD_ISSUED",
  "message": "Issued 12 presigned part URLs for S3 object renders/demo.mp4",
  "meta": {
    "bucketId": "bkt_12345",
    "s3Key": "renders/demo.mp4",
    "sizeBytes": 104857600,
    "provider": "AWS_S3"
  }
}
```

---

## 3. PII Redaction & Secret Scrubbing Rules

> [!CAUTION]
> **STRICT LOG REDACTION GUARDRAILS**
> Logging any of the following fields in raw plain text is a severe security violation:
> 1. AWS Secret Access Keys / Cloudflare R2 API Tokens
> 2. JWT Access Tokens / Refresh Tokens
> 3. User Passwords / OAuth Client Secrets
> 4. Credit Card or Payment Information

```typescript
// Fastify Pino Redaction Configuration
export const pinoLoggerOptions = {
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers["x-api-key"]',
      '*.encryptedCredentials',
      '*.secretAccessKey',
      '*.password',
    ],
    censor: '[REDACTED_SECRET]',
  },
};
```

---

## 4. Immutable Audit Trail Logging

Critical domain actions (file deletion, permission changes, credential registration) MUST write an immutable record to the `audit_logs` database table.

```typescript
export async function logAuditEvent(params: {
  workspaceId: string;
  actorUserId: string;
  action: string;
  resource: string;
  ipAddress: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      workspaceId: params.workspaceId,
      actorUserId: params.actorUserId,
      action: params.action,
      resource: params.resource,
      ipAddress: params.ipAddress,
      metadata: (params.metadata as any) || {},
    },
  });
}
```

---

## 5. Cross-References
- Observability & Metrics: [23_OBSERVABILITY.md](file:///c:/Users/Vanrajsinh/Desktop/DevVault/Building-Hub/BucketSpace/context/23_OBSERVABILITY.md)
- Security Architecture: [12_AUTHORIZATION_SECURITY.md](file:///c:/Users/Vanrajsinh/Desktop/DevVault/Building-Hub/BucketSpace/context/12_AUTHORIZATION_SECURITY.md)
- Error Handling Formats: [21_ERROR_HANDLING.md](file:///c:/Users/Vanrajsinh/Desktop/DevVault/Building-Hub/BucketSpace/context/21_ERROR_HANDLING.md)
