import type { ServerWebSocket } from "bun";
import {
	type BunWebSocketData,
	createBunWebSocket,
	getBunServer,
} from "hono/bun";
import { createSubscriber, getRedis } from "../lib/redis";

export type WSFeedEvent =
	| "QUESTION_CREATED"
	| "QUESTION_LOCKED"
	| "QUESTION_UNLOCKED"
	| "QUESTION_OVERRIDDEN"
	| "QUESTION_EXPIRED"
	| "QUESTION_ANSWERED";

/** Redis channel carrying feed events between backend instances. */
const FEED_CHANNEL = "doubts:feed";

const { upgradeWebSocket, websocket } =
	createBunWebSocket<ServerWebSocket<BunWebSocketData>>();

/**
 * The publish surface we actually use. Bun's `Server` and `ServerWebSocket`
 * both expose `publish`, and the DI scope hands us the server — this type
 * says what we rely on instead of asserting a socket we don't have.
 */
type PublishTarget = {
	publish?: (topic: string, data: string) => unknown;
};

let relayStarted = false;

/**
 * Bridges Redis pub/sub into this process's local WebSocket topic.
 *
 * Bun's topic publish only reaches sockets held by THIS process, so with more
 * than one replica a lock taken on instance A would never reach a solver
 * connected to instance B. Every instance therefore publishes to Redis and
 * relays whatever it receives to its own subscribers.
 *
 * Idempotent, and started from the first WebSocket subscription because that
 * is the earliest point where the Bun server handle is available.
 */
function ensureFeedRelay(target: PublishTarget | undefined) {
	if (relayStarted || !target?.publish) return;

	const subscriber = createSubscriber();
	// Single-instance: local publish already reaches every connected client.
	if (!subscriber) return;

	relayStarted = true;

	subscriber
		.subscribe(FEED_CHANNEL, (message: string) => {
			target.publish?.(FeedHub.FEED_TOPIC, message);
		})
		.catch((err: unknown) => {
			relayStarted = false;
			console.error("[feed] Redis subscribe failed", err);
		});
}

/**
 * Pub/sub for the live question feed.
 *
 * Fan-out is Redis-backed when REDIS_URL is set and process-local otherwise,
 * so the same interface covers both a single box and N replicas.
 */
export class FeedHub {
	static FEED_TOPIC = "questions:feed";

	// In request scope this is the Bun *server* (publish is a server-level
	// method); `subscribe`/`unsubscribe` are handed the actual socket by the
	// router. Absent in tests/mock-fetch mode.
	constructor(private ws: ServerWebSocket<BunWebSocketData>) {}

	subscribe(socket?: ServerWebSocket<BunWebSocketData>) {
		ensureFeedRelay(this.ws as PublishTarget | undefined);
		const target = socket ?? this.ws;
		target?.subscribe?.(FeedHub.FEED_TOPIC);
	}

	unsubscribe(socket?: ServerWebSocket<BunWebSocketData>) {
		const target = socket ?? this.ws;
		if (target?.isSubscribed?.(FeedHub.FEED_TOPIC)) {
			target.unsubscribe(FeedHub.FEED_TOPIC);
		}
	}

	broadcast(event: WSFeedEvent, data: Record<string, unknown>) {
		const payload = JSON.stringify({ event, data, ts: Date.now() });
		const redis = getRedis();

		if (redis) {
			// Redis echoes a publish to EVERY subscriber, this instance
			// included, and the relay above turns that back into a local
			// publish. Publishing locally here as well would deliver the event
			// twice to our own clients.
			redis.publish(FEED_CHANNEL, payload).catch((err: unknown) => {
				console.error("[feed] Redis publish failed", err);
			});
			return;
		}

		(this.ws as PublishTarget | undefined)?.publish?.(
			FeedHub.FEED_TOPIC,
			payload,
		);
	}
}

export const getServer = getBunServer<ServerWebSocket<BunWebSocketData>>;
export { upgradeWebSocket, websocket };
