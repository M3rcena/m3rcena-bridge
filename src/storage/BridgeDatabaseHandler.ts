/**
 * @m3rcena/bridge
 * Unified Database Handler and Factory for SQLite, Prisma, JSON, and Memory storage.
 *
 * @copyright 2026 M3rcena Development. All rights reserved.
 * @license Apache-2.0
 */

import { BridgeStorageAdapter, MemoryStorageAdapter, JsonFileStorageAdapter } from "./BridgeStorageAdapter.js";
import { SqliteBridgeStorage, SqliteBridgeStorageOptions } from "./SqliteBridgeStorage.js";
import { PrismaBridgeStorage, PrismaBridgeStorageOptions, PRISMA_BRIDGE_MODEL, applyPrismaBridgeModel } from "./PrismaBridgeStorage.js";
import { BridgeDatabaseConfig } from "../types.js";

export class BridgeDatabaseHandler {
  /**
   * Instantiates the requested database storage adapter based on developer configuration.
   */
  public static create(config?: BridgeDatabaseConfig): BridgeStorageAdapter {
    if (!config || config === "memory") {
      return new MemoryStorageAdapter();
    }

    if (config === "sqlite") {
      return new SqliteBridgeStorage("./bridge.sqlite");
    }

    if (config === "json") {
      return new JsonFileStorageAdapter("./bridge-data.json");
    }

    if (typeof config === "object") {
      if (config.type === "sqlite") {
        return new SqliteBridgeStorage(config.path || "./bridge.sqlite");
      }

      if (config.type === "prisma") {
        return new PrismaBridgeStorage({
          client: config.client,
          sessionModel: config.model || "bridgeSession",
          autoMigrate: config.autoMigrate ?? true,
        });
      }

      if (config.type === "json") {
        return new JsonFileStorageAdapter(config.path || "./bridge-data.json");
      }

      if (config.type === "memory") {
        return new MemoryStorageAdapter();
      }
    }

    return new MemoryStorageAdapter();
  }

  /**
   * Automatically appends the Bridge models to schema.prisma if missing.
   */
  public static applyPrismaSchema(schemaPath: string = "prisma/schema.prisma"): boolean {
    return applyPrismaBridgeModel(schemaPath);
  }
}

/**
 * Resolves a BridgeStorageAdapter from either an existing storage instance or database config.
 */
export function resolveBridgeStorage(options: { storage?: any; database?: BridgeDatabaseConfig }): BridgeStorageAdapter {
  if (options.storage) {
    return options.storage;
  }
  if (options.database) {
    return BridgeDatabaseHandler.create(options.database);
  }
  return new MemoryStorageAdapter();
}

