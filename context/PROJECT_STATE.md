# BucketSpace Project State & Active Memory (PROJECT_STATE.md)

This document is the **Active Project Memory** for **BucketSpace**. It tracks high-level project goals, active architectural rules, roadmap state, and production-readiness requirements.

When architecture, goals, or rules change, this document MUST be updated, removing deprecated architectural patterns and establishing new baseline decisions.

---

## 1. Core Project Goal & Vision

**BucketSpace V0** is a **local personal storage system** that uses Telegram as the storage backend.

- **Project Model**: 100% Open-Source.
- **V0 Scope**: Local desktop application that can reliably store and retrieve files via Telegram Private Channels.
- **Core Principle**: Telegram is a **StorageProvider adapter**, not the identity of BucketSpace. The architecture must cleanly support future providers (Local Disk, S3, GCP, Azure) without refactoring — but V0 only implements Telegram.

### V0 Completion Bar
A storage system is not complete until the core data path is demonstrated reliably:

> **add file → upload → metadata → close/reopen app → find file → download → verify bytes → recover from interruption → delete/restore**

---

## 2. Active Engineering Behavioral Rules

1. **Automated Git Commit and Push Protocol**:
   - Whenever any task or coding request is completed, automatically stage all changes (`git add .`), commit with a descriptive message, and push to the remote repository (`git push origin <branch>`).
2. **Active Architectural State Maintenance**:
   - Keep `context/PROJECT_STATE.md` and the `/context` documentation hub in sync with all architectural decisions, goal changes, and system rules.
   - Instantly remove deprecated architecture sections when replacement patterns are adopted.
   - Omit casual conversation; retain only technical goals, rules, and architecture specs.
3. **Human-Centric Clean Code & Modular Feature Structure**:
   - Every module must be intuitively grouped by feature functionality so any developer can easily understand the codebase.
   - Code must be clean, readable, self-documenting, and free from AI-style boilerplate bloat or unnecessarily complex abstractions.
4. **Architect-Led Development Workflow**:
   - The user is the architect. They explain what we're building, why, the algorithm, the architecture, alternatives, failure modes, and testing strategy.
   - Antigravity is the implementation agent. No giant prompt dumps. Each significant piece is understood before it is built.
   - Workflow: **Understand → Design → Decide → Implement → Test → Review → Continue**.

---

## 3. V0 Target Architecture

```
                    BUCKETSPACE V0
                          │
                    ┌─────▼─────┐
                    │ Desktop UI │
                    └─────┬─────┘
                          │
                    Local Application
                          │
             ┌────────────┼────────────┐
             │            │            │
          Metadata      Storage      Transfer
           SQLite       Engine        Manager
             │            │            │
             │      ┌─────▼─────┐      │
             │      │ Telegram  │      │
             │      │ Adapter   │      │
             │      └───────────┘      │
             │                         │
             └────────────┬────────────┘
                          │
                    Local File Index
```

### Key Design Decisions
- **Metadata Store**: SQLite (local, no external DB dependency).
- **Storage Engine**: Provider-agnostic interface. V0 implements only Telegram adapter.
- **Transfer Manager**: Handles chunking, upload/download orchestration, interruption recovery.
- **Provider Abstraction**: `StorageProvider` contract designed so future adapters (Local Disk, S3, GCP, Azure) slot in without refactoring.

---

## 4. Current Status

- **Active Phase**: V0 — Local Personal Storage (Architecture Reset).
- **Prior State**: Phases 1–4 codebase exists but was never end-to-end verified against the core data path. Treated as reference material, not proven functionality.
- **Next Step**: Awaiting architect-led design and implementation guidance for V0 foundation.

---

## 5. Security & Reliability Directives
- **Data Integrity**: Every downloaded file must be byte-identical to the uploaded original. Verified via checksums.
- **Interruption Recovery**: Partial uploads/downloads must be resumable. No data loss on crash or network failure.
- **Credentials Protection**: Telegram bot tokens and session data stored securely in local config.
