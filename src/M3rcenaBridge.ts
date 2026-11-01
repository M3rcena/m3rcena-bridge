/**
 * @m3rcena/bridge
 * The Universal Central Bridge Controller.
 * Connects Discord bots, Headless Engines, and Web Dashboards with unified state synchronization,
 * cross-platform action dispatching, user presence tracking, and targeted audio cues.
 *
 * @copyright 2026 M3rcena Development. All rights reserved.
 * @license Apache-2.0
 */

import { EventEmitter } from "events";
import {
  BridgeAction,
  BridgeActionResult,
  BridgeAudioCue,
  BridgeClientPresence,
  BridgeEvents,
  BridgeNotification,
  BridgeOptions,
  BridgePlayer,
  BridgePlatform,
  BridgeSession,
  DashboardOverview,
  BridgePackageRouter,
  BridgeRequest,
  BridgeResponse,
  BridgeMountable,
  BridgeCompatiblePackage,
} from "./types.js";
import { BridgeStorageAdapter, MemoryStorageAdapter } from "./storage/BridgeStorageAdapter.js";
import { resolveBridgeStorage, BridgeDatabaseHandler } from "./storage/BridgeDatabaseHandler.js";
import { checkPackageUpdates, BRIDGE_VERSION } from "./utils/Notifier.js";

export type ModuleActionHandler = (
  action: BridgeAction,
  session?: BridgeSession
) => Promise<BridgeActionResult> | BridgeActionResult;

export class M3rcenaBridge extends EventEmitter {
  private storage: BridgeStorageAdapter;
  private options: BridgeOptions;
  private activeSessions: Map<string, BridgeSession> = new Map();
  private onlinePresences: Map<string, BridgeClientPresence> = new Map();
  private moduleHandlers: Map<string, ModuleActionHandler> = new Map();
  private mountedRouters: Map<string, BridgePackageRouter> = new Map();
  private registeredModules: Set<string> = new Set();
  private startTime: number = Date.now();
  private stats: {
    totalActionsDispatched: number;
    totalSessionsCreated: number;
    totalAudioCuesDispatched: number;
    totalNotificationsDispatched: number;
  } = {
    totalActionsDispatched: 0,
    totalSessionsCreated: 0,
    totalAudioCuesDispatched: 0,
    totalNotificationsDispatched: 0,
  };

  constructor(options: BridgeOptions = {}) {
    super();
    this.options = {
      autoCleanEndedSessions: options.autoCleanEndedSessions ?? false,
      sessionTimeoutMs: options.sessionTimeoutMs ?? 30 * 60 * 1000,
      requireOnlinePresenceForAudio: options.requireOnlinePresenceForAudio ?? false,
      notifyUpdates: options.notifyUpdates ?? true,
    };
    this.storage = resolveBridgeStorage(options);

    if (this.options.notifyUpdates) {
      checkPackageUpdates(BRIDGE_VERSION, false).catch(() => {});
    }
  }

  // --------------------------------------------------------------------------
  // Strongly Typed Event Emitter Overrides
  // --------------------------------------------------------------------------

  public override emit<K extends keyof BridgeEvents>(event: K, ...args: BridgeEvents[K]): boolean;
  public override emit(event: string | symbol, ...args: any[]): boolean;
  public override emit(event: string | symbol, ...args: any[]): boolean {
    return super.emit(event, ...args);
  }

  public override on<K extends keyof BridgeEvents>(event: K, listener: (...args: BridgeEvents[K]) => void): this;
  public override on(event: string | symbol, listener: (...args: any[]) => void): this;
  public override on(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.on(event, listener as any);
  }

  public override once<K extends keyof BridgeEvents>(event: K, listener: (...args: BridgeEvents[K]) => void): this;
  public override once(event: string | symbol, listener: (...args: any[]) => void): this;
  public override once(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.once(event, listener as any);
  }

  public override off<K extends keyof BridgeEvents>(event: K, listener: (...args: BridgeEvents[K]) => void): this;
  public override off(event: string | symbol, listener: (...args: any[]) => void): this;
  public override off(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.off(event, listener as any);
  }

  public override addListener<K extends keyof BridgeEvents>(event: K, listener: (...args: BridgeEvents[K]) => void): this;
  public override addListener(event: string | symbol, listener: (...args: any[]) => void): this;
  public override addListener(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.addListener(event, listener as any);
  }

