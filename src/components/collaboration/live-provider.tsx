"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Socket } from "socket.io-client";

/**
 * Live updates for the whole app (docs/collaboration-plan.md §12): a socket.io connection when the
 * realtime server is configured and reachable, polling /api/live otherwise. Either way the counts
 * come from Postgres; socket events only say "something changed" (or carry a new chat message).
 */

export type LiveCounts = { notificationsUnread: number; messagesUnread: number; pendingRequests: number };
export type LiveEvent =
  | { type: "notify" }
  | { type: "friends" }
  | { type: "message"; conversationId: string; message: { id: string; senderId: string; body: string; createdAt: string } }
  | { type: "read"; conversationId: string }
  | { type: "group_message"; groupId: string; message: { id: string; senderId: string | null; kind: "TEXT" | "SYSTEM"; body: string; createdAt: string } }
  | { type: "group_changed"; groupId: string };
/** "live": socket connected; "polling": no socket (not configured, or reconnecting). */
export type LiveStatus = "connecting" | "live" | "polling";

type Live = {
  counts: LiveCounts;
  status: LiveStatus;
  /** Listen to socket events (an open chat uses this); returns the unsubscribe function. */
  subscribe: (listener: (event: LiveEvent) => void) => () => void;
  /** Refetch the counts now (after the user's own actions). */
  refresh: () => void;
};

const empty: LiveCounts = { notificationsUnread: 0, messagesUnread: 0, pendingRequests: 0 };
const LiveContext = createContext<Live>({ counts: empty, status: "polling", subscribe: () => () => {}, refresh: () => {} });
export const useLive = () => useContext(LiveContext);

type TokenResponse = { enabled: false } | { enabled: true; url: string; token: string };
const fetchToken = async (): Promise<TokenResponse> => {
  const response = await fetch("/api/realtime/token", { cache: "no-store" });
  return response.ok ? response.json() : { enabled: false };
};

export function LiveProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const listeners = useRef(new Set<(event: LiveEvent) => void>());

  const countsQuery = useQuery({
    queryKey: ["live"],
    queryFn: async (): Promise<LiveCounts> => {
      const response = await fetch("/api/live", { cache: "no-store" });
      if (!response.ok) throw new Error("live");
      return response.json();
    },
    // With a socket, events drive refetches and this is only a safety net.
    refetchInterval: status === "live" ? 60_000 : 20_000,
    refetchOnWindowFocus: true,
    staleTime: 5_000,
  });

  useEffect(() => {
    let socket: Socket | null = null;
    let cancelled = false;
    void (async () => {
      const first = await fetchToken().catch((): TokenResponse => ({ enabled: false }));
      if (cancelled) return;
      if (!first.enabled) { setStatus("polling"); return; }
      const { io } = await import("socket.io-client");
      if (cancelled) return;
      let initial: string | null = first.token;
      socket = io(first.url, {
        transports: ["websocket"],
        reconnectionDelayMax: 10_000,
        // Each (re)connection proves who we are with a fresh short-lived token.
        auth: (callback) => {
          if (initial) { callback({ token: initial }); initial = null; return; }
          void fetchToken().then((next) => callback({ token: next.enabled ? next.token : "" })).catch(() => callback({ token: "" }));
        },
      });
      socket.on("connect", () => setStatus("live"));
      socket.on("disconnect", () => setStatus("polling"));
      socket.on("connect_error", () => setStatus("polling"));
      socket.on("event", (event: LiveEvent) => {
        void queryClient.invalidateQueries({ queryKey: ["live"] });
        if (event.type === "notify") for (const key of ["notifications", "shares", "friends"]) void queryClient.invalidateQueries({ queryKey: [key] });
        if (event.type === "friends") for (const key of ["friends", "conversations", "notifications"]) void queryClient.invalidateQueries({ queryKey: [key] });
        if (event.type === "message" || event.type === "read") void queryClient.invalidateQueries({ queryKey: ["conversations"] });
        if (event.type === "group_message") void queryClient.invalidateQueries({ queryKey: ["groups"] });
        if (event.type === "group_changed") for (const key of ["groups", "group"]) void queryClient.invalidateQueries({ queryKey: [key] });
        listeners.current.forEach((listener) => listener(event));
      });
    })();
    return () => { cancelled = true; socket?.close(); };
  }, [queryClient]);

  const subscribe = useCallback((listener: (event: LiveEvent) => void) => {
    listeners.current.add(listener);
    return () => { listeners.current.delete(listener); };
  }, []);
  const refresh = useCallback(() => { void queryClient.invalidateQueries({ queryKey: ["live"] }); }, [queryClient]);

  const value = useMemo(() => ({ counts: countsQuery.data ?? empty, status, subscribe, refresh }), [countsQuery.data, status, subscribe, refresh]);
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}
