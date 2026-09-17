import { mutate } from "swr";
import useSWRSubscription, {
  type SWRSubscriptionOptions,
} from "swr/subscription";
import { api, API_URL } from "./api";

/**
 * Live question feed.
 *
 * The backend broadcasts lifecycle events over `/api/questions/feed/ws` so a
 * solver's list doesn't go stale while they read it — without this, two
 * solvers race for a lock that one of them can no longer win.
 *
 * The socket carries *notifications*, not state: an event tells us which keys
 * are now wrong, and SWR re-reads them. Trying to patch the cache from the
 * event payload would quietly drift from the server, which is the one thing
 * the lock flow cannot tolerate.
 */

export type FeedEvent =
  | "QUESTION_CREATED"
  | "QUESTION_LOCKED"
  | "QUESTION_UNLOCKED"
  | "QUESTION_OVERRIDDEN"
  | "QUESTION_EXPIRED"
  | "QUESTION_ANSWERED";

export type FeedMessage = {
  event: FeedEvent;
  data: { questionId?: number; solverId?: string };
  ts: number;
};

/** Which cached resources each event invalidates. */
const AFFECTED: Record<FeedEvent, string[]> = {
  QUESTION_CREATED: ["questions", "questions-infinite"],
  QUESTION_LOCKED: ["questions", "questions-infinite", "question", "solver"],
  QUESTION_UNLOCKED: ["questions", "questions-infinite", "question", "solver"],
  QUESTION_OVERRIDDEN: [
    "questions",
    "questions-infinite",
    "question",
    "solver",
  ],
  QUESTION_EXPIRED: ["questions", "questions-infinite", "question"],
  QUESTION_ANSWERED: ["questions", "questions-infinite", "question", "solver"],
};

function revalidatePrefixes(prefixes: string[]) {
  return mutate(
    (key) => Array.isArray(key) && prefixes.includes(key[0] as string),
    undefined,
    { revalidate: true },
  );
}

/**
 * Subscribes to the feed while `enabled` is true. Pass `false` for guests and
 * students — the endpoint requires the solver `question:claim` permission, so
 * connecting without it just yields a rejected upgrade.
 *
 * Returns the most recent event, which callers can use as a "something
 * changed" tick; the revalidation happens regardless.
 */
export function useFeedSubscription(enabled: boolean) {
  return useSWRSubscription(
    enabled ? (["feed", "ws"] as const) : null,
    (_key, { next }: SWRSubscriptionOptions<FeedMessage, Error>) => {
      let socket: WebSocket | null = null;
      let retry = 0;
      let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
      let closed = false;

      const connect = () => {
        if (closed) return;

        try {
          socket = api.api.questions.feed.ws.$ws();
        } catch (err) {
          next(err as Error);
          return;
        }

        socket.onopen = () => {
          retry = 0;
        };

        socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data as string) as FeedMessage;
            if (!message?.event) return;
            next(null, message);
            void revalidatePrefixes(AFFECTED[message.event] ?? ["questions"]);
          } catch {
            // A frame we can't parse is not worth tearing the socket down for.
          }
        };

        // `onerror` gives no useful detail in browsers; the close handler is
        // what actually drives reconnection, so errors are left to it.
        socket.onclose = () => {
          if (closed) return;
          // Exponential backoff, capped — a backend restart shouldn't turn
          // into a reconnect storm from every open tab.
          const delay = Math.min(1000 * 2 ** retry, 30_000);
          retry += 1;
          reconnectTimer = setTimeout(connect, delay);
        };
      };

      connect();

      return () => {
        closed = true;
        if (reconnectTimer) clearTimeout(reconnectTimer);
        socket?.close();
      };
    },
  );
}
