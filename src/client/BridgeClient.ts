/**
 * @m3rcena/bridge
 * Universal Client SDK for Web Dashboards & Applications.
 * Works seamlessly in Browsers (React, Next.js, Vue) and Node.js environments.
 *
 * @copyright 2026 M3rcena Development. All rights reserved.
 * @license Apache-2.0
 */

import {
  BridgeAction,
  BridgeActionResult,
  BridgeAudioCue,
  BridgeNotification,
  DashboardOverview,
} from "../types.js";

export interface BridgeClientOptions {
  /** WebSocket Server URL (e.g. "ws://localhost:4000/bridge") */
  url: string;
  /** Secret API token for authentication */
  token?: string;
  /** User ID of the logged-in dashboard user */
  userId?: string;
  /** Username of the logged-in dashboard user */
  username?: string;
  /** Platform identifier (default: "dashboard") */
  platform?: "dashboard" | "web" | "mobile" | "cli";
  /** Automatically reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
  /** Reconnection delay in ms (default: 3000) */
  reconnectDelay?: number;
}

export class BridgeClient {
  public options: BridgeClientOptions;
  private ws: any = null;
  private isConnected = false;
  private correlationCounter = 0;
  private pendingRequests: Map<string, { resolve: (val: any) => void; reject: (err: any) => void }> = new Map();

  // Listeners
  private sessionListeners: Map<string, Set<(state: any) => void>> = new Map();
  private moduleListeners: Map<string, Set<(event: any) => void>> = new Map();
  private audioListeners: Set<(audio: BridgeAudioCue) => void> = new Set();
  private notificationListeners: Set<(notif: BridgeNotification) => void> = new Set();
  private connectionListeners: Set<(connected: boolean) => void> = new Set();

  constructor(options: BridgeClientOptions) {
    this.options = {
      autoReconnect: true,
      reconnectDelay: 3000,
      platform: "dashboard",
      ...options,
    };
  }

  /**
   * Connects to the Bridge WebSocket Gateway.
   */
  public async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      let resolved = false;

      let wsUrl = this.options.url;
      if (this.options.token) {
        const delimiter = wsUrl.includes("?") ? "&" : "?";
        wsUrl += `${delimiter}token=${encodeURIComponent(this.options.token)}`;
      }

      // Universal WebSocket resolution (Browser window.WebSocket or Node 22+ global.WebSocket or ws)
      let WsConstructor: any = null;
      if (typeof window !== "undefined" && (window as any).WebSocket) {
        WsConstructor = (window as any).WebSocket;
      } else if (typeof globalThis !== "undefined" && (globalThis as any).WebSocket) {
        WsConstructor = (globalThis as any).WebSocket;
      }

      if (!WsConstructor) {
        try {
          // Dynamic import fallback for older Node environments
          const wsModule = require("ws");
          WsConstructor = wsModule.WebSocket || wsModule;
        } catch {
          return reject(new Error("No WebSocket implementation found in current environment"));
        }
      }

      this.ws = new WsConstructor(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.notifyConnection(true);

        // Send authentication / presence if userId configured
        if (this.options.userId) {
          this.authenticate(this.options.userId, this.options.username);
        }

        if (!resolved) {
          resolved = true;
          resolve();
        }
      };

      this.ws.onmessage = (event: any) => {
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

        if (this.options.autoReconnect) {
          setTimeout(() => this.connect().catch(() => {}), this.options.reconnectDelay);
        }
      };