  public override removeListener<K extends keyof BridgeEvents>(event: K, listener: (...args: BridgeEvents[K]) => void): this;
  public override removeListener(event: string | symbol, listener: (...args: any[]) => void): this;
  public override removeListener(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.removeListener(event, listener as any);
  }

  public override prependListener<K extends keyof BridgeEvents>(event: K, listener: (...args: BridgeEvents[K]) => void): this;
  public override prependListener(event: string | symbol, listener: (...args: any[]) => void): this;
  public override prependListener(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.prependListener(event, listener as any);
  }

  public override prependOnceListener<K extends keyof BridgeEvents>(event: K, listener: (...args: BridgeEvents[K]) => void): this;
  public override prependOnceListener(event: string | symbol, listener: (...args: any[]) => void): this;
  public override prependOnceListener(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.prependOnceListener(event, listener as any);
  }

  // --------------------------------------------------------------------------
  // Module Registry
  // --------------------------------------------------------------------------

  /**
   * Registers a module (e.g. "games", "economy", "moderation") with an optional action handler.
   */
  public registerModule(name: string, defaultActionHandler?: ModuleActionHandler): this {
    this.registeredModules.add(name);
    if (defaultActionHandler) {
      this.moduleHandlers.set(name, defaultActionHandler);
    }
    return this;
  }

  /**
   * Returns all registered module keys.
   */
  public getRegisteredModules(): string[] {
    return Array.from(this.registeredModules);
  }

  // --------------------------------------------------------------------------
  // Universal Package Mounting & Dynamic Routers
  // --------------------------------------------------------------------------

  /**
   * Universal method to mount any package, router, or plugin into the Bridge.
   * Supports WekyManager, EcoManager, custom packages, or raw BridgePackageRouter instances.
   * Enables fluent chaining:
   * ```typescript
   * bridge.use(weky).use(eco);
   * ```
   */
  public use(mountable: BridgeMountable): this {
    return this.mount(mountable);
  }

  /**
   * Mounts a package or router into the Bridge.
   * Alias for bridge.use().
   */
  public mount(mountable: BridgeMountable): this {
    if (!mountable) return this;

    // 1. Is it a direct BridgePackageRouter?
    if (
      typeof mountable.name === "string" &&
      typeof mountable.basePath === "string" &&
      typeof mountable.handleRequest === "function"
    ) {
      this.mountedRouters.set(mountable.name, mountable as BridgePackageRouter);
      this.registeredModules.add(mountable.name);
      return this;
    }

    // 2. Extract router from a compatible package (WekyManager, EcoManager, etc.)
    let router: BridgePackageRouter | undefined;
    if (typeof mountable.toBridgeRouter === "function") {
      router = mountable.toBridgeRouter();
    } else if (mountable.router && typeof mountable.router.handleRequest === "function") {
      router = mountable.router;
    } else if (mountable.bridgeRouter && typeof mountable.bridgeRouter.handleRequest === "function") {
      router = mountable.bridgeRouter;
    } else if (mountable.bridge?.router && typeof mountable.bridge.router.handleRequest === "function") {
      router = mountable.bridge.router;
    }

    if (router) {
      this.mountedRouters.set(router.name, router);
      this.registeredModules.add(router.name);
    }

    // 3. Establish bi-directional connection with the package
    if (typeof mountable.connectBridge === "function") {
      mountable.connectBridge(this);
    } else if (typeof mountable.setBridge === "function") {
      mountable.setBridge(this);
    }

    return this;
  }

  /**
   * Mounts a package router or compatible package into the Bridge.
   * Accepts either a BridgePackageRouter or a package instance (WekyManager, EcoManager, etc.).
   */
  public mountPackage(routerOrPackage: BridgePackageRouter | BridgeMountable): this {
    return this.mount(routerOrPackage);
  }

  /**
   * Returns all mounted package routers.
   */
  public getMountedRouters(): BridgePackageRouter[] {
    return Array.from(this.mountedRouters.values());
  }

  /**
   * Retrieves a mounted router by package name.
   */
  public getRouter(name: string): BridgePackageRouter | undefined {
    return this.mountedRouters.get(name);
  }

