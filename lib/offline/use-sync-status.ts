"use client";

import { useEffect, useState } from "react";
import {
  getSyncSnapshot,
  initializeSyncManager,
  subscribeToSync,
} from "./sync-manager";
import type { SyncSnapshot } from "./types";

export function useSyncStatus(userId: string): SyncSnapshot {
  const [state, setState] = useState<SyncSnapshot>(() => getSyncSnapshot());

  useEffect(() => {
    initializeSyncManager(userId);
    return subscribeToSync(setState);
  }, [userId]);

  return state;
}
