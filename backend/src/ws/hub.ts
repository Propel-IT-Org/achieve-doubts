import type { ServerWebSocket } from "bun";
import {
	type BunWebSocketData,
	createBunWebSocket,
	getBunServer,
} from "hono/bun";

export type WSFeedEvent =
	| "DOUBT_CREATED"
	| "DOUBT_LOCKED"
	| "DOUBT_UNLOCKED"
	| "DOUBT_RESOLVED";

export type WSClientData = {
	userId?: string;
	role?: string;
};

const { upgradeWebSocket, websocket } =
	createBunWebSocket<ServerWebSocket<BunWebSocketData>>();

export class FeedHub {
	static FEED_TOPIC = "doubts:feed";

	constructor(private ws: ServerWebSocket<BunWebSocketData>) {}

	subscribe(socket?: ServerWebSocket<BunWebSocketData>) {
		try {
			const target = socket ?? this.ws;
			target?.subscribe?.(FeedHub.FEED_TOPIC);
		} catch {
			// fallback if subscribe isn't supported
		}
	}

	unsubscribe(socket?: ServerWebSocket<BunWebSocketData>) {
		try {
			const target = socket ?? this.ws;
			if (target?.isSubscribed?.(FeedHub.FEED_TOPIC)) {
				target.unsubscribe(FeedHub.FEED_TOPIC);
			}
		} catch {
			// ignore
		}
	}

	broadcast(event: WSFeedEvent, data: Record<string, unknown>) {
		const payload = JSON.stringify({
			event,
			data,
			ts: Date.now(),
		});

		try {
			this.ws?.publish?.(FeedHub.FEED_TOPIC, payload);
		} catch {
			// ignore
		}
	}
}

export const getServer = getBunServer<ServerWebSocket<BunWebSocketData>>;
export { upgradeWebSocket, websocket };