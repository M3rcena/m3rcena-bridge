/**
 * @m3rcena/bridge
 * Enterprise Prisma Storage Adapter for Bridge Sessions and Key-Value Data.
 *
 * @copyright 2026 M3rcena Development. All rights reserved.
 * @license Apache-2.0
 */

import fs from "node:fs";
import path from "node:path";
import { BridgeStorageAdapter } from "./BridgeStorageAdapter.js";
import { BridgeSession } from "../types.js";

/**
 * Prisma Schema snippet that developers can paste into their schema.prisma.
 */
export const PRISMA_BRIDGE_MODEL = `
// Added by @m3rcena/bridge
model BridgeSession {
  id        String   @id
  module    String?
  state     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model BridgeKeyValue {
  key       String   @id
  value     String
  updatedAt DateTime @updatedAt
}
`.trim();

/**
 * Automatically inspects and appends Bridge models to a schema.prisma file if missing.
 * @param schemaPath Path to schema.prisma (default: "prisma/schema.prisma")
 * @returns True if models were appended, false if already present or schema file not found.
 */
export function applyPrismaBridgeModel(schemaPath: string = "prisma/schema.prisma"): boolean {
  try {
    const resolved = path.resolve(process.cwd(), schemaPath);
    if (!fs.existsSync(resolved)) {
      return false;
    }
    const content = fs.readFileSync(resolved, "utf-8");
    if (content.includes("model BridgeSession")) {
      return false; // Already present
    }
    const updated = `${content.trim()}\n\n${PRISMA_BRIDGE_MODEL}\n`;
    fs.writeFileSync(resolved, updated, "utf-8");
    return true;
  } catch (err) {
    console.error("[applyPrismaBridgeModel] Failed to append model to schema:", err);
    return false;
  }
}

export interface PrismaBridgeStorageOptions {
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

export class PrismaBridgeStorage implements BridgeStorageAdapter {
  private client: any;
  private sessionModel: string;
  private kvModel: string;
  private sessionTable: string;
  private kvTable: string;
  private autoMigrate: boolean;
  private migrated = false;

  constructor(options: any | PrismaBridgeStorageOptions) {
    if (options && options.client) {
      this.client = options.client;
      this.sessionModel = options.sessionModel || "bridgeSession";
      this.kvModel = options.kvModel || "bridgeKeyValue";
      this.sessionTable = options.sessionTable || "BridgeSession";
      this.kvTable = options.kvTable || "BridgeKeyValue";
      this.autoMigrate = options.autoMigrate ?? true;
    } else {
      this.client = options;
      this.sessionModel = "bridgeSession";
      this.kvModel = "bridgeKeyValue";
      this.sessionTable = "BridgeSession";
      this.kvTable = "BridgeKeyValue";
      this.autoMigrate = true;
    }
  }

