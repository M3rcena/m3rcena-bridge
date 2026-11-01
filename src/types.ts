/**
 * @m3rcena/bridge
 * Universal cross-platform bridge protocol definitions.
 *
 * @copyright 2026 M3rcena Development. All rights reserved.
 * @license Apache-2.0
 */

export type BridgePlatform = "discord" | "dashboard" | "web" | "api" | "mobile" | "cli";

export interface BridgePlayer {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  platform: BridgePlatform;
  role?: "player" | "spectator" | "admin" | "bot";
  metadata?: Record<string, any>;
}

export interface BridgeAction {
  id?: string;
  module: string;
  sessionId?: string;
  playerId: string;
  action: string;
  payload?: any;
  sourcePlatform: BridgePlatform;
  timestamp?: number;
}

export interface BridgeActionResult<TState = any> {
  success: boolean;
  state?: TState;
  nextTurnId?: string;
  isEnded?: boolean;
  winnerId?: string;
  announcement?: string;
  soundKey?: string;
  soundUrl?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface BridgeSession<TState = any> {
  id: string;
  module: string;
  type: string;
  platform: BridgePlatform | "hybrid";
  players: BridgePlayer[];
  currentTurnId?: string;
  state: TState;
  metadata?: Record<string, any>;
  createdAt: number;
  lastUpdated: number;
  isEnded: boolean;
  winnerId?: string;
  onAction?: (action: BridgeAction) => Promise<BridgeActionResult<TState>> | BridgeActionResult<TState>;
  renderSnapshot?: () => Promise<Buffer | string> | Buffer | string;
}

export interface BridgeAudioCue {
  module?: string;
  sessionId?: string;
  soundKey?: string;
  sound?: string;
  soundUrl?: string;
  volume?: number;
  userId?: string;
  username?: string;
  targetUserIds?: string[];
  timestamp?: number;
}

export interface BridgeNotification {
  id: string;
  module?: string;
  sessionId?: string;
  title: string;
  message: string;
  type?: "info" | "success" | "warning" | "error";
  userId?: string;
  targetUserIds?: string[];
  timestamp: number;
  data?: any;
}

export interface BridgeClientPresence {
  userId: string;
  username?: string;
  platform: BridgePlatform;
  connectedAt: number;
  lastSeen: number;
  activeSessionId?: string;
  socketId?: string;
  metadata?: Record<string, any>;
}

export interface DashboardOverview {
  activeModules: string[];
  onlineUsersCount: number;
  onlineUsers: { userId: string; username?: string; platform: BridgePlatform }[];
  activeSessionsCount: number;
  activeSessions: {
    id: string;
    module: string;
    type: string;
    platform: string;
    players: { id: string; username: string; platform: string }[];
    currentTurnId?: string;
    lastUpdated: number;
    isEnded: boolean;
  }[];
  uptime: number;
  stats: Record<string, any>;
}

export interface BridgeOptions {
  storage?: any;
  /** Database configuration for session persistence ("sqlite" | "memory" | "json" | custom adapter) */
  database?: BridgeDatabaseConfig;
  autoCleanEndedSessions?: boolean;
  sessionTimeoutMs?: number;
  requireOnlinePresenceForAudio?: boolean;
  /** Whether to log an update notification box in the terminal if a newer version is available. Default: true */
  notifyUpdates?: boolean;
}

export type BridgeDatabaseConfig =
  | "sqlite"
  | "memory"
  | "json"
  | {
      type: "sqlite";
      path?: string;
    }
  | {
      type: "prisma";
      client: any;
      model?: string;
      autoMigrate?: boolean;
    }
  | {
      type: "json";
      path?: string;
    }
  | {
      type: "memory";
    };

export interface BridgeEvents {
  action: [action: BridgeAction];
  actionResult: [result: BridgeActionResult, action: BridgeAction];
  sessionStart: [session: BridgeSession];
  sessionUpdate: [session: BridgeSession];
  sessionEnd: [session: BridgeSession];
  sync: [event: { sessionId: string; module: string; state: any; source: string; timestamp: number }];
  presenceChange: [presence: BridgeClientPresence, isOnline: boolean];
  audioCue: [audio: BridgeAudioCue];
  notification: [notification: BridgeNotification];
}

// ----------------------------------------------------------------------------
// Dynamic Package Routing & Decoupled State Protocol
// ----------------------------------------------------------------------------
export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS";

export interface BridgeRequest {
  method: HttpMethod;
  url: string;
  path: string;
  subPath: string;
  params: Record<string, string>;
  query: Record<string, string>;
  headers: Record<string, string | string[] | undefined>;
  body?: any;
}

export interface BridgeResponse {
  status: number;
  headers?: Record<string, string>;
  body?: any;
  isBuffer?: boolean;
  contentType?: string;
}

export interface BridgePackageRouter {
  name: string;
  basePath: string; // e.g. "/api/weky" or "/api/eco"
  description?: string;
  version?: string;
  handleRequest(req: BridgeRequest): Promise<BridgeResponse | null>;
  handleAction?(action: BridgeAction): Promise<any>;
}

/**
 * Universal adapter interface for any package (WekyManager, EcoManager, or custom) connecting to the Bridge.
 */
export interface BridgeCompatiblePackage {
  /** Optional package name or module name */
  name?: string;
  /** Direct router reference */
  router?: BridgePackageRouter;
  /** Bridge router reference */
  bridgeRouter?: BridgePackageRouter;
  /** Method returning a Bridge router */
  toBridgeRouter?: () => BridgePackageRouter;
  /** Sub-bridge or internal bridge reference */
  bridge?: any;
  /** Handshake connection callback */
  setBridge?: (bridge: any) => void;
  /** Handshake connection callback alias */
  connectBridge?: (bridge: any) => void;
}

/**
 * Any router, package instance, or plugin mountable via bridge.use() or bridge.mount().
 */
export type BridgeMountable = BridgePackageRouter | BridgeCompatiblePackage | any;


