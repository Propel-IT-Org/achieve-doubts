import type { ServerWebSocket } from "bun";
import {
	type BunWebSocketData,
	createBunWebSocket,
	getBunServer,
} from "hono/bun";
import { createSubscriber, getRedis } from "../lib/redis";

/**
 * Everything a viewer can see change on a question. Events carry ids only —
 * clients re-read what they're allowed to see, so the socket never carries
 * content a subscriber couldn't fetch themselves.
 */
export type FeedEvent =
	| "QUESTION_CREATED"
	| "QUESTION_LOCKED"
	| "QUESTION_UNLOCKED"
	| "QUESTION_OVERRIDDEN"
	| "QUESTION_EXPIRED"
	| "QUESTION_ANSWERED"
	| "QUESTION_RATED"
	| "QUESTION_DELETED"
	| "SOLUTION_DELETED"
	| "THREAD_CHANGED"
	| "COMMENTS_CHANGED";

export type FeedMessage = {
	event: FeedEvent;
	data: { questionId: number; solverId?: string };
	ts: number;
};

/** Redis channel carrying feed events between backend instances. */
const FEED_CHANNEL = "doubts:feed";
const FEED_TOPIC = "questions:feed";

const { upgradeWebSocket, websocket } =
	createBunWebSocket<ServerWebSocket<BunWebSocketData>>();

/**
 * The publish surface we actually use. Bun's `Server` exposes `publish`, and
 * the DI scope hands us the server — this type says what we rely on instead
 * of asserting a socket we don't have.
 */
type PublishTarget = {
	publish?: (topic: string, data: string) => unknown;
};

/**
 * This process's Bun server, remembered from the first request scope. Every
 * WebSocket client arrived through a request, so by the time anyone can
 * receive an event this is set — which is what lets background jobs (the
 * lock sweeper) publish without a request of their own.
 */
let localTarget: PublishTarget | undefined;
let relayStarted = false;

/**
 * Bridges Redis pub/sub into this process's local WebSocket topic.
 *
 * Bun's topic publish only reaches sockets held by THIS process, so with more
 * than one replica a lock taken on instance A would never reach a client
 * connected to instance B. Every instance therefore publishes to Redis and
 * relays whatever it receives to its own subscribers.
 */
function ensureFeedRelay() {
	if (relayStarted || !localTarget) return;

	const subscriber = createSubscriber();
	// Single-instance: local publish already reaches every connected client.
	if (!subscriber) return;

	relayStarted = true;

	subscriber
		.subscribe(FEED_CHANNEL, (message: string) => {
			localTarget?.publish?.(FEED_TOPIC, message);
		})
		.catch((err: unknown) => {
			relayStarted = false;
			console.error("[feed] Redis subscribe failed", err);
		});
}

/** Publishes one event to every connected client, on every replica. */
export function publishFeed(event: FeedEvent, data: FeedMessage["data"]) {
	const payload = JSON.stringify({
		event,
		data,
		ts: Date.now(),
	} satisfies FeedMessage);
	const redis = getRedis();

	if (redis) {
		// Redis echoes a publish to EVERY subscriber, this instance included,
		// and the relay above turns that back into a local publish. Publishing
		// locally as well would deliver the event twice to our own clients.
		redis.publish(FEED_CHANNEL, payload).catch((err: unknown) => {
			console.error("[feed] Redis publish failed", err);
		});
		return;
	}

	localTarget?.publish?.(FEED_TOPIC, payload);
}

/**
 * Request-scoped handle on the live feed. Fan-out is Redis-backed when
 * REDIS_URL is set and process-local otherwise, so the same interface covers
 * both a single box and N replicas.
 */
export class FeedHub {
	// In request scope this is the Bun *server*; absent in tests.
	constructor(server?: ServerWebSocket<BunWebSocketData>) {
		const target = server as PublishTarget | undefined;
		if (target?.publish) localTarget ??= target;
	}

	// `ws.raw` is typed optional by Hono's adapter; it is always set on Bun.
	subscribe(socket?: ServerWebSocket<BunWebSocketData>) {
		ensureFeedRelay();
		socket?.subscribe(FEED_TOPIC);
	}

	unsubscribe(socket?: ServerWebSocket<BunWebSocketData>) {
		if (socket?.isSubscribed(FEED_TOPIC)) socket.unsubscribe(FEED_TOPIC);
	}

	broadcast(event: FeedEvent, data: FeedMessage["data"]) {
		publishFeed(event, data);
	}
}

export const getServer = getBunServer<ServerWebSocket<BunWebSocketData>>;
export { upgradeWebSocket, websocket };
