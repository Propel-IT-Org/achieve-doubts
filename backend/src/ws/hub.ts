import type { ServerWebSocket } from "bun";
import {
	type BunWebSocketData,
	createBunWebSocket,
	getBunServer,
} from "hono/bun";

export type WSFeedEvent =
	| "QUESTION_CREATED"
	| "QUESTION_LOCKED"
	| "QUESTION_UNLOCKED"
	| "QUESTION_OVERRIDDEN"
	| "QUESTION_EXPIRED"
	| "QUESTION_ANSWERED";

const { upgradeWebSocket, websocket } =
	createBunWebSocket<ServerWebSocket<BunWebSocketData>>();

/**
 * Single-process pub/sub over Bun's native WebSocket topics. Multi-instance
 * fan-out would need Redis behind this same interface — the surface here is
 * deliberately narrow (subscribe/unsubscribe/broadcast) so that swap stays
 * a one-file change.
 */
export class FeedHub {
	static FEED_TOPIC = "questions:feed";

	constructor(private ws: ServerWebSocket<BunWebSocketData>) {}

	subscribe(socket?: ServerWebSocket<BunWebSocketData>) {
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
		// `this.ws` is the Bun server in request scope (publish is a
		// server-level method); in tests/mock-fetch mode it's absent.
		this.ws?.publish?.(FeedHub.FEED_TOPIC, payload);
	}
}

export const getServer = getBunServer<ServerWebSocket<BunWebSocketData>>;
export { upgradeWebSocket, websocket };
