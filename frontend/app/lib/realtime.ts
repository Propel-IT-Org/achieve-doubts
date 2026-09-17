import { useEffect, useRef, useSyncExternalStore } from "react";
import useSWRSubscription, {
  type SWRSubscriptionOptions,
} from "swr/subscription";
// Type-only, like AppType: the event contract lives with the backend.
import type { FeedEvent, FeedMessage } from "@achieve/doubts-backend";
import { api } from "./api";

export type { FeedEvent, FeedMessage };

/**
 * Live question feed, for signed-in users on the questions page: solvers
 * waiting to lock a question the moment it arrives, and students watching
 * theirs move.
 *
 * The socket carries *notifications*, not state: an event names a question,
 * and the list re-reads it from the API. Patching from the event payload
 * would drift from the server, which the lock flow can't tolerate.
 */

// ---------- connection status ----------

export type FeedStatus = "off" | "connecting" | "live";

let status: FeedStatus = "off";
const statusListeners = new Set<() => void>();

function setStatus(next: FeedStatus) {
  if (status === next) return;
  status = next;
  for (const notify of statusListeners) notify();
}

export function useFeedStatus(): FeedStatus {
  return useSyncExternalStore(
    (notify) => {
      statusListeners.add(notify);
      return () => statusListeners.delete(notify);
    },
    () => status,
    () => "off",
  );
}

// ---------- event listeners ----------

const eventListeners = new Set<(message: FeedMessage) => void>();

/** Calls `handler` for every feed event while the component is mounted. */
export function useFeedEvent(handler: (message: FeedMessage) => void) {
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    const listener = (message: FeedMessage) => ref.current(message);
    eventListeners.add(listener);
    return () => {
      eventListeners.delete(listener);
    };
  }, []);
}

// ---------- scheduling ----------

const scheduled = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Coalesces a burst into one call and spreads calls out across clients: an
 * event reaches every connected client at the same instant, and without the
 * jitter they would all hit the API in the same millisecond.
 */
export function runSoon(id: string, run: () => unknown) {
  if (scheduled.has(id)) return;
  const delay = 100 + Math.random() * 600;
  scheduled.set(
    id,
    setTimeout(() => {
      scheduled.delete(id);
      void run();
    }, delay),
  );
}

// ---------- the socket ----------

function subscribe(
  _key: unknown,
  { next }: SWRSubscriptionOptions<FeedMessage, Error>,
) {
  let socket: WebSocket | null = null;
  let retry = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;

  const connect = () => {
    if (closed) return;
    setStatus("connecting");

    try {
      socket = api.api.questions.feed.ws.$ws();
    } catch (err) {
      next(err as Error);
      return;
    }

    socket.onopen = () => {
      retry = 0;
      setStatus("live");
    };

    socket.onmessage = (event) => {
      let message: FeedMessage;
      try {
        message = JSON.parse(event.data as string) as FeedMessage;
      } catch {
        return; // A frame we can't parse isn't worth dropping the socket for.
      }
      if (!message?.event || !message.data?.questionId) return;

      next(null, message);
      for (const listener of eventListeners) listener(message);
    };

    // `onerror` carries no detail in browsers; the close handler is what
    // drives reconnection.
    socket.onclose = () => {
      if (closed) return;
      setStatus("connecting");
      // Exponential backoff with jitter, capped — a backend restart
      // shouldn't turn into a synchronized reconnect storm.
      const delay = Math.min(1000 * 2 ** retry, 30_000) * (0.5 + Math.random());
      retry += 1;
      reconnectTimer = setTimeout(connect, delay);
    };
  };

  connect();

  return () => {
    closed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    socket?.close();
    setStatus("off");
  };
}

/**
 * Holds the feed socket open while mounted and `userId` is set. Keyed on the
 * user, so signing in as someone else reconnects with the new session
 * cookie. Returns the latest event.
 */
export function useLiveFeed(userId: string | null | undefined) {
  return useSWRSubscription(userId ? ["feed", userId] : null, subscribe, {
    // A subscription has no fetcher, so there is nothing to suspend on.
    suspense: false,
  });
}
