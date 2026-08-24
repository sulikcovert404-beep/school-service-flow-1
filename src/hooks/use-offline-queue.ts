import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";

export type PendingEvent = {
  idempotencyKey: string;
  serviceId: Id<"services">;
  studentId: Id<"students">;
  eventType: "PICKED_UP" | "DROPPED_OFF";
  clientTimestamp: number;
  attempts: number;
};

const STORAGE_KEY = "driver-pending-events";

function loadQueue(): PendingEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PendingEvent[]) : [];
  } catch {
    return [];
  }
}

function saveQueue(items: PendingEvent[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // storage full/unavailable — queue stays in memory for this session
  }
}

/**
 * Offline-first write queue for the Driver Console.
 *
 * Flow (matches the architecture): driver action → store locally (Pending Sync)
 * → when online → controlled retry with client-generated idempotency key →
 * server dedupes & persists once. A failed flush keeps the item queued.
 */
export function useOfflineQueue() {
  const record = useMutation(api.driverApp.recordEvent);
  const [pending, setPending] = useState<PendingEvent[]>(loadQueue);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [syncing, setSyncing] = useState(false);
  const pendingRef = useRef(pending);
  const syncingRef = useRef(false);
  pendingRef.current = pending;

  const commit = useCallback((next: PendingEvent[]) => {
    pendingRef.current = next;
    setPending(next);
    saveQueue(next);
  }, []);

  const flush = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine || pendingRef.current.length === 0) return;
    syncingRef.current = true;
    setSyncing(true);
    const remaining: PendingEvent[] = [];
    for (const item of [...pendingRef.current]) {
      try {
        await record({
          serviceId: item.serviceId,
          studentId: item.studentId,
          eventType: item.eventType,
          idempotencyKey: item.idempotencyKey,
          clientTimestamp: item.clientTimestamp,
        });
      } catch {
        remaining.push({ ...item, attempts: item.attempts + 1 });
      }
    }
    commit(remaining);
    syncingRef.current = false;
    setSyncing(false);
  }, [record, commit]);

  const enqueue = useCallback(
    (item: Omit<PendingEvent, "attempts">) => {
      commit([...pendingRef.current, { ...item, attempts: 0 }]);
      void flush();
    },
    [commit, flush],
  );

  // Retry when connectivity returns + periodic controlled retry.
  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      void flush();
    };
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    const interval = window.setInterval(() => void flush(), 5000);
    void flush();
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.clearInterval(interval);
    };
  }, [flush]);

  return { pending, isOnline, syncing, enqueue };
}
