import { _ as DashboardOverview, l as BridgeNotification, n as BridgeActionResult, r as BridgeAudioCue } from "./types-DYX4p2eb.cjs";
import { EventEmitter } from "events";
interface BridgeClientOptions {
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
interface BridgeClientEvents {
  connect: [];
  disconnect: [];
  audioCue: [audio: BridgeAudioCue];
  notification: [notification: BridgeNotification];
  stateSync: [event: {
    sessionId: string;
    state: any;
  }];
  moduleEvent: [event: any];
  error: [error: any];
}
declare class BridgeClient extends EventEmitter {
  options: BridgeClientOptions;
  private ws;
  private isConnected;
  private correlationCounter;
  private pendingRequests;
  private sessionListeners;
  private moduleListeners;
  private audioListeners;
  private notificationListeners;
  private connectionListeners;
  constructor(options: BridgeClientOptions);
  emit<K extends keyof BridgeClientEvents>(event: K, ...args: BridgeClientEvents[K]): boolean;
  emit(event: string | symbol, ...args: any[]): boolean;
  on<K extends keyof BridgeClientEvents>(event: K, listener: (...args: BridgeClientEvents[K]) => void): this;
  on(event: string | symbol, listener: (...args: any[]) => void): this;
  once<K extends keyof BridgeClientEvents>(event: K, listener: (...args: BridgeClientEvents[K]) => void): this;
  once(event: string | symbol, listener: (...args: any[]) => void): this;
  off<K extends keyof BridgeClientEvents>(event: K, listener: (...args: BridgeClientEvents[K]) => void): this;
  off(event: string | symbol, listener: (...args: any[]) => void): this;
  addListener<K extends keyof BridgeClientEvents>(event: K, listener: (...args: BridgeClientEvents[K]) => void): this;
  addListener(event: string | symbol, listener: (...args: any[]) => void): this;
  removeListener<K extends keyof BridgeClientEvents>(event: K, listener: (...args: BridgeClientEvents[K]) => void): this;
  removeListener(event: string | symbol, listener: (...args: any[]) => void): this;
  prependListener<K extends keyof BridgeClientEvents>(event: K, listener: (...args: BridgeClientEvents[K]) => void): this;
  prependListener(event: string | symbol, listener: (...args: any[]) => void): this;
  prependOnceListener<K extends keyof BridgeClientEvents>(event: K, listener: (...args: BridgeClientEvents[K]) => void): this;
  prependOnceListener(event: string | symbol, listener: (...args: any[]) => void): this;
  /**
   * Connects to the Bridge WebSocket Gateway.
   */
  connect(): Promise<void>;
  /**
   * Disconnects from the bridge gateway.
   */
  disconnect(): void;
  get connected(): boolean;
  private handleInboundMessage;
  /**
   * Sets presence / authentication on the bridge.
   */
  authenticate(userId: string, username?: string, metadata?: any): void;
  /**
   * Subscribes to live state updates for a specific match or session.
   */
  subscribeSession(sessionId: string, onStateSync: (state: any) => void): () => void;
  /**
   * Subscribes to all session events within a specific module (e.g. "games" or "economy").
   */
  subscribeModule(module: string, onEvent: (event: any) => void): () => void;
  /**
   * Dispatches an action (e.g. a game move, shop buy, transfer) across the bridge.
   */
  dispatchAction(module: string, sessionId: string, action: string, payload?: any): Promise<BridgeActionResult>;
  /**
   * Requests the real-time dashboard overview.
   */
  getOverview(): Promise<DashboardOverview>;
  /**
   * Listens for targeted audio cues dispatched to this user.
   */
  onAudioCue(callback: (audio: BridgeAudioCue) => void): () => void;
  /**
   * Listens for live toast notifications dispatched to this user.
   */
  onNotification(callback: (notif: BridgeNotification) => void): () => void;
  /**
   * Listens for connection state changes (online/offline).
   */
  onConnectionChange(callback: (connected: boolean) => void): () => void;
  private notifyConnection;
  private send;
}
/**
 * Convenience factory to create a BridgeClient instance.
 */
declare function createBridgeClient(options: BridgeClientOptions): BridgeClient;
export { createBridgeClient as i, BridgeClientEvents as n, BridgeClientOptions as r, BridgeClient as t };
//# sourceMappingURL=BridgeClient-C9xyBgBX.d.cts.map