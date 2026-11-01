/**
 * @m3rcena/bridge
 * Native SQLite Storage Adapter using node:sqlite (Node.js >= 22.0.0).
 * Provides fast, zero-dependency, transactional local database storage for sessions and bridge data.
 *
 * @copyright 2026 M3rcena Development. All rights reserved.
 * @license Apache-2.0
 */

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { BridgeStorageAdapter } from "./BridgeStorageAdapter.js";
import { BridgeSession } from "../types.js";

export interface SqliteBridgeStorageOptions {
  /** Database file path on disk (default: "./bridge.sqlite") */
  path?: string;
  /** Whether to enable WAL mode for high concurrency (default: true) */
  walMode?: boolean;
}

export class SqliteBridgeStorage implements BridgeStorageAdapter {
  private db: DatabaseSync;
  public readonly dbPath: string;

  constructor(options: string | SqliteBridgeStorageOptions = "./bridge.sqlite") {
    const rawPath = typeof options === "string" ? options : options.path || "./bridge.sqlite";
    this.dbPath = path.resolve(process.cwd(), rawPath);

    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new DatabaseSync(this.dbPath);

    const wal = typeof options === "object" ? options.walMode ?? true : true;
    if (wal) {
      try {
        this.db.exec("PRAGMA journal_mode = WAL;");
      } catch {
        // Safe ignore
      }
    }

    this.initTables();
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS bridge_sessions (
        id TEXT PRIMARY KEY,
        module TEXT,
        state TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS bridge_data (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_bridge_sessions_module ON bridge_sessions (module);
      CREATE INDEX IF NOT EXISTS idx_bridge_sessions_updated ON bridge_sessions (updated_at DESC);
    `);
  }

  public async saveSession(session: BridgeSession): Promise<void> {
    const now = Date.now();
    const cleanSession: Partial<BridgeSession> = {
      ...session,
      onAction: undefined,
      renderSnapshot: undefined,
    };
    const serialized = JSON.stringify(cleanSession);

    const stmt = this.db.prepare(`
      INSERT INTO bridge_sessions (id, module, state, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        module = excluded.module,
        state = excluded.state,
        updated_at = excluded.updated_at
    `);

    stmt.run(
      session.id,
      session.module || "unknown",
      serialized,
      session.createdAt ? new Date(session.createdAt).getTime() : now,
      now
    );
  }

  public async getSession(id: string): Promise<BridgeSession | null> {
    const stmt = this.db.prepare("SELECT state FROM bridge_sessions WHERE id = ? LIMIT 1");
    const row = stmt.get(id) as { state: string } | undefined;
    if (!row || !row.state) return null;

    try {
      return JSON.parse(row.state) as BridgeSession;
    } catch {
      return null;
    }
  }

  public async removeSession(id: string): Promise<void> {
    const stmt = this.db.prepare("DELETE FROM bridge_sessions WHERE id = ?");
    stmt.run(id);
  }

  public async getAllSessions(): Promise<BridgeSession[]> {
    const stmt = this.db.prepare("SELECT state FROM bridge_sessions ORDER BY updated_at DESC");
    const rows = stmt.all() as { state: string }[];
    const result: BridgeSession[] = [];

    for (const r of rows) {
      try {
        if (r && r.state) {
          result.push(JSON.parse(r.state));
        }
      } catch {
        // Skip corrupted rows
      }
    }
    return result;
  }

  public async saveData(key: string, value: any): Promise<void> {
    const now = Date.now();
    const serialized = JSON.stringify(value);

    const stmt = this.db.prepare(`
      INSERT INTO bridge_data (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `);

    stmt.run(key, serialized, now);
  }

  public async getData(key: string): Promise<any> {
    const stmt = this.db.prepare("SELECT value FROM bridge_data WHERE key = ? LIMIT 1");
    const row = stmt.get(key) as { value: string } | undefined;
    if (!row || !row.value) return null;

    try {
      return JSON.parse(row.value);
    } catch {
      return null;
    }
  }

  /**
   * Closes the database connection.
   */
  public close(): void {
    try {
      this.db.close();
    } catch {
      // Safe ignore
    }
  }
}
