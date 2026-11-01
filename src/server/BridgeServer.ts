/**
 * @m3rcena/bridge
 * Real-Time WebSocket and HTTP Gateway Server.
 * Enables live bi-directional synchronization between web dashboards and Discord bots.
 *
 * @copyright 2026 M3rcena Development. All rights reserved.
 * @license Apache-2.0
 */

import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { M3rcenaBridge } from "../M3rcenaBridge.js";
import { BridgeAction, BridgeAudioCue, BridgeNotification } from "../types.js";

export interface BridgeServerOptions {
  /** Existing Node HTTP/HTTPS server instance to attach WebSocket to */
  server?: http.Server;
  /** Port to listen on if creating a standalone server (default: 4000) */
  port?: number;
  /** Secret API token for dashboard client authorization */
  secretToken?: string;
  /** Heartbeat check interval in ms (default: 30000) */
  heartbeatInterval?: number;
  /** Custom route path for WebSocket connections (default: "/bridge") */
  path?: string;
}

interface SocketClient {
  ws: WebSocket;
  isAlive: boolean;
  userId?: string;
  subscribedSessions: Set<string>;
  subscribedModules: Set<string>;
}

export class BridgeServer {
  public bridge: M3rcenaBridge;
  public options: BridgeServerOptions;
  public wss: WebSocketServer | null = null;
  public httpServer: http.Server | null = null;
  private clients: Set<SocketClient> = new Set();
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(bridge: M3rcenaBridge, options: BridgeServerOptions = {}) {
    this.bridge = bridge;
    this.options = {
      port: options.port ?? 4000,
      path: options.path ?? "/bridge",
      heartbeatInterval: options.heartbeatInterval ?? 30000,
      ...options,
    };

    this.bindBridgeEvents();
  }

  /**
   * Starts the Bridge Server.
   */
  public async start(): Promise<void> {
    if (this.options.server) {
      // Attach to existing HTTP server
      this.httpServer = this.options.server;
      this.wss = new WebSocketServer({
        server: this.httpServer,
        path: this.options.path,
      });
    } else {
      // Create standalone HTTP + WS server
      this.httpServer = http.createServer((req, res) => this.handleHttpRequest(req, res));
      this.wss = new WebSocketServer({
        server: this.httpServer,
        path: this.options.path,
      });

      await new Promise<void>((resolve) => {
        this.httpServer!.listen(this.options.port, () => {
          resolve();
        });
      });
    }

    this.setupWebSocketServer();
    this.startHeartbeat();
  }

  /**
   * Stops the Bridge Server and closes all connections.
   */
  public async stop(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    for (const client of this.clients) {
      try {
        client.ws.close();
      } catch {}
    }
    this.clients.clear();

    if (this.wss) {
      await new Promise<void>((resolve) => this.wss!.close(() => resolve()));
      this.wss = null;
    }

    if (this.httpServer && !this.options.server) {
      await new Promise<void>((resolve) => this.httpServer!.close(() => resolve()));
      this.httpServer = null;
    }
  }

  // --------------------------------------------------------------------------
  // WebSocket Connection Handling
  // --------------------------------------------------------------------------

