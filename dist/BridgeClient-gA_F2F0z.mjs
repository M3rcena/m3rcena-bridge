import { t as __require } from "./rolldown-runtime-D3PmRqjj.mjs";
import { EventEmitter } from "events";
// src/client/BridgeClient.ts
/**
* @m3rcena/bridge
* Universal Client SDK for Web Dashboards & Applications.
* Works seamlessly in Browsers (React, Next.js, Vue) and Node.js environments.
*
* @copyright 2026 M3rcena Development. All rights reserved.
* @license Apache-2.0
*/
var BridgeClient = class extends EventEmitter {
	options;
	ws = null;
	isConnected = false;
	correlationCounter = 0;
	pendingRequests = /* @__PURE__ */ new Map();
	sessionListeners = /* @__PURE__ */ new Map();
	moduleListeners = /* @__PURE__ */ new Map();
	audioListeners = /* @__PURE__ */ new Set();
	notificationListeners = /* @__PURE__ */ new Set();
	connectionListeners = /* @__PURE__ */ new Set();
	constructor(options) {
		super();
		this.options = {
			autoReconnect: true,
			reconnectDelay: 3e3,
			platform: "dashboard",
			...options
		};
	}
	emit(event, ...args) {
		return super.emit(event, ...args);
	}
	on(event, listener) {
		return super.on(event, listener);
	}
	once(event, listener) {
		return super.once(event, listener);
	}
	off(event, listener) {
		return super.off(event, listener);
	}
	addListener(event, listener) {
		return super.addListener(event, listener);
	}
	removeListener(event, listener) {
		return super.removeListener(event, listener);
	}
	prependListener(event, listener) {
		return super.prependListener(event, listener);
	}
	prependOnceListener(event, listener) {
		return super.prependOnceListener(event, listener);
	}
	/**
	* Connects to the Bridge WebSocket Gateway.
	*/
	async connect() {
		return new Promise((resolve, reject) => {
			let resolved = false;
			let wsUrl = this.options.url;
			if (this.options.token) {
				const delimiter = wsUrl.includes("?") ? "&" : "?";
				wsUrl += `${delimiter}token=${encodeURIComponent(this.options.token)}`;
			}
			let WsConstructor = null;
			if (typeof window !== "undefined" && window.WebSocket) WsConstructor = window.WebSocket;
			else if (typeof globalThis !== "undefined" && globalThis.WebSocket) WsConstructor = globalThis.WebSocket;
			if (!WsConstructor) try {
				const wsModule = __require("ws");
				WsConstructor = wsModule.WebSocket || wsModule;
			} catch {
				return reject(/* @__PURE__ */ new Error("No WebSocket implementation found in current environment"));
			}
			this.ws = new WsConstructor(wsUrl);
			this.ws.onopen = () => {
				this.isConnected = true;
				this.notifyConnection(true);
				if (this.options.userId) this.authenticate(this.options.userId, this.options.username);
				if (!resolved) {
					resolved = true;
					resolve();
				}
			};
			this.ws.onmessage = (event) => {
				try {
					const raw = typeof event.data === "string" ? event.data : event.data.toString();
					const msg = JSON.parse(raw);
					this.handleInboundMessage(msg);
				} catch (err) {
					console.warn("[BridgeClient] Failed to parse message:", err);
				}
			};
			this.ws.onclose = () => {
				this.isConnected = false;
				this.notifyConnection(false);
				if (this.options.autoReconnect) setTimeout(() => this.connect().catch(() => {}), this.options.reconnectDelay);
			};
			this.ws.onerror = (err) => {
				if (!resolved) {
					resolved = true;
					reject(err);
				}
			};
		});
	}
	/**
	* Disconnects from the bridge gateway.
	*/
	disconnect() {
		this.options.autoReconnect = false;
		if (this.ws) {
			try {
				this.ws.close();
			} catch {}
			this.ws = null;
		}
	}
	get connected() {
		return this.isConnected;
	}
	handleInboundMessage(msg) {
		if (msg.correlationId && this.pendingRequests.has(msg.correlationId)) {
			const { resolve } = this.pendingRequests.get(msg.correlationId);
			this.pendingRequests.delete(msg.correlationId);
			resolve(msg.result || msg.data);
			return;
		}
		if (msg.type === "sync" && msg.sessionId) {
			this.emit("stateSync", {
				sessionId: msg.sessionId,
				state: msg.state
			});
			const listeners = this.sessionListeners.get(msg.sessionId);
			if (listeners) for (const cb of listeners) cb(msg.state);
		}
		if (msg.type === "audio_cue") {
			this.emit("audioCue", msg);
			for (const cb of this.audioListeners) cb(msg);
		}
		if (msg.type === "notification") {
			this.emit("notification", msg);
			for (const cb of this.notificationListeners) cb(msg);
		}
		if ((msg.type === "session_start" || msg.type === "session_end") && msg.session?.module) {
			this.emit("moduleEvent", msg);
			const listeners = this.moduleListeners.get(msg.session.module);
			if (listeners) for (const cb of listeners) cb(msg);
		}
	}
	/**
	* Sets presence / authentication on the bridge.
	*/
	authenticate(userId, username, metadata) {
		this.send({
			type: "authenticate",
			userId,
			username,
			platform: this.options.platform,
			metadata
		});
	}
	/**
	* Subscribes to live state updates for a specific match or session.
	*/
	subscribeSession(sessionId, onStateSync) {
		if (!this.sessionListeners.has(sessionId)) {
			this.sessionListeners.set(sessionId, /* @__PURE__ */ new Set());
			this.send({
				type: "subscribe_session",
				sessionId
			});
		}
		this.sessionListeners.get(sessionId).add(onStateSync);
		return () => {
			const listeners = this.sessionListeners.get(sessionId);
			if (listeners) {
				listeners.delete(onStateSync);
				if (listeners.size === 0) {
					this.sessionListeners.delete(sessionId);
					this.send({
						type: "unsubscribe_session",
						sessionId
					});
				}
			}
		};
	}
	/**
	* Subscribes to all session events within a specific module (e.g. "games" or "economy").
	*/
	subscribeModule(module, onEvent) {
		if (!this.moduleListeners.has(module)) {
			this.moduleListeners.set(module, /* @__PURE__ */ new Set());
			this.send({
				type: "subscribe_module",
				module
			});
		}
		this.moduleListeners.get(module).add(onEvent);
		return () => {
			const listeners = this.moduleListeners.get(module);
			if (listeners) {
				listeners.delete(onEvent);
				if (listeners.size === 0) this.moduleListeners.delete(module);
			}
		};
	}
	/**
	* Dispatches an action (e.g. a game move, shop buy, transfer) across the bridge.
	*/
	async dispatchAction(module, sessionId, action, payload) {
		const correlationId = `act_${++this.correlationCounter}_${Date.now()}`;
		return new Promise((resolve, reject) => {
			this.pendingRequests.set(correlationId, {
				resolve,
				reject
			});
			this.send({
				type: "dispatch_action",
				correlationId,
				module,
				sessionId,
				action,
				payload,
				sourcePlatform: this.options.platform
			});
			setTimeout(() => {
				if (this.pendingRequests.has(correlationId)) {
					this.pendingRequests.delete(correlationId);
					reject(/* @__PURE__ */ new Error(`Action timeout for "${action}" on session "${sessionId}"`));
				}
			}, 1e4);
		});
	}
	/**
	* Requests the real-time dashboard overview.
	*/
	async getOverview() {
		const correlationId = `ov_${++this.correlationCounter}_${Date.now()}`;
		return new Promise((resolve, reject) => {
			this.pendingRequests.set(correlationId, {
				resolve,
				reject
			});
			this.send({
				type: "get_overview",
				correlationId
			});
			setTimeout(() => {
				if (this.pendingRequests.has(correlationId)) {
					this.pendingRequests.delete(correlationId);
					reject(/* @__PURE__ */ new Error("Overview request timed out"));
				}
			}, 1e4);
		});
	}
	/**
	* Listens for targeted audio cues dispatched to this user.
	*/
	onAudioCue(callback) {
		this.audioListeners.add(callback);
		return () => this.audioListeners.delete(callback);
	}
	/**
	* Listens for live toast notifications dispatched to this user.
	*/
	onNotification(callback) {
		this.notificationListeners.add(callback);
		return () => this.notificationListeners.delete(callback);
	}
	/**
	* Listens for connection state changes (online/offline).
	*/
	onConnectionChange(callback) {
		this.connectionListeners.add(callback);
		return () => this.connectionListeners.delete(callback);
	}
	notifyConnection(connected) {
		for (const cb of this.connectionListeners) cb(connected);
		this.emit(connected ? "connect" : "disconnect");
	}
	send(data) {
		if (this.ws && this.isConnected) this.ws.send(JSON.stringify(data));
	}
};
/**
* Convenience factory to create a BridgeClient instance.
*/
function createBridgeClient(options) {
	return new BridgeClient(options);
}
export { createBridgeClient as n, BridgeClient as t };

//# sourceMappingURL=BridgeClient-gA_F2F0z.mjs.map