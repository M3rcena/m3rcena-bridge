Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const require_host = require("./host-lxi51wRb.cjs");
const require_BridgeClient = require("./BridgeClient-D7LYipDN.cjs");
const require_resolver = require("./resolver.cjs");
// src/index.ts
/**
* @m3rcena/bridge
* The unified real-time bridge connecting Discord bot packages (@m3rcena/weky, @m3rcena/eco)
* with Web Dashboards, REST APIs, and WebSockets.
*
* @copyright 2026 M3rcena Development. All rights reserved.
* @license Apache-2.0
*/
exports.BRIDGE_VERSION = require_host.BRIDGE_VERSION;
exports.BridgeClient = require_BridgeClient.BridgeClient;
exports.BridgeDatabaseHandler = require_host.BridgeDatabaseHandler;
exports.BridgeServer = require_host.BridgeServer;
exports.JsonFileStorageAdapter = require_host.JsonFileStorageAdapter;
exports.M3rcenaBridge = require_host.M3rcenaBridge;
exports.MemoryStorageAdapter = require_host.MemoryStorageAdapter;
exports.PRISMA_BRIDGE_MODEL = require_host.PRISMA_BRIDGE_MODEL;
exports.PrismaBridgeStorage = require_host.PrismaBridgeStorage;
exports.SqliteBridgeStorage = require_host.SqliteBridgeStorage;
exports.applyPrismaBridgeModel = require_host.applyPrismaBridgeModel;
exports.boxConsole = require_host.boxConsole;
exports.checkPackageUpdates = require_host.checkPackageUpdates;
exports.compareSemver = require_host.compareSemver;
exports.createBridgeClient = require_BridgeClient.createBridgeClient;
exports.fetchLatestVersion = require_host.fetchLatestVersion;
exports.findProjectRoot = require_resolver.findProjectRoot;
exports.generateTsConfigPaths = require_resolver.generateTsConfigPaths;
exports.getAllPackageResolutions = require_resolver.getAllPackageResolutions;
exports.hostBridge = require_host.hostBridge;
exports.isTypeScriptRuntime = require_resolver.isTypeScriptRuntime;
exports.loadResolverConfig = require_resolver.loadResolverConfig;
exports.printResolutionSummary = require_resolver.printResolutionSummary;
exports.resolveBridgeStorage = require_host.resolveBridgeStorage;
exports.resolvePackage = require_resolver.resolvePackage;
exports.stripAnsi = require_host.stripAnsi;

//# sourceMappingURL=index.cjs.map