      this.ws.onerror = (err: any) => {
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
  public disconnect(): void {
    this.options.autoReconnect = false;
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
  }

  public get connected(): boolean {
    return this.isConnected;
  }

  // --------------------------------------------------------------------------
  // Inbound Message Routing
  // --------------------------------------------------------------------------

  private handleInboundMessage(msg: any): void {
    // 1. Correlated request response
    if (msg.correlationId && this.pendingRequests.has(msg.correlationId)) {
      const { resolve } = this.pendingRequests.get(msg.correlationId)!;
      this.pendingRequests.delete(msg.correlationId);
      resolve(msg.result || msg.data);
      return;
    }

    // 2. State Sync
    if (msg.type === "sync" && msg.sessionId) {
      const listeners = this.sessionListeners.get(msg.sessionId);
      if (listeners) {
        for (const cb of listeners) {
          cb(msg.state);
        }
      }
    }

    // 3. Audio Cue
    if (msg.type === "audio_cue") {
      for (const cb of this.audioListeners) {
        cb(msg);
      }
    }

    // 4. Notification
    if (msg.type === "notification") {
      for (const cb of this.notificationListeners) {
        cb(msg);
      }
    }

    // 5. Session Start / End for module listeners
    if ((msg.type === "session_start" || msg.type === "session_end") && msg.session?.module) {
      const listeners = this.moduleListeners.get(msg.session.module);
      if (listeners) {
        for (const cb of listeners) {
          cb(msg);
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // Client Actions & Subscriptions
  // --------------------------------------------------------------------------

  /**
   * Sets presence / authentication on the bridge.
   */
  public authenticate(userId: string, username?: string, metadata?: any): void {
    this.send({
      type: "authenticate",
      userId,
      username,
      platform: this.options.platform,
      metadata,
    });
  }

  /**
   * Subscribes to live state updates for a specific match or session.
   */
  public subscribeSession(sessionId: string, onStateSync: (state: any) => void): () => void {
    if (!this.sessionListeners.has(sessionId)) {
      this.sessionListeners.set(sessionId, new Set());
      this.send({ type: "subscribe_session", sessionId });
    }
    this.sessionListeners.get(sessionId)!.add(onStateSync);

    return () => {
      const listeners = this.sessionListeners.get(sessionId);
      if (listeners) {
        listeners.delete(onStateSync);
        if (listeners.size === 0) {
          this.sessionListeners.delete(sessionId);
          this.send({ type: "unsubscribe_session", sessionId });
        }
      }
    };
  }

  /**
   * Subscribes to all session events within a specific module (e.g. "games" or "economy").
   */
  public subscribeModule(module: string, onEvent: (event: any) => void): () => void {
    if (!this.moduleListeners.has(module)) {
      this.moduleListeners.set(module, new Set());
      this.send({ type: "subscribe_module", module });
    }
    this.moduleListeners.get(module)!.add(onEvent);

    return () => {
      const listeners = this.moduleListeners.get(module);
      if (listeners) {
        listeners.delete(onEvent);
        if (listeners.size === 0) {
          this.moduleListeners.delete(module);
        }
      }
    };
  }

  /**
   * Dispatches an action (e.g. a game move, shop buy, transfer) across the bridge.
   */
  public async dispatchAction(
    module: string,
    sessionId: string,
    action: string,
    payload?: any
  ): Promise<BridgeActionResult> {
    const correlationId = `act_${++this.correlationCounter}_${Date.now()}`;
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(correlationId, { resolve, reject });
      this.send({
        type: "dispatch_action",
        correlationId,
        module,
        sessionId,
        action,
        payload,
        sourcePlatform: this.options.platform,
      });

      // 10s request timeout
      setTimeout(() => {
        if (this.pendingRequests.has(correlationId)) {
          this.pendingRequests.delete(correlationId);
          reject(new Error(`Action timeout for "${action}" on session "${sessionId}"`));
        }
      }, 10000);
    });
  }

  /**
   * Requests the real-time dashboard overview.
   */
  public async getOverview(): Promise<DashboardOverview> {
    const correlationId = `ov_${++this.correlationCounter}_${Date.now()}`;
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(correlationId, { resolve, reject });
      this.send({
        type: "get_overview",
        correlationId,
      });

      setTimeout(() => {
        if (this.pendingRequests.has(correlationId)) {
          this.pendingRequests.delete(correlationId);
          reject(new Error("Overview request timed out"));
        }
      }, 10000);
    });
  }

  /**
   * Listens for targeted audio cues dispatched to this user.
   */
  public onAudioCue(callback: (audio: BridgeAudioCue) => void): () => void {
    this.audioListeners.add(callback);
    return () => this.audioListeners.delete(callback);
  }

  /**
   * Listens for live toast notifications dispatched to this user.
   */
  public onNotification(callback: (notif: BridgeNotification) => void): () => void {
    this.notificationListeners.add(callback);
    return () => this.notificationListeners.delete(callback);
  }

  /**
   * Listens for connection state changes (online/offline).
   */
  public onConnectionChange(callback: (connected: boolean) => void): () => void {
    this.connectionListeners.add(callback);
    return () => this.connectionListeners.delete(callback);
  }

  private notifyConnection(connected: boolean): void {
    for (const cb of this.connectionListeners) {
      cb(connected);
    }
  }

  private send(data: any): void {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify(data));
    }
  }
}

/**
 * Convenience factory to create a BridgeClient instance.
 */
export function createBridgeClient(options: BridgeClientOptions): BridgeClient {
  return new BridgeClient(options);
}
