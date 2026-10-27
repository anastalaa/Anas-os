"use client";

import { useEffect, useState } from "react";
import { listAllOperations, SYNC_QUEUE_UPDATED_EVENT } from "./idb";
import type { SyncOperation } from "./types";

export function useSyncOperations(): SyncOperation[] {
  const [operations, setOperations] = useState<SyncOperation[]>([]);

  useEffect(() => {
    let mounted = true;

    const refresh = () => {
      void listAllOperations()
        .then((rows) => {
          if (mounted) setOperations(rows);
        })
        .catch(() => {
          // The Sync Status component displays storage-level errors.
        });
    };

    refresh();
    window.addEventListener(SYNC_QUEUE_UPDATED_EVENT, refresh);
    return () => {
      mounted = false;
      window.removeEventListener(SYNC_QUEUE_UPDATED_EVENT, refresh);
    };
  }, []);

  return operations;
}