  private setupWebSocketServer(): void {
    if (!this.wss) return;

    this.wss.on("connection", (ws: WebSocket, req: http.IncomingMessage) => {
      // 1. Authorization check
      if (this.options.secretToken) {
        const url = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
        const token = url.searchParams.get("token") || req.headers["authorization"]?.replace("Bearer ", "");
        if (token !== this.options.secretToken) {
          ws.close(4001, "Unauthorized: Invalid or missing secretToken");
          return;
        }
      }

      const client: SocketClient = {
        ws,
        isAlive: true,
        subscribedSessions: new Set(),
        subscribedModules: new Set(),
      };
      this.clients.add(client);

      ws.on("pong", () => {
        client.isAlive = true;
      });

      ws.on("message", async (data: Buffer | string) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleClientMessage(client, message);
        } catch (err: any) {
          this.sendToSocket(client.ws, {
            type: "error",
            error: `Invalid message format: ${err?.message || err}`,
          });
        }
      });

      ws.on("close", () => {
        if (client.userId) {
          this.bridge.setClientOffline(client.userId);
        }
        this.clients.delete(client);
      });

      // Send initial welcome handshake
      this.sendToSocket(ws, {
        type: "welcome",
        modules: this.bridge.getRegisteredModules(),
        timestamp: Date.now(),
      });
    });
  }

  private async handleClientMessage(client: SocketClient, msg: any): Promise<void> {
    switch (msg.type) {
      case "authenticate":
      case "presence": {
        if (msg.userId) {
          client.userId = msg.userId;
          this.bridge.setClientOnline({
            userId: msg.userId,
            username: msg.username,
            platform: msg.platform || "dashboard",
            connectedAt: Date.now(),
            lastSeen: Date.now(),
            metadata: msg.metadata,
          });
          this.sendToSocket(client.ws, { type: "presence_ack", userId: msg.userId });
        }
        break;
      }

      case "subscribe_session": {
        if (msg.sessionId) {
          client.subscribedSessions.add(msg.sessionId);
          const current = this.bridge.getSession(msg.sessionId);
          this.sendToSocket(client.ws, {
            type: "session_state",
            sessionId: msg.sessionId,
            session: current,
          });
        }
        break;
      }

      case "unsubscribe_session": {
        if (msg.sessionId) {
          client.subscribedSessions.delete(msg.sessionId);
        }
        break;
      }

      case "subscribe_module": {
        if (msg.module) {
          client.subscribedModules.add(msg.module);
        }
        break;
      }

      case "dispatch_action": {
        const action: BridgeAction = {
          module: msg.module,
          sessionId: msg.sessionId,
          playerId: msg.playerId || client.userId || "anonymous",
          action: msg.action,
          payload: msg.payload,
          sourcePlatform: msg.sourcePlatform || "dashboard",
        };
        const result = await this.bridge.dispatchAction(action);
        this.sendToSocket(client.ws, {
          type: "action_result",
          correlationId: msg.correlationId,
          result,
        });
        break;
      }

      case "get_overview": {
        const overview = await this.bridge.getDashboardOverview();
        this.sendToSocket(client.ws, {
          type: "overview",
          correlationId: msg.correlationId,
          data: overview,
        });
        break;
      }

      case "ping": {
        this.sendToSocket(client.ws, { type: "pong", timestamp: Date.now() });
        break;
      }

      default:
        this.sendToSocket(client.ws, { type: "unknown_type", received: msg.type });
    }
  }

  // --------------------------------------------------------------------------
  // Outbound Broadcasting
  // --------------------------------------------------------------------------

  private bindBridgeEvents(): void {
    // 1. Session State Sync
    this.bridge.on("sync", (event) => {
      this.broadcastToSession(event.sessionId, {
        type: "sync",
        ...event,
      });
    });

    // 2. Audio Cues (Scoped targeting)
    this.bridge.on("audioCue", (cue: BridgeAudioCue) => {
      const targets = cue.targetUserIds || (cue.userId ? [cue.userId] : []);
      if (targets.length > 0) {
        this.sendToUsers(targets, {
          type: "audio_cue",
          ...cue,
        });
      } else {
        // Broadcast to all dashboard clients
        this.broadcastAll({
          type: "audio_cue",
          ...cue,
        });
      }
    });

    // 3. Notifications (Scoped targeting)
    this.bridge.on("notification", (notif: BridgeNotification) => {
      const targets = notif.targetUserIds || (notif.userId ? [notif.userId] : []);
      if (targets.length > 0) {
        this.sendToUsers(targets, {
          type: "notification",
          ...notif,
        });
      } else {
        this.broadcastAll({
          type: "notification",
          ...notif,
        });
      }
    });

    // 4. Session Start & End
    this.bridge.on("sessionStart", (session) => {
      this.broadcastToModule(session.module, {
        type: "session_start",
        session,
      });
    });

    this.bridge.on("sessionEnd", (session) => {
      this.broadcastToSession(session.id, {
        type: "session_end",
        session,
      });
      this.broadcastToModule(session.module, {
        type: "session_end",
        session,
      });
    });
  }

  public broadcastAll(data: any): void {
    const payload = JSON.stringify(data);
    for (const client of this.clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    }
  }

  public broadcastToSession(sessionId: string, data: any): void {
    const payload = JSON.stringify(data);
    for (const client of this.clients) {
      if (client.subscribedSessions.has(sessionId) && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    }
  }

  public broadcastToModule(module: string, data: any): void {
    const payload = JSON.stringify(data);
    for (const client of this.clients) {
      if (client.subscribedModules.has(module) && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    }
  }

  public sendToUsers(userIds: string[], data: any): void {
    const targetSet = new Set(userIds);
    const payload = JSON.stringify(data);
    for (const client of this.clients) {
      if (client.userId && targetSet.has(client.userId) && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    }
  }

  private sendToSocket(ws: WebSocket, data: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      for (const client of this.clients) {
        if (!client.isAlive) {
          client.ws.terminate();
          this.clients.delete(client);
          continue;
        }
        client.isAlive = false;
        client.ws.ping();
      }
    }, this.options.heartbeatInterval);
  }

  // --------------------------------------------------------------------------
  // Built-in HTTP REST Handler
  // --------------------------------------------------------------------------

  private async handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // CORS headers for Web Dashboards
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    // 1. Try Mounted Package Routers (e.g. /api/weky/*, /api/eco/*)
    const query: Record<string, string> = {};
    url.searchParams.forEach((val, key) => {
      query[key] = val;
    });

    let bodyData: any = undefined;
    if (["POST", "PUT", "PATCH"].includes(req.method?.toUpperCase() || "")) {
      try {
        const rawBody = await new Promise<string>((resolve) => {
          let b = "";
          req.on("data", (chunk) => (b += chunk));
          req.on("end", () => resolve(b));
        });
        if (rawBody.trim()) {
          try {
            bodyData = JSON.parse(rawBody);
          } catch {
            bodyData = rawBody;
          }
        }
      } catch {}
    }

    const bridgeReq = {
      method: (req.method?.toUpperCase() || "GET") as any,
      url: req.url || "/",
      path: url.pathname,
      subPath: url.pathname,
      params: {},
      query,
      headers: req.headers as any,
      body: bodyData,
    };

    const packageResponse = await this.bridge.dispatchHttpRequest(bridgeReq);
    if (packageResponse) {
      res.writeHead(packageResponse.status, {
        "Content-Type": packageResponse.contentType || (packageResponse.isBuffer ? "image/png" : "application/json"),
        ...(packageResponse.headers || {}),
      });
      if (packageResponse.isBuffer && Buffer.isBuffer(packageResponse.body)) {
        res.end(packageResponse.body);
      } else if (typeof packageResponse.body === "string") {
        res.end(packageResponse.body);
      } else {
        res.end(JSON.stringify(packageResponse.body));
      }
      return;
    }

    // 2. Core Built-In Endpoints
    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", timestamp: Date.now() }));
      return;
    }

    if (url.pathname === "/overview" && req.method === "GET") {
      const overview = await this.bridge.getDashboardOverview();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(overview));
      return;
    }

    if (url.pathname === "/sessions" && req.method === "GET") {
      const sessions = this.bridge.getActiveSessions();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(sessions));
      return;
    }

    if (url.pathname === "/action" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", async () => {
        try {
          const action = JSON.parse(body);
          const result = await this.bridge.dispatchAction(action);
          res.writeHead(result.success ? 200 : 400, { "Content-Type": "application/json" });
          res.end(JSON.stringify(result));
        } catch (err: any) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: err?.message || "Invalid JSON" }));
        }
      });
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Route not found" }));
  }
}