  private async ensureMigrated(): Promise<void> {
    if (this.migrated || !this.autoMigrate || !this.client) return;
    this.migrated = true;

    if (this.client[this.sessionModel] && this.client[this.kvModel]) {
      return;
    }

    if (typeof this.client.$executeRawUnsafe === "function") {
      try {
        await this.client.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "${this.sessionTable}" (
            "id" VARCHAR(191) PRIMARY KEY,
            "module" VARCHAR(191),
            "state" TEXT NOT NULL,
            "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `);
        await this.client.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "${this.kvTable}" (
            "key" VARCHAR(191) PRIMARY KEY,
            "value" TEXT NOT NULL,
            "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `);
      } catch {
        try {
          await this.client.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS ${this.sessionTable} (
              id TEXT PRIMARY KEY,
              module TEXT,
              state TEXT NOT NULL,
              createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
              updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
            );
          `);
          await this.client.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS ${this.kvTable} (
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL,
              updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
            );
          `);
        } catch {
          // Ignore if already created or permission denied
        }
      }
    }
  }

  public async saveSession(session: BridgeSession): Promise<void> {
    await this.ensureMigrated();
    const cleanSession: Partial<BridgeSession> = {
      ...session,
      onAction: undefined,
      renderSnapshot: undefined,
    };
    const serialized = JSON.stringify(cleanSession);

    const delegate = this.client[this.sessionModel];
    if (delegate && typeof delegate.upsert === "function") {
      try {
        await delegate.upsert({
          where: { id: session.id },
          update: {
            module: session.module || null,
            state: serialized,
            updatedAt: new Date(),
          },
          create: {
            id: session.id,
            module: session.module || null,
            state: serialized,
            createdAt: session.createdAt ? new Date(session.createdAt) : new Date(),
            updatedAt: new Date(),
          },
        });
        return;
      } catch {
        // Fallback to raw query
      }
    }

    if (typeof this.client.$executeRawUnsafe === "function") {
      try {
        await this.client.$executeRawUnsafe(
          `
          INSERT INTO "${this.sessionTable}" ("id", "module", "state", "updatedAt")
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT ("id") DO UPDATE SET
            "module" = EXCLUDED."module",
            "state" = EXCLUDED."state",
            "updatedAt" = NOW()
          `,
          session.id,
          session.module || null,
          serialized
        );
      } catch {
        await this.client.$executeRawUnsafe(
          `
          INSERT INTO ${this.sessionTable} (id, module, state, updatedAt)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(id) DO UPDATE SET
            module = excluded.module,
            state = excluded.state,
            updatedAt = CURRENT_TIMESTAMP
          `,
          session.id,
          session.module || null,
          serialized
        );
      }
    }
  }

  public async getSession(id: string): Promise<BridgeSession | null> {
    await this.ensureMigrated();
    const delegate = this.client[this.sessionModel];

    if (delegate && typeof delegate.findUnique === "function") {
      try {
        const record = await delegate.findUnique({ where: { id } });
        if (!record || !record.state) return null;
        return typeof record.state === "string" ? JSON.parse(record.state) : record.state;
      } catch {
        // Fallback
      }
    }

    if (typeof this.client.$queryRawUnsafe === "function") {
      try {
        const rows: any[] = await this.client.$queryRawUnsafe(
          `SELECT state FROM "${this.sessionTable}" WHERE id = $1 LIMIT 1`,
          id
        );
        if (rows && rows.length > 0 && rows[0].state) {
          return JSON.parse(rows[0].state);
        }
      } catch {
        try {
          const rows: any[] = await this.client.$queryRawUnsafe(
            `SELECT state FROM ${this.sessionTable} WHERE id = ? LIMIT 1`,
            id
          );
          if (rows && rows.length > 0 && rows[0].state) {
            return JSON.parse(rows[0].state);
          }
        } catch {
          return null;
        }
      }
    }

    return null;
  }

  public async removeSession(id: string): Promise<void> {
    await this.ensureMigrated();
    const delegate = this.client[this.sessionModel];

    if (delegate && typeof delegate.delete === "function") {
      try {
        await delegate.delete({ where: { id } });
        return;
      } catch {
        // Fallback
      }
    }

    if (typeof this.client.$executeRawUnsafe === "function") {
      try {
        await this.client.$executeRawUnsafe(`DELETE FROM "${this.sessionTable}" WHERE id = $1`, id);
      } catch {
        await this.client.$executeRawUnsafe(`DELETE FROM ${this.sessionTable} WHERE id = ?`, id);
      }
    }
  }

  public async getAllSessions(): Promise<BridgeSession[]> {
    await this.ensureMigrated();
    const delegate = this.client[this.sessionModel];

    if (delegate && typeof delegate.findMany === "function") {
      try {
        const records = await delegate.findMany({ orderBy: { updatedAt: "desc" } });
        return records.map((r: any) => (typeof r.state === "string" ? JSON.parse(r.state) : r.state)).filter(Boolean);
      } catch {
        // Fallback
      }
    }

    if (typeof this.client.$queryRawUnsafe === "function") {
      try {
        const rows: any[] = await this.client.$queryRawUnsafe(`SELECT state FROM ${this.sessionTable}`);
        return rows.map((r) => JSON.parse(r.state)).filter(Boolean);
      } catch {
        return [];
      }
    }

    return [];
  }

  public async saveData(key: string, value: any): Promise<void> {
    await this.ensureMigrated();
    const serialized = JSON.stringify(value);
    const delegate = this.client[this.kvModel];

    if (delegate && typeof delegate.upsert === "function") {
      try {
        await delegate.upsert({
          where: { key },
          update: { value: serialized, updatedAt: new Date() },
          create: { key, value: serialized, updatedAt: new Date() },
        });
        return;
      } catch {
        // Fallback
      }
    }

    if (typeof this.client.$executeRawUnsafe === "function") {
      try {
        await this.client.$executeRawUnsafe(
          `
          INSERT INTO "${this.kvTable}" ("key", "value", "updatedAt")
          VALUES ($1, $2, NOW())
          ON CONFLICT ("key") DO UPDATE SET
            "value" = EXCLUDED."value",
            "updatedAt" = NOW()
          `,
          key,
          serialized
        );
      } catch {
        await this.client.$executeRawUnsafe(
          `
          INSERT INTO ${this.kvTable} (key, value, updatedAt)
          VALUES (?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            updatedAt = CURRENT_TIMESTAMP
          `,
          key,
          serialized
        );
      }
    }
  }

  public async getData(key: string): Promise<any> {
    await this.ensureMigrated();
    const delegate = this.client[this.kvModel];

    if (delegate && typeof delegate.findUnique === "function") {
      try {
        const record = await delegate.findUnique({ where: { key } });
        if (!record || !record.value) return null;
        return typeof record.value === "string" ? JSON.parse(record.value) : record.value;
      } catch {
        // Fallback
      }
    }

    if (typeof this.client.$queryRawUnsafe === "function") {
      try {
        const rows: any[] = await this.client.$queryRawUnsafe(
          `SELECT value FROM "${this.kvTable}" WHERE key = $1 LIMIT 1`,
          key
        );
        if (rows && rows.length > 0 && rows[0].value) {
          return JSON.parse(rows[0].value);
        }
      } catch {
        try {
          const rows: any[] = await this.client.$queryRawUnsafe(
            `SELECT value FROM ${this.kvTable} WHERE key = ? LIMIT 1`,
            key
          );
          if (rows && rows.length > 0 && rows[0].value) {
            return JSON.parse(rows[0].value);
          }
        } catch {
          return null;
        }
      }
    }

    return null;
  }
}
