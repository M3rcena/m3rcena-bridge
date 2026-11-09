import { a as M3rcenaBridge, i as BridgeServerOptions, n as hostBridge, o as ModuleActionHandler, r as BridgeServer, t as HostBridgeOptions } from "./host-CmHOkf00.cjs";
import { i as createBridgeClient, n as BridgeClientEvents, r as BridgeClientOptions, t as BridgeClient } from "./BridgeClient-C9xyBgBX.cjs";
import { _ as DashboardOverview, a as BridgeCompatiblePackage, c as BridgeMountable, d as BridgePackageRouter, f as BridgePlatform, g as BridgeSession, h as BridgeResponse, i as BridgeClientPresence, l as BridgeNotification, m as BridgeRequest, n as BridgeActionResult, o as BridgeDatabaseConfig, p as BridgePlayer, r as BridgeAudioCue, s as BridgeEvents, t as BridgeAction, u as BridgeOptions, v as HttpMethod } from "./types-DYX4p2eb.cjs";
import { M3rcenaPackageName, M3rcenaResolverConfig, PackageResolution, ResolverOptions, findProjectRoot, generateTsConfigPaths, getAllPackageResolutions, isTypeScriptRuntime, loadResolverConfig, printResolutionSummary, resolvePackage } from "./resolver.cjs";
interface BridgeStorageAdapter {
  saveSession(session: BridgeSession): Promise<void>;
  getSession(id: string): Promise<BridgeSession | null>;
  removeSession(id: string): Promise<void>;
  getAllSessions(): Promise<BridgeSession[]>;
  saveData(key: string, value: any): Promise<void>;
  getData(key: string): Promise<any>;
}
/**
 * In-Memory storage adapter (high performance, zero disk I/O, default).
 */
export declare class MemoryStorageAdapter implements BridgeStorageAdapter {
  private sessions;
  private data;
  saveSession(session: BridgeSession): Promise<void>;
  getSession(id: string): Promise<BridgeSession | null>;
  removeSession(id: string): Promise<void>;
  getAllSessions(): Promise<BridgeSession[]>;
  saveData(key: string, value: any): Promise<void>;
  getData(key: string): Promise<any>;
}
/**
 * Local JSON file storage adapter for state persistence across restarts.
 */
export declare class JsonFileStorageAdapter implements BridgeStorageAdapter {
  private filePath;
  private cache;
  private isLoaded;
  constructor(filePath?: string);
  private ensureLoaded;
  private persist;
  saveSession(session: BridgeSession): Promise<void>;
  getSession(id: string): Promise<BridgeSession | null>;
  removeSession(id: string): Promise<void>;
  getAllSessions(): Promise<BridgeSession[]>;
  saveData(key: string, value: any): Promise<void>;
  getData(key: string): Promise<any>;
}
interface SqliteBridgeStorageOptions {
  /** Database file path on disk (default: "./bridge.sqlite") */
  path?: string;
  /** Whether to enable WAL mode for high concurrency (default: true) */
  walMode?: boolean;
}
export declare class SqliteBridgeStorage implements BridgeStorageAdapter {
  private db;
  readonly dbPath: string;
  constructor(options?: string | SqliteBridgeStorageOptions);
  private initTables;
  saveSession(session: BridgeSession): Promise<void>;
  getSession(id: string): Promise<BridgeSession | null>;
  removeSession(id: string): Promise<void>;
  getAllSessions(): Promise<BridgeSession[]>;
  saveData(key: string, value: any): Promise<void>;
  getData(key: string): Promise<any>;
  /**
   * Closes the database connection.
   */
  close(): void;
}
/**
 * Prisma Schema snippet that developers can paste into their schema.prisma.
 */
export declare const PRISMA_BRIDGE_MODEL: string;
/**
 * Automatically inspects and appends Bridge models to a schema.prisma file if missing.
 * @param schemaPath Path to schema.prisma (default: "prisma/schema.prisma")
 * @returns True if models were appended, false if already present or schema file not found.
 */
