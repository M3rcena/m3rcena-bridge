/**
 * @m3rcena/bridge
 * Pluggable Storage Adapters for Session and State Persistence.
 *
 * @copyright 2026 M3rcena Development. All rights reserved.
 * @license Apache-2.0
 */

import fs from "fs";
import path from "path";
import { BridgeSession } from "../types.js";

export interface BridgeStorageAdapter {
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
export class MemoryStorageAdapter implements BridgeStorageAdapter {
  private sessions: Map<string, BridgeSession> = new Map();
  private data: Map<string, any> = new Map();

  public async saveSession(session: BridgeSession): Promise<void> {
    this.sessions.set(session.id, { ...session });
  }

  public async getSession(id: string): Promise<BridgeSession | null> {
    const s = this.sessions.get(id);
    return s ? { ...s } : null;
  }

  public async removeSession(id: string): Promise<void> {
    this.sessions.delete(id);
  }

  public async getAllSessions(): Promise<BridgeSession[]> {
    return Array.from(this.sessions.values()).map((s) => ({ ...s }));
  }

  public async saveData(key: string, value: any): Promise<void> {
    this.data.set(key, value);
  }

  public async getData(key: string): Promise<any> {
    return this.data.get(key) ?? null;
  }
}

/**
 * Local JSON file storage adapter for state persistence across restarts.
 */
export class JsonFileStorageAdapter implements BridgeStorageAdapter {
  private filePath: string;
  private cache: { sessions: Record<string, BridgeSession>; data: Record<string, any> } = {
    sessions: {},
    data: {},
  };
  private isLoaded = false;

  constructor(filePath: string = "./bridge-data.json") {
    this.filePath = path.resolve(process.cwd(), filePath);
  }

  private async ensureLoaded(): Promise<void> {
    if (this.isLoaded) return;
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = await fs.promises.readFile(this.filePath, "utf-8");
        this.cache = JSON.parse(raw);
        this.cache.sessions = this.cache.sessions || {};
        this.cache.data = this.cache.data || {};
      }
    } catch {
      this.cache = { sessions: {}, data: {} };
    }
    this.isLoaded = true;
  }

  private async persist(): Promise<void> {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
      }
      // Serialize stripped sessions (exclude functions)
      const cleanSessions: Record<string, any> = {};
      for (const [id, s] of Object.entries(this.cache.sessions)) {
        cleanSessions[id] = {
          ...s,
          onAction: undefined,
          renderSnapshot: undefined,
        };
      }
      await fs.promises.writeFile(
        this.filePath,
        JSON.stringify({ sessions: cleanSessions, data: this.cache.data }, null, 2),
        "utf-8"
      );
    } catch (err) {
      console.error("[BridgeStorage] Failed to persist data to disk:", err);
    }
  }

  public async saveSession(session: BridgeSession): Promise<void> {
    await this.ensureLoaded();
    this.cache.sessions[session.id] = { ...session };
    await this.persist();
  }

  public async getSession(id: string): Promise<BridgeSession | null> {
    await this.ensureLoaded();
    return this.cache.sessions[id] ? { ...this.cache.sessions[id] } : null;
  }

  public async removeSession(id: string): Promise<void> {
    await this.ensureLoaded();
    delete this.cache.sessions[id];
    await this.persist();
  }

  public async getAllSessions(): Promise<BridgeSession[]> {
    await this.ensureLoaded();
    return Object.values(this.cache.sessions);
  }

  public async saveData(key: string, value: any): Promise<void> {
    await this.ensureLoaded();
    this.cache.data[key] = value;
    await this.persist();
  }

  public async getData(key: string): Promise<any> {
    await this.ensureLoaded();
    return this.cache.data[key] ?? null;
  }
}