  /**
   * Dispatches an incoming HTTP request across mounted package routers.
   */
  public async dispatchHttpRequest(req: BridgeRequest): Promise<BridgeResponse | null> {
    for (const router of this.mountedRouters.values()) {
      const normalizedBase = router.basePath.startsWith("/") ? router.basePath : `/${router.basePath}`;
      if (req.path.startsWith(normalizedBase)) {
        const subPath = req.path.slice(normalizedBase.length) || "/";
        const routedReq: BridgeRequest = {
          ...req,
          subPath: subPath.startsWith("/") ? subPath : `/${subPath}`,
        };
        const res = await router.handleRequest(routedReq);
        if (res) return res;
      }
    }
    return null;
  }

  /**
   * Creates standard Express / Connect / Node HTTP middleware for mounting bridge routes.
   */
  public createMiddleware(): (req: any, res: any, next?: any) => Promise<void> {
    return async (req: any, res: any, next?: any) => {
      const url = new URL(req.url || "/", `http://${req.headers?.host || "localhost"}`);
      const query: Record<string, string> = {};
      url.searchParams.forEach((v, k) => {
        query[k] = v;
      });

      const bridgeReq: BridgeRequest = {
        method: (req.method?.toUpperCase() || "GET") as any,
        url: req.url || "/",
        path: url.pathname,
        subPath: url.pathname,
        params: req.params || {},
        query,
        headers: req.headers || {},
        body: req.body,
      };

      const match = await this.dispatchHttpRequest(bridgeReq);
      if (match) {
        res.writeHead(match.status, {
          "Content-Type": match.contentType || "application/json",
          ...(match.headers || {}),
        });
        if (match.isBuffer && Buffer.isBuffer(match.body)) {
          res.end(match.body);
        } else if (typeof match.body === "string") {
          res.end(match.body);
        } else {
          res.end(JSON.stringify(match.body));
        }
        return;
      }

      if (typeof next === "function") {
        next();
      }
    };
  }

  // --------------------------------------------------------------------------
  // Session Lifecycle Management
  // --------------------------------------------------------------------------

  /**
   * Registers a new active session into the bridge.
   */
  public async registerSession<TState = any>(session: BridgeSession<TState>): Promise<BridgeSession<TState>> {
    session.createdAt = session.createdAt || Date.now();
    session.lastUpdated = Date.now();
    session.isEnded = session.isEnded ?? false;

    this.activeSessions.set(session.id, session);
    this.registeredModules.add(session.module);
    this.stats.totalSessionsCreated++;

    await this.storage.saveSession(session);

    this.emit("sessionStart", session);
    this.emit("sync", {
      sessionId: session.id,
      module: session.module,
      state: session.state,
      source: session.platform,
      timestamp: Date.now(),
    });

    return session;
  }

  /**
   * Updates state for an active session and broadcasts synchronization to listeners.
   */
  public async updateSessionState(sessionId: string, newState: any, sourcePlatform: string = "internal"): Promise<boolean> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return false;

    session.state = newState;
    session.lastUpdated = Date.now();

    await this.storage.saveSession(session);

    this.emit("sessionUpdate", session);
    this.emit("sync", {
      sessionId: session.id,
      module: session.module,
      state: newState,
      source: sourcePlatform,
      timestamp: Date.now(),
    });