export declare function applyPrismaBridgeModel(schemaPath?: string): boolean;
interface PrismaBridgeStorageOptions {
  /** The PrismaClient instance provided by the bot */
  client: any;
  /** Property name of the session model on the client (default: "bridgeSession") */
  sessionModel?: string;
  /** Property name of the key-value model on the client (default: "bridgeKeyValue") */
  kvModel?: string;
  /** Table name in database for sessions (default: "BridgeSession") */
  sessionTable?: string;
  /** Table name in database for kv (default: "BridgeKeyValue") */
  kvTable?: string;
  /** Automatically run table migration on connection if missing (default: true) */
  autoMigrate?: boolean;
}
export declare class PrismaBridgeStorage implements BridgeStorageAdapter {
  private client;
  private sessionModel;
  private kvModel;
  private sessionTable;
  private kvTable;
  private autoMigrate;
  private migrated;
  constructor(options: any | PrismaBridgeStorageOptions);
  ensureMigrated(): Promise<void>;
  saveSession(session: BridgeSession): Promise<void>;
  getSession(id: string): Promise<BridgeSession | null>;
  removeSession(id: string): Promise<void>;
  getAllSessions(): Promise<BridgeSession[]>;
  saveData(key: string, value: any): Promise<void>;
  getData(key: string): Promise<any>;
}
export declare class BridgeDatabaseHandler {
  /**
   * Instantiates the requested database storage adapter based on developer configuration.
   */
  static create(config?: BridgeDatabaseConfig): BridgeStorageAdapter;
  /**
   * Automatically appends the Bridge models to schema.prisma if missing.
   */
  static applyPrismaSchema(schemaPath?: string): boolean;
}
/**
 * Resolves a BridgeStorageAdapter from either an existing storage instance or database config.
 */
export declare function resolveBridgeStorage(options: {
  storage?: any;
  database?: BridgeDatabaseConfig;
}): BridgeStorageAdapter;
/**
 * @m3rcena/bridge
 * Terminal update notification box utility.
 *
 * @copyright 2026 M3rcena Development. All rights reserved.
 * @license Apache-2.0
 */
export declare const BRIDGE_VERSION = "14.28.1-1";
/**
 * Strips ANSI color escape codes to compute visible string length.
 */
export declare function stripAnsi(str: string): string;
/**
 * Renders an array of text messages inside a styled terminal box.
 */
export declare function boxConsole(messages: string[]): void;
/**
 * Compares two semantic version strings.
 * Returns -1 if v1 < v2, 0 if equal, 1 if v1 > v2.
 */
export declare function compareSemver(v1: string, v2: string): number;
/**
 * Fetches the latest published version of `@m3rcena/bridge` from the npm registry.
 */
export declare function fetchLatestVersion(): Promise<string | null>;
/**
 * Checks if a newer version of `@m3rcena/bridge` is available and logs the notification box.
 */
export declare function checkPackageUpdates(currentVersion?: string, disabled?: boolean): Promise<void>;
export { BridgeAction, BridgeActionResult, BridgeAudioCue, BridgeClient, type BridgeClientEvents, type BridgeClientOptions, BridgeClientPresence, BridgeCompatiblePackage, BridgeDatabaseConfig, BridgeEvents, BridgeMountable, BridgeNotification, BridgeOptions, BridgePackageRouter, BridgePlatform, BridgePlayer, BridgeRequest, BridgeResponse, BridgeServer, type BridgeServerOptions, BridgeSession, type BridgeStorageAdapter, DashboardOverview, HostBridgeOptions, HttpMethod, M3rcenaBridge, M3rcenaPackageName, M3rcenaResolverConfig, type ModuleActionHandler, PackageResolution, type PrismaBridgeStorageOptions, ResolverOptions, type SqliteBridgeStorageOptions, createBridgeClient, findProjectRoot, generateTsConfigPaths, getAllPackageResolutions, hostBridge, isTypeScriptRuntime, loadResolverConfig, printResolutionSummary, resolvePackage };
//# sourceMappingURL=index.d.cts.map