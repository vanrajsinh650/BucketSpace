# Client State Management (16_STATE_MANAGEMENT.md)

## 1. Executive Summary & State Taxonomy
State management in **BucketSpace** (`apps/web`) is divided cleanly into **Server State** (managed by TanStack Query v5) and **Client Local State** (managed by Zustand v4).

---

## 2. State Classification Matrix

| State Type | Primary Technology | Purpose & Scope | Lifecycle |
|---|---|---|---|
| **Server Metadata State** | TanStack Query v5 | Bucket lists, file trees, vector search results, presigned URLs. | Cached with `staleTime: 30s`. Auto-invalidated on WebSocket events. |
| **Workspace Selection UI** | Zustand (`useSelectionStore`) | Active file selections, multiselect box bounds, active preview modal. | Volatile per session. |
| **Direct Upload Progress** | Zustand (`useUploadStore`) | Active upload tasks, chunk ETA calculations, paused status. | Persisted to `localStorage` until completed. |
| **Theme & Preferences** | Zustand (`usePreferenceStore`) | Dark/light theme, grid/list view mode, tree sidebar width. | Persisted to `localStorage`. |

---

## 3. Zustand Upload Progress Store Blueprint

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ActiveUploadTask {
  fileId: string;
  filename: string;
  totalSizeBytes: number;
  uploadedBytes: number;
  status: 'PENDING' | 'UPLOADING' | 'PAUSED' | 'COMPLETED' | 'ERROR';
  progressPercentage: number;
}

interface UploadState {
  tasks: Record<string, ActiveUploadTask>;
  addUploadTask: (task: ActiveUploadTask) => void;
  updateUploadProgress: (fileId: string, uploadedBytes: number) => void;
  markTaskComplete: (fileId: string) => void;
}

export const useUploadStore = create<UploadState>()(
  persist(
    (set) => ({
      tasks: {},
      addUploadTask: (task) =>
        set((state) => ({ tasks: { ...state.tasks, [task.fileId]: task } })),
      updateUploadProgress: (fileId, uploadedBytes) =>
        set((state) => {
          const existing = state.tasks[fileId];
          if (!existing) return state;
          const progressPercentage = Math.min(
            100,
            Math.round((uploadedBytes / existing.totalSizeBytes) * 100)
          );
          return {
            tasks: {
              ...state.tasks,
              [fileId]: { ...existing, uploadedBytes, progressPercentage },
            },
          };
        }),
      markTaskComplete: (fileId) =>
        set((state) => {
          const newTasks = { ...state.tasks };
          delete newTasks[fileId];
          return { tasks: newTasks };
        }),
    }),
    { name: 'bucketspace-upload-tasks' }
  )
);
```

---

## 4. TanStack Query Optimistic Invalidation Pattern

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useDeleteFileMutation(bucketId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (fileId: string) => {
      await fetch(`/api/v1/files/${fileId}`, { method: 'DELETE' });
    },
    // Optimistic Cache Update
    onMutate: async (deletedFileId: string) => {
      await queryClient.cancelQueries({ queryKey: ['files', bucketId] });
      const previousFiles = queryClient.getQueryData(['files', bucketId]);

      queryClient.setQueryData(['files', bucketId], (old: any) =>
        old ? old.filter((f: any) => f.id !== deletedFileId) : []
      );

      return { previousFiles };
    },
    onError: (_err, _fileId, context) => {
      if (context?.previousFiles) {
        queryClient.setQueryData(['files', bucketId], context.previousFiles);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['files', bucketId] });
    },
  });
}
```

---

## 5. Cross-References
- Frontend Architecture: [08_FRONTEND_ARCHITECTURE.md](file:///c:/Users/Vanrajsinh/Desktop/DevVault/Building-Hub/BucketSpace/context/08_FRONTEND_ARCHITECTURE.md)
- Real-Time Sync Architecture: [15_SYNC_ARCHITECTURE.md](file:///c:/Users/Vanrajsinh/Desktop/DevVault/Building-Hub/BucketSpace/context/15_SYNC_ARCHITECTURE.md)
- Design System Integration: [18_DESIGN_SYSTEM.md](file:///c:/Users/Vanrajsinh/Desktop/DevVault/Building-Hub/BucketSpace/context/18_DESIGN_SYSTEM.md)
