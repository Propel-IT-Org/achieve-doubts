import type { ServerWebSocket } from "bun";
import { createBunWebSocket, type BunWebSocketData, getBunServer  } from "hono/bun";


export type WSFeedEvent =
	| "DOUBT_CREATED"
	| "DOUBT_LOCKED"
	| "DOUBT_UNLOCKED"
	| "DOUBT_RESOLVED";

export type WSClientData = {
	userId?: string;
	role?: string;
};

const { upgradeWebSocket, websocket } = createBunWebSocket<ServerWebSocket<BunWebSocketData>>();

export class FeedHub {
  static FEED_TOPIC = "doubts:feed";

  constructor(private ws: ServerWebSocket<BunWebSocketData>) {

  }

  subscribe() {
		try {
			this.ws.subscribe(FeedHub.FEED_TOPIC);
		} catch {
			// fallback if subscribe isn't supported
    }
	}

	unsubscribe() {
		try {
			if (this.ws.isSubscribed(FeedHub.FEED_TOPIC)) this.ws.unsubscribe(FeedHub.FEED_TOPIC);
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
			this.ws.publish(FeedHub.FEED_TOPIC, payload);
		} catch {
			// ignore
		}
	}
}

export const getServer = getBunServer<ServerWebSocket<BunWebSocketData>>;
export { upgradeWebSocket, websocket };