    return true;
  }

  /**
   * Retrieves an active session by its ID.
   */
  public getSession<TState = any>(sessionId: string): BridgeSession<TState> | undefined {
    return this.activeSessions.get(sessionId) as BridgeSession<TState> | undefined;
  }

  /**
   * Ends an active session, marking it completed and notifying listeners.
   */
  public async endSession(sessionId: string, details: { winnerId?: string; reason?: string; metadata?: any } = {}): Promise<boolean> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return false;

    session.isEnded = true;
    session.lastUpdated = Date.now();
    if (details.winnerId) session.winnerId = details.winnerId;
    if (details.metadata) session.metadata = { ...session.metadata, ...details.metadata };

    await this.storage.saveSession(session);

    this.emit("sessionEnd", session);

    if (this.options.autoCleanEndedSessions) {
      this.activeSessions.delete(sessionId);
      await this.storage.removeSession(sessionId);
    }

    return true;
  }

  /**
   * Unregisters/removes a session from the bridge.
   */
  public async unregisterSession(sessionId: string): Promise<boolean> {
    const deleted = this.activeSessions.delete(sessionId);
    await this.storage.removeSession(sessionId);
    return deleted;
  }

  /**
   * Returns all active, ongoing sessions.
   */
  public getActiveSessions(): BridgeSession[] {
    return Array.from(this.activeSessions.values()).filter((s) => !s.isEnded);
  }

  /**
   * Returns all registered sessions.
   */
  public getAllSessions(): BridgeSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Returns sessions associated with a specific module (e.g. "games" or "economy").
   */
  public getSessionsByModule(module: string): BridgeSession[] {
    return Array.from(this.activeSessions.values()).filter((s) => s.module === module);
  }

  /**
   * Returns sessions where a specific user is a participant.
   */
  public getSessionsForPlayer(playerId: string): BridgeSession[] {
    return Array.from(this.activeSessions.values()).filter((s) => s.players.some((p) => p.id === playerId));
  }

  // --------------------------------------------------------------------------
  // Action Dispatching
  // --------------------------------------------------------------------------

  /**
   * Dispatches an action to an active session from any platform (Dashboard, Discord, API).
   */
  public async dispatchAction(action: BridgeAction): Promise<BridgeActionResult> {
    const session = action.sessionId ? this.activeSessions.get(action.sessionId) : undefined;
    if (action.sessionId && !session) {
      return { success: false, error: `Session "${action.sessionId}" not found` };
    }

    if (session && session.isEnded) {
      return { success: false, error: `Session "${action.sessionId}" has already ended` };
    }

    action.timestamp = action.timestamp || Date.now();
    this.stats.totalActionsDispatched++;
    this.emit("action", action);

    let result: BridgeActionResult;

    // 1. Session-specific action handler has highest priority
    if (session && typeof session.onAction === "function") {
      result = await session.onAction(action);
    } else if (this.moduleHandlers.has(action.module)) {
      // 2. Module default action handler
      const handler = this.moduleHandlers.get(action.module)!;
      result = await handler(action, session);
    } else if (session && this.moduleHandlers.has(session.module)) {
      const handler = this.moduleHandlers.get(session.module)!;
      result = await handler(action, session);
    } else if (this.mountedRouters.has(action.module) && typeof this.mountedRouters.get(action.module)!.handleAction === "function") {
      const router = this.mountedRouters.get(action.module)!;
      result = await router.handleAction!(action);
    } else {
      result = { success: true };
    }

    if (result.success && session) {
      if (result.state !== undefined) session.state = result.state;
      if (result.nextTurnId !== undefined) session.currentTurnId = result.nextTurnId;
      if (result.isEnded) {
        session.isEnded = true;
        session.winnerId = result.winnerId;
      }
      session.lastUpdated = Date.now();
      await this.storage.saveSession(session);

      // Trigger automatic audio cue if specified
      if (result.soundKey && result.soundUrl) {
        const targetUserIds = session.players.map((p) => p.id);
        this.dispatchAudioCue({
          module: session.module,
          sessionId: session.id,
          soundKey: result.soundKey,
          soundUrl: result.soundUrl,
          userId: action.playerId,
          targetUserIds,
          timestamp: Date.now(),
        });
      }

      this.emit("sync", {
        sessionId: session.id,
        module: session.module,
        state: session.state,
        source: action.sourcePlatform,
        timestamp: Date.now(),
      });
    }

    this.emit("actionResult", result, action);
    return result;
  }

  // --------------------------------------------------------------------------
  // User Presence & Client Registry
  // --------------------------------------------------------------------------

  /**
   * Registers a client as actively connected/online on the dashboard or application.
   */
  public setClientOnline(presence: BridgeClientPresence): void {
    presence.connectedAt = presence.connectedAt || Date.now();
    presence.lastSeen = Date.now();
    this.onlinePresences.set(presence.userId, presence);
    this.emit("presenceChange", presence, true);
  }

  /**
   * Marks a client as offline upon disconnect.
   */
  public setClientOffline(userId: string): void {
    const existing = this.onlinePresences.get(userId);
    if (existing) {
      this.onlinePresences.delete(userId);
      this.emit("presenceChange", existing, false);
    }
  }

  /**
   * Convenience helper to mark a user as online on the dashboard.
   */
  public setUserOnline(userId: string, platform: BridgePlatform = "dashboard", metadata?: Record<string, any>): void {
    this.setClientOnline({
      userId,
      platform,
      connectedAt: Date.now(),
      lastSeen: Date.now(),
      metadata,
    });
  }

  /**
   * Convenience helper to mark a user as offline.
   */
  public setUserOffline(userId: string): void {
    this.setClientOffline(userId);
  }

  /**
   * Checks whether a specific user is currently active/online.
   */
  public isUserOnline(userId: string): boolean {
    return this.onlinePresences.has(userId);
  }

  /**
   * Returns all active user IDs currently connected.
   */
  public getActiveUsers(): string[] {
    return Array.from(this.onlinePresences.keys());
  }

  /**
   * Returns presence details for a connected user.
   */
  public getPresence(userId: string): BridgeClientPresence | undefined {
    return this.onlinePresences.get(userId);
  }

  // --------------------------------------------------------------------------
  // Targeted Audio & Notifications
  // --------------------------------------------------------------------------

  /**
   * Dispatches a scoped audio cue to web dashboards.
   */
  public dispatchAudioCue(audio: BridgeAudioCue): boolean {
    audio.soundKey = audio.soundKey || audio.sound || "default";
    audio.soundUrl = audio.soundUrl || "";
    // Check presence filter if requireOnlinePresenceForAudio is enabled
    if (this.options.requireOnlinePresenceForAudio) {
      const targets = audio.targetUserIds || (audio.userId ? [audio.userId] : []);
      if (targets.length > 0) {
        const hasOnlineTarget = targets.some((id) => this.isUserOnline(id));
        if (!hasOnlineTarget) return false;
      } else if (this.onlinePresences.size === 0) {
        return false;
      }
    }

    audio.timestamp = audio.timestamp || Date.now();
    this.stats.totalAudioCuesDispatched++;
    this.emit("audioCue", audio);
    return true;
  }

  /**
   * Dispatches a live notification / toast to connected dashboards.
   */
  public dispatchNotification(notification: Omit<BridgeNotification, "id" | "timestamp"> & { id?: string }): BridgeNotification {
    const payload: BridgeNotification = {
      id: notification.id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      module: notification.module,
      sessionId: notification.sessionId,
      title: notification.title,
      message: notification.message,
      type: notification.type || "info",
      userId: notification.userId,
      targetUserIds: notification.targetUserIds,
      timestamp: Date.now(),
      data: notification.data,
    };

    this.stats.totalNotificationsDispatched++;
    this.emit("notification", payload);
    return payload;
  }

  // --------------------------------------------------------------------------
  // Dashboard Overview & Telemetry
  // --------------------------------------------------------------------------

  /**
   * Generates a high-level real-time overview for web dashboard home screens.
   */
  public async getDashboardOverview(): Promise<DashboardOverview> {
    const activeSessions = this.getActiveSessions();
    const onlineList = Array.from(this.onlinePresences.values()).map((p) => ({
      userId: p.userId,
      username: p.username,
      platform: p.platform,
    }));

    return {
      activeModules: Array.from(this.registeredModules),
      onlineUsersCount: this.onlinePresences.size,
      onlineUsers: onlineList,
      activeSessionsCount: activeSessions.length,
      activeSessions: activeSessions.map((s) => ({
        id: s.id,
        module: s.module,
        type: s.type,
        platform: s.platform,
        players: s.players.map((p) => ({ id: p.id, username: p.username, platform: p.platform })),
        currentTurnId: s.currentTurnId,
        lastUpdated: s.lastUpdated,
        isEnded: s.isEnded,
      })),
      uptime: Date.now() - this.startTime,
      stats: {
        ...this.stats,
        totalActiveSessions: this.activeSessions.size,
      },
    };
  }

  // --------------------------------------------------------------------------
  // State Export & Import
  // --------------------------------------------------------------------------

  public async exportAllState(): Promise<{ sessions: BridgeSession[]; presences: BridgeClientPresence[]; stats: any }> {
    const sessions = Array.from(this.activeSessions.values()).map((s) => ({
      ...s,
      onAction: undefined,
      renderSnapshot: undefined,
    }));

    return {
      sessions,
      presences: Array.from(this.onlinePresences.values()),
      stats: { ...this.stats },
    };
  }

  public async importAllState(data: { sessions?: BridgeSession[]; stats?: any }): Promise<void> {
    if (data.sessions) {
      for (const s of data.sessions) {
        this.activeSessions.set(s.id, s);
        await this.storage.saveSession(s);
      }
    }
    if (data.stats) {
      this.stats = { ...this.stats, ...data.stats };
    }
  }
}
