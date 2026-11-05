import { _ as DashboardOverview, c as BridgeMountable, d as BridgePackageRouter, f as BridgePlatform, g as BridgeSession, h as BridgeResponse, i as BridgeClientPresence, l as BridgeNotification, m as BridgeRequest, n as BridgeActionResult, r as BridgeAudioCue, s as BridgeEvents, t as BridgeAction, u as BridgeOptions } from "./types-DYX4p2eb.cjs";
import { EventEmitter } from "events";
import http from "http";
import { WebSocketServer } from "ws";
type ModuleActionHandler = (action: BridgeAction, session?: BridgeSession) => Promise<BridgeActionResult> | BridgeActionResult;
declare class M3rcenaBridge extends EventEmitter {
  private storage;
  private options;
  private activeSessions;
  private onlinePresences;
  private moduleHandlers;
  private mountedRouters;
  private registeredModules;
  private startTime;
  private stats;
  constructor(options?: BridgeOptions);
  emit<K extends keyof BridgeEvents>(event: K, ...args: BridgeEvents[K]): boolean;
  emit(event: string | symbol, ...args: any[]): boolean;
  on<K extends keyof BridgeEvents>(event: K, listener: (...args: BridgeEvents[K]) => void): this;
  on(event: string | symbol, listener: (...args: any[]) => void): this;
  once<K extends keyof BridgeEvents>(event: K, listener: (...args: BridgeEvents[K]) => void): this;
  once(event: string | symbol, listener: (...args: any[]) => void): this;
  off<K extends keyof BridgeEvents>(event: K, listener: (...args: BridgeEvents[K]) => void): this;
  off(event: string | symbol, listener: (...args: any[]) => void): this;
  addListener<K extends keyof BridgeEvents>(event: K, listener: (...args: BridgeEvents[K]) => void): this;
  addListener(event: string | symbol, listener: (...args: any[]) => void): this;
  removeListener<K extends keyof BridgeEvents>(event: K, listener: (...args: BridgeEvents[K]) => void): this;
  removeListener(event: string | symbol, listener: (...args: any[]) => void): this;
  prependListener<K extends keyof BridgeEvents>(event: K, listener: (...args: BridgeEvents[K]) => void): this;
  prependListener(event: string | symbol, listener: (...args: any[]) => void): this;
  prependOnceListener<K extends keyof BridgeEvents>(event: K, listener: (...args: BridgeEvents[K]) => void): this;
  prependOnceListener(event: string | symbol, listener: (...args: any[]) => void): this;
  /**
   * Registers a module (e.g. "games", "economy", "moderation") with an optional action handler.
   */
  registerModule(name: string, defaultActionHandler?: ModuleActionHandler): this;
  /**
   * Returns all registered module keys.
   */
  getRegisteredModules(): string[];
  /**
   * Universal method to mount any package, router, or plugin into the Bridge.
   * Supports WekyManager, EcoManager, custom packages, or raw BridgePackageRouter instances.
   * Enables fluent chaining:
   * ```typescript
   * bridge.use(weky).use(eco);
   * ```
   */
  use(mountable: BridgeMountable): this;
  /**
   * Mounts a package or router into the Bridge.
   * Alias for bridge.use().
   */
  mount(mountable: BridgeMountable): this;
  /**
   * Mounts a package router or compatible package into the Bridge.
   * Accepts either a BridgePackageRouter or a package instance (WekyManager, EcoManager, etc.).
   */
  mountPackage(routerOrPackage: BridgePackageRouter | BridgeMountable): this;
  /**
   * Returns all mounted package routers.
   */
  getMountedRouters(): BridgePackageRouter[];
  /**
   * Retrieves a mounted router by package name.
   */
  getRouter(name: string): BridgePackageRouter | undefined;
  /**
   * Dispatches an incoming HTTP request across mounted package routers.
   */
  dispatchHttpRequest(req: BridgeRequest): Promise<BridgeResponse | null>;
  /**
   * Creates standard Express / Connect / Node HTTP middleware for mounting bridge routes.
   */
  createMiddleware(): (req: any, res: any, next?: any) => Promise<void>;
  /**
   * Registers a new active session into the bridge.
   */
  registerSession<TState = any>(session: BridgeSession<TState>): Promise<BridgeSession<TState>>;
  /**
   * Updates state for an active session and broadcasts synchronization to listeners.
   */
  updateSessionState(sessionId: string, newState: any, sourcePlatform?: string): Promise<boolean>;
  /**
   * Retrieves an active session by its ID.
   */
  getSession<TState = any>(sessionId: string): BridgeSession<TState> | undefined;
  /**
   * Ends an active session, marking it completed and notifying listeners.
   */
  endSession(sessionId: string, details?: {
    winnerId?: string;
    reason?: string;
    metadata?: any;
  }): Promise<boolean>;
  /**
   * Unregisters/removes a session from the bridge.
   */
  unregisterSession(sessionId: string): Promise<boolean>;
  /**
   * Returns all active, ongoing sessions.
   */
  getActiveSessions(): BridgeSession[];
  /**
   * Returns all registered sessions.
   */
  getAllSessions(): BridgeSession[];
  /**
   * Returns sessions associated with a specific module (e.g. "games" or "economy").
   */
  getSessionsByModule(module: string): BridgeSession[];
  /**
   * Returns sessions where a specific user is a participant.
   */
  getSessionsForPlayer(playerId: string): BridgeSession[];
  /**
   * Dispatches an action to an active session from any platform (Dashboard, Discord, API).
   */
  dispatchAction(action: BridgeAction): Promise<BridgeActionResult>;
  /**
   * Registers a client as actively connected/online on the dashboard or application.
   */
  setClientOnline(presence: BridgeClientPresence): void;
  /**
   * Marks a client as offline upon disconnect.
   */
  setClientOffline(userId: string): void;
  /**
   * Convenience helper to mark a user as online on the dashboard.
   */
  setUserOnline(userId: string, platform?: BridgePlatform, metadata?: Record<string, any>): void;
  /**
   * Convenience helper to mark a user as offline.
   */
  setUserOffline(userId: string): void;
  /**
   * Checks whether a specific user is currently active/online.
   */
  isUserOnline(userId: string): boolean;
  /**
   * Returns all active user IDs currently connected.
   */
  getActiveUsers(): string[];
  /**
   * Returns presence details for a connected user.
   */
  getPresence(userId: string): BridgeClientPresence | undefined;
  /**
   * Dispatches a scoped audio cue to web dashboards.
   */
  dispatchAudioCue(audio: BridgeAudioCue): boolean;
  /**
   * Dispatches a live notification / toast to connected dashboards.
   */
  dispatchNotification(notification: Omit<BridgeNotification, "id" | "timestamp"> & {
    id?: string;
  }): BridgeNotification;
  /**
   * Generates a high-level real-time overview for web dashboard home screens.
   */
  getDashboardOverview(): Promise<DashboardOverview>;
  exportAllState(): Promise<{
    sessions: BridgeSession[];
    presences: BridgeClientPresence[];
    stats: any;
  }>;
  importAllState(data: {
    sessions?: BridgeSession[];
    stats?: any;
  }): Promise<void>;
}
interface BridgeServerOptions {
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
declare class BridgeServer {
  bridge: M3rcenaBridge;
  options: BridgeServerOptions;
  wss: WebSocketServer | null;
  httpServer: http.Server | null;
  private clients;
  private heartbeatTimer;
  constructor(bridge: M3rcenaBridge, options?: BridgeServerOptions);
  /**
   * Starts the Bridge Server.
   */
  start(): Promise<void>;
  /**
   * Stops the Bridge Server and closes all connections.
   */
  stop(): Promise<void>;
  private setupWebSocketServer;
  private handleClientMessage;
  private bindBridgeEvents;
  broadcastAll(data: any): void;
  broadcastToSession(sessionId: string, data: any): void;
  broadcastToModule(module: string, data: any): void;
  sendToUsers(userIds: string[], data: any): void;
  private sendToSocket;
  private startHeartbeat;
  private handleHttpRequest;
}
interface HostBridgeOptions {
  port?: number;
  secretToken?: string;
  autoMountSubmodules?: boolean;
}
declare function hostBridge(options?: HostBridgeOptions): Promise<{
  bridge: M3rcenaBridge;
  server: BridgeServer;
  port: number;
}>;
export { M3rcenaBridge as a, BridgeServerOptions as i, hostBridge as n, ModuleActionHandler as o, BridgeServer as r, HostBridgeOptions as t };
//# sourceMappingURL=host-CmHOkf00.d.cts.map