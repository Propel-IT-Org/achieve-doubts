import type { ServerWebSocket } from "bun";
import { createBunWebSocket } from "hono/bun";

export const FEED_TOPIC = "doubts:feed";

export type WSFeedEvent =
	| "DOUBT_CREATED"
	| "DOUBT_LOCKED"
	| "DOUBT_UNLOCKED"
	| "DOUBT_RESOLVED";

export type WSClientData = {
	userId?: string;
	role?: string;
};

const { upgradeWebSocket, websocket } = createBunWebSocket<ServerWebSocket>();

class FeedHub {
	private sockets = new Set<ServerWebSocket>();

	add(ws: ServerWebSocket) {
		this.sockets.add(ws);
		try {
			ws.subscribe(FEED_TOPIC);
		} catch {
			// fallback if subscribe isn't supported
		}
	}

	remove(ws: ServerWebSocket) {
		this.sockets.delete(ws);
		try {
			ws.unsubscribe(FEED_TOPIC);
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

		for (const ws of this.sockets) {
			try {
				ws.send(payload);
			} catch {
				this.sockets.delete(ws);
			}
		}
	}

	getActiveCount() {
		return this.sockets.size;
	}
}

export const feedHub = new FeedHub();
export { upgradeWebSocket, websocket };
