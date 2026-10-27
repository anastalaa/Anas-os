"use client";

import { useEffect, useState } from "react";
import {
  getSyncSnapshot,
  initializeSyncManager,
  subscribeToSync,
} from "./sync-manager";
import type { SyncSnapshot } from "./types";

export function useSyncStatus(): SyncSnapshot {
  const [state, setState] = useState<SyncSnapshot>(() => getSyncSnapshot());

  useEffect(() => {
    initializeSyncManager();
    return subscribeToSync(setState);
  }, []);

  return state;
}
