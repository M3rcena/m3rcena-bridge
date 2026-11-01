/**
 * @m3rcena/bridge
 * The unified real-time bridge connecting Discord bot packages (@m3rcena/weky, @m3rcena/eco)
 * with Web Dashboards, REST APIs, and WebSockets.
 *
 * @copyright 2026 M3rcena Development. All rights reserved.
 * @license Apache-2.0
 */

// Core Bridge
export { M3rcenaBridge, type ModuleActionHandler } from "./M3rcenaBridge.js";

// Server Gateway
export { BridgeServer, type BridgeServerOptions } from "./server/BridgeServer.js";

// Client SDK
export { BridgeClient, createBridgeClient, type BridgeClientOptions } from "./client/BridgeClient.js";

// Storage Adapters
export {
  type BridgeStorageAdapter,
  MemoryStorageAdapter,
  JsonFileStorageAdapter,
} from "./storage/BridgeStorageAdapter.js";
export {
  SqliteBridgeStorage,
  type SqliteBridgeStorageOptions,
} from "./storage/SqliteBridgeStorage.js";
export {
  PrismaBridgeStorage,
  type PrismaBridgeStorageOptions,
  PRISMA_BRIDGE_MODEL,
  applyPrismaBridgeModel,
} from "./storage/PrismaBridgeStorage.js";
export {
  BridgeDatabaseHandler,
  resolveBridgeStorage,
} from "./storage/BridgeDatabaseHandler.js";

// Types
export * from "./types.js";

// Update Notifier
export {
  boxConsole,
  checkPackageUpdates,
  compareSemver,
  fetchLatestVersion,
  stripAnsi,
  BRIDGE_VERSION,
} from "./utils/Notifier.js";

