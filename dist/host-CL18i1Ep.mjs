import { getAllPackageResolutions, printResolutionSummary } from "./resolver.mjs";
import { EventEmitter } from "events";
import fs from "fs";
import path from "path";
import fs$1 from "node:fs";
import path$1 from "node:path";
import { DatabaseSync } from "node:sqlite";
import http from "http";
import { WebSocket, WebSocketServer } from "ws";
// src/storage/BridgeStorageAdapter.ts
/**
* @m3rcena/bridge
* Pluggable Storage Adapters for Session and State Persistence.
*
* @copyright 2026 M3rcena Development. All rights reserved.
* @license Apache-2.0
*/
/**
* In-Memory storage adapter (high performance, zero disk I/O, default).
*/
var MemoryStorageAdapter = class {
	sessions = /* @__PURE__ */ new Map();
	data = /* @__PURE__ */ new Map();
	async saveSession(session) {
		this.sessions.set(session.id, { ...session });
	}
	async getSession(id) {
		const s = this.sessions.get(id);
		return s ? { ...s } : null;
	}
	async removeSession(id) {
		this.sessions.delete(id);
	}
	async getAllSessions() {
		return Array.from(this.sessions.values()).map((s) => ({ ...s }));
	}
	async saveData(key, value) {
		this.data.set(key, value);
	}
	async getData(key) {
		return this.data.get(key) ?? null;
	}
};
/**
* Local JSON file storage adapter for state persistence across restarts.
*/
var JsonFileStorageAdapter = class {
	filePath;
	cache = {
		sessions: {},
		data: {}
	};
	isLoaded = false;
	constructor(filePath = "./bridge-data.json") {
		this.filePath = path.resolve(process.cwd(), filePath);
	}
	async ensureLoaded() {
		if (this.isLoaded) return;
		try {
			if (fs.existsSync(this.filePath)) {
				const raw = await fs.promises.readFile(this.filePath, "utf-8");
				this.cache = JSON.parse(raw);
				this.cache.sessions = this.cache.sessions || {};
				this.cache.data = this.cache.data || {};
			}
		} catch {
			this.cache = {
				sessions: {},
				data: {}
			};
		}
		this.isLoaded = true;
	}
	async persist() {
		try {
			const dir = path.dirname(this.filePath);
			if (!fs.existsSync(dir)) await fs.promises.mkdir(dir, { recursive: true });
			const cleanSessions = {};
			for (const [id, s] of Object.entries(this.cache.sessions)) cleanSessions[id] = {
				...s,
				onAction: void 0,
				renderSnapshot: void 0
			};
			await fs.promises.writeFile(this.filePath, JSON.stringify({
				sessions: cleanSessions,
				data: this.cache.data
			}, null, 2), "utf-8");
		} catch (err) {
			console.error("[BridgeStorage] Failed to persist data to disk:", err);
		}
	}
	async saveSession(session) {
		await this.ensureLoaded();
		this.cache.sessions[session.id] = { ...session };
		await this.persist();
	}
	async getSession(id) {
		await this.ensureLoaded();
		return this.cache.sessions[id] ? { ...this.cache.sessions[id] } : null;
	}
	async removeSession(id) {
		await this.ensureLoaded();
		delete this.cache.sessions[id];
		await this.persist();
	}
	async getAllSessions() {
		await this.ensureLoaded();
		return Object.values(this.cache.sessions);
	}
	async saveData(key, value) {
		await this.ensureLoaded();
		this.cache.data[key] = value;
		await this.persist();
	}
	async getData(key) {
		await this.ensureLoaded();
		return this.cache.data[key] ?? null;
	}
};
// src/storage/SqliteBridgeStorage.ts
/**
* @m3rcena/bridge
* Native SQLite Storage Adapter using node:sqlite (Node.js >= 22.0.0).
* Provides fast, zero-dependency, transactional local database storage for sessions and bridge data.
*
* @copyright 2026 M3rcena Development. All rights reserved.
* @license Apache-2.0
*/
var SqliteBridgeStorage = class {
	db;
	dbPath;
	constructor(options = "./bridge.sqlite") {
		const rawPath = typeof options === "string" ? options : options.path || "./bridge.sqlite";
		if (rawPath === ":memory:") this.dbPath = ":memory:";
		else {
			this.dbPath = path$1.resolve(process.cwd(), rawPath);
			const dir = path$1.dirname(this.dbPath);
			if (!fs$1.existsSync(dir)) fs$1.mkdirSync(dir, { recursive: true });
		}
		this.db = new DatabaseSync(this.dbPath);
		if (typeof options === "object" ? options.walMode ?? true : true) try {
			this.db.exec("PRAGMA journal_mode = WAL;");
		} catch {}
		this.initTables();
	}
	initTables() {
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
	async saveSession(session) {
		const now = Date.now();
		const cleanSession = {
			...session,
			onAction: void 0,
			renderSnapshot: void 0
		};
		const serialized = JSON.stringify(cleanSession);
		this.db.prepare(`
      INSERT INTO bridge_sessions (id, module, state, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        module = excluded.module,
        state = excluded.state,
        updated_at = excluded.updated_at
    `).run(session.id, session.module || "unknown", serialized, session.createdAt ? new Date(session.createdAt).getTime() : now, now);
	}
	async getSession(id) {
		const row = this.db.prepare("SELECT state FROM bridge_sessions WHERE id = ? LIMIT 1").get(id);
		if (!row || !row.state) return null;
		try {
			return JSON.parse(row.state);
		} catch {
			return null;
		}
	}
	async removeSession(id) {
		this.db.prepare("DELETE FROM bridge_sessions WHERE id = ?").run(id);
	}
	async getAllSessions() {
		const rows = this.db.prepare("SELECT state FROM bridge_sessions ORDER BY updated_at DESC").all();
		const result = [];
		for (const r of rows) try {
			if (r && r.state) result.push(JSON.parse(r.state));
		} catch {}
		return result;
	}
	async saveData(key, value) {
		const now = Date.now();
		const serialized = JSON.stringify(value);
		this.db.prepare(`
      INSERT INTO bridge_data (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `).run(key, serialized, now);
	}
	async getData(key) {
		const row = this.db.prepare("SELECT value FROM bridge_data WHERE key = ? LIMIT 1").get(key);
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
	close() {
		try {
			this.db.close();
		} catch {}
	}
};
// src/storage/PrismaBridgeStorage.ts
/**
* @m3rcena/bridge
* Enterprise Prisma Storage Adapter for Bridge Sessions and Key-Value Data.
*
* @copyright 2026 M3rcena Development. All rights reserved.
* @license Apache-2.0
*/
/**
* Prisma Schema snippet that developers can paste into their schema.prisma.
*/
const PRISMA_BRIDGE_MODEL = `
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
function applyPrismaBridgeModel(schemaPath = "prisma/schema.prisma") {
	try {
		const resolved = path$1.resolve(process.cwd(), schemaPath);
		if (!fs$1.existsSync(resolved)) return false;
		const content = fs$1.readFileSync(resolved, "utf-8");
		if (content.includes("model BridgeSession")) return false;
		const updated = `${content.trim()}\n\n${PRISMA_BRIDGE_MODEL}\n`;
		fs$1.writeFileSync(resolved, updated, "utf-8");
		return true;
	} catch (err) {
		console.error("[applyPrismaBridgeModel] Failed to append model to schema:", err);
		return false;
	}
}
var PrismaBridgeStorage = class {
	client;
	sessionModel;
	kvModel;
	sessionTable;
	kvTable;
	autoMigrate;
	migrated = false;
	constructor(options) {
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
	async ensureMigrated() {
		if (this.migrated || !this.autoMigrate || !this.client) return;
		this.migrated = true;
		if (typeof this.client.$executeRawUnsafe === "function") try {
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
			} catch {}
		}
	}
	async saveSession(session) {
		await this.ensureMigrated();
		const cleanSession = {
			...session,
			onAction: void 0,
			renderSnapshot: void 0
		};
		const serialized = JSON.stringify(cleanSession);
		const delegate = this.client[this.sessionModel];
		if (delegate && typeof delegate.upsert === "function") try {
			await delegate.upsert({
				where: { id: session.id },
				update: {
					module: session.module || null,
					state: serialized,
					updatedAt: /* @__PURE__ */ new Date()
				},
				create: {
					id: session.id,
					module: session.module || null,
					state: serialized,
					createdAt: session.createdAt ? new Date(session.createdAt) : /* @__PURE__ */ new Date(),
					updatedAt: /* @__PURE__ */ new Date()
				}
			});
			return;
		} catch {}
		if (typeof this.client.$executeRawUnsafe === "function") try {
			await this.client.$executeRawUnsafe(`
          INSERT INTO "${this.sessionTable}" ("id", "module", "state", "updatedAt")
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT ("id") DO UPDATE SET
            "module" = EXCLUDED."module",
            "state" = EXCLUDED."state",
            "updatedAt" = NOW()
          `, session.id, session.module || null, serialized);
			return;
		} catch {
			try {
				await this.client.$executeRawUnsafe(`
            INSERT INTO ${this.sessionTable} (id, module, state, updatedAt)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
              module = excluded.module,
              state = excluded.state,
              updatedAt = CURRENT_TIMESTAMP
            `, session.id, session.module || null, serialized);
			} catch {}
		}
	}
	async getSession(id) {
		await this.ensureMigrated();
		const delegate = this.client[this.sessionModel];
		if (delegate && typeof delegate.findUnique === "function") try {
			const record = await delegate.findUnique({ where: { id } });
			if (!record || !record.state) return null;
			return typeof record.state === "string" ? JSON.parse(record.state) : record.state;
		} catch {}
		if (typeof this.client.$queryRawUnsafe === "function") try {
			const rows = await this.client.$queryRawUnsafe(`SELECT state FROM "${this.sessionTable}" WHERE id = $1 LIMIT 1`, id);
			if (rows && rows.length > 0 && rows[0].state) return JSON.parse(rows[0].state);
		} catch {
			try {
				const rows = await this.client.$queryRawUnsafe(`SELECT state FROM ${this.sessionTable} WHERE id = ? LIMIT 1`, id);
				if (rows && rows.length > 0 && rows[0].state) return JSON.parse(rows[0].state);
			} catch {
				return null;
			}
		}
		return null;
	}
	async removeSession(id) {
		await this.ensureMigrated();
		const delegate = this.client[this.sessionModel];
		if (delegate && typeof delegate.delete === "function") try {
			await delegate.delete({ where: { id } });
			return;
		} catch {}
		if (typeof this.client.$executeRawUnsafe === "function") try {
			await this.client.$executeRawUnsafe(`DELETE FROM "${this.sessionTable}" WHERE id = $1`, id);
		} catch {
			try {
				await this.client.$executeRawUnsafe(`DELETE FROM ${this.sessionTable} WHERE id = ?`, id);
			} catch {}
		}
	}
	async getAllSessions() {
		await this.ensureMigrated();
		const delegate = this.client[this.sessionModel];
		if (delegate && typeof delegate.findMany === "function") try {
			return (await delegate.findMany({ orderBy: { updatedAt: "desc" } })).map((r) => typeof r.state === "string" ? JSON.parse(r.state) : r.state).filter(Boolean);
		} catch {}
		if (typeof this.client.$queryRawUnsafe === "function") try {
			return (await this.client.$queryRawUnsafe(`SELECT state FROM ${this.sessionTable}`)).map((r) => JSON.parse(r.state)).filter(Boolean);
		} catch {
			return [];
		}
		return [];
	}
	async saveData(key, value) {
		await this.ensureMigrated();
		const serialized = JSON.stringify(value);
		const delegate = this.client[this.kvModel];
		if (delegate && typeof delegate.upsert === "function") try {
			await delegate.upsert({
				where: { key },
				update: {
					value: serialized,
					updatedAt: /* @__PURE__ */ new Date()
				},
				create: {
					key,
					value: serialized,
					updatedAt: /* @__PURE__ */ new Date()
				}
			});
			return;
		} catch {}
		if (typeof this.client.$executeRawUnsafe === "function") try {
			await this.client.$executeRawUnsafe(`
          INSERT INTO "${this.kvTable}" ("key", "value", "updatedAt")
          VALUES ($1, $2, NOW())
          ON CONFLICT ("key") DO UPDATE SET
            "value" = EXCLUDED."value",
            "updatedAt" = NOW()
          `, key, serialized);
			return;
		} catch {
			try {
				await this.client.$executeRawUnsafe(`
            INSERT INTO ${this.kvTable} (key, value, updatedAt)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET
              value = excluded.value,
              updatedAt = CURRENT_TIMESTAMP
            `, key, serialized);
			} catch {}
		}
	}
	async getData(key) {
		await this.ensureMigrated();
		const delegate = this.client[this.kvModel];
		if (delegate && typeof delegate.findUnique === "function") try {
			const record = await delegate.findUnique({ where: { key } });
			if (!record || !record.value) return null;
			return typeof record.value === "string" ? JSON.parse(record.value) : record.value;
		} catch {}
		if (typeof this.client.$queryRawUnsafe === "function") try {
			const rows = await this.client.$queryRawUnsafe(`SELECT value FROM "${this.kvTable}" WHERE key = $1 LIMIT 1`, key);
			if (rows && rows.length > 0 && rows[0].value) return JSON.parse(rows[0].value);
		} catch {
			try {
				const rows = await this.client.$queryRawUnsafe(`SELECT value FROM ${this.kvTable} WHERE key = ? LIMIT 1`, key);
				if (rows && rows.length > 0 && rows[0].value) return JSON.parse(rows[0].value);
			} catch {
				return null;
			}
		}
		return null;
	}
};
// src/storage/BridgeDatabaseHandler.ts
/**
* @m3rcena/bridge
* Unified Database Handler and Factory for SQLite, Prisma, JSON, and Memory storage.
*
* @copyright 2026 M3rcena Development. All rights reserved.
* @license Apache-2.0
*/
var BridgeDatabaseHandler = class {
	/**
	* Instantiates the requested database storage adapter based on developer configuration.
	*/
	static create(config) {
		if (!config || config === "memory") return new MemoryStorageAdapter();
		if (config === "sqlite") return new SqliteBridgeStorage("./bridge.sqlite");
		if (config === "json") return new JsonFileStorageAdapter("./bridge-data.json");
		if (typeof config === "object") {
			if (config.type === "sqlite") return new SqliteBridgeStorage(config.path || "./bridge.sqlite");
			if (config.type === "prisma") return new PrismaBridgeStorage({
				client: config.client,
				sessionModel: config.model || "bridgeSession",
				autoMigrate: config.autoMigrate ?? true
			});
			if (config.type === "json") return new JsonFileStorageAdapter(config.path || "./bridge-data.json");
			if (config.type === "memory") return new MemoryStorageAdapter();
		}
		return new MemoryStorageAdapter();
	}
	/**
	* Automatically appends the Bridge models to schema.prisma if missing.
	*/
	static applyPrismaSchema(schemaPath = "prisma/schema.prisma") {
		return applyPrismaBridgeModel(schemaPath);
	}
};
/**
* Resolves a BridgeStorageAdapter from either an existing storage instance or database config.
*/
function resolveBridgeStorage(options) {
	if (options.storage) return options.storage;
	if (options.database) return BridgeDatabaseHandler.create(options.database);
	return new MemoryStorageAdapter();
}
// src/utils/Notifier.ts
/**
* @m3rcena/bridge
* Terminal update notification box utility.
*
* @copyright 2026 M3rcena Development. All rights reserved.
* @license Apache-2.0
*/
const yellow = (s) => `\x1b[33m${s}\x1b[39m`;
const green = (s) => `\x1b[32m${s}\x1b[39m`;
const red = (s) => `\x1b[31m${s}\x1b[39m`;
const cyan = (s) => `\x1b[36m${s}\x1b[39m`;
const BRIDGE_VERSION = "14.28.1-1";
/**
* Strips ANSI color escape codes to compute visible string length.
*/
function stripAnsi(str) {
	return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "");
}
/**
* Renders an array of text messages inside a styled terminal box.
*/
function boxConsole(messages) {
	const stripped = messages.map((m) => stripAnsi(m));
	const maxLen = Math.max(...stripped.map((s) => s.length)) + 8;
	const line = yellow("─".repeat(maxLen));
	console.log(yellow("┌") + line + yellow("┐"));
	console.log(yellow("│") + " ".repeat(maxLen) + yellow("│"));
	for (let i = 0; i < messages.length; i++) {
		const padTotal = maxLen - stripped[i].length;
		const padLeft = Math.floor(padTotal / 2);
		const padRight = padTotal - padLeft;
		console.log(yellow("│") + " ".repeat(padLeft) + messages[i] + " ".repeat(padRight) + yellow("│"));
	}
	console.log(yellow("│") + " ".repeat(maxLen) + yellow("│"));
	console.log(yellow("└") + line + yellow("┘"));
}
/**
* Compares two semantic version strings.
* Returns -1 if v1 < v2, 0 if equal, 1 if v1 > v2.
*/
function compareSemver(v1, v2) {
	const clean1 = v1.replace(/^v/, "").split("-")[0].split(".").map((n) => parseInt(n, 10) || 0);
	const clean2 = v2.replace(/^v/, "").split("-")[0].split(".").map((n) => parseInt(n, 10) || 0);
	for (let i = 0; i < Math.max(clean1.length, clean2.length); i++) {
		const num1 = clean1[i] || 0;
		const num2 = clean2[i] || 0;
		if (num1 > num2) return 1;
		if (num1 < num2) return -1;
	}
	return 0;
}
/**
* Fetches the latest published version of `@m3rcena/bridge` from the npm registry.
*/
async function fetchLatestVersion() {
	try {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 3500);
		timer.unref?.();
		const res = await fetch("https://registry.npmjs.org/@m3rcena/bridge/latest", {
			signal: controller.signal,
			headers: { "User-Agent": "@m3rcena/bridge-update-notifier" }
		});
		clearTimeout(timer);
		if (res.ok) {
			const data = await res.json();
			return typeof data.version === "string" ? data.version : null;
		}
	} catch {
		try {
			const { exec } = await import("child_process");
			const { promisify } = await import("util");
			const { stdout } = await promisify(exec)("npm show @m3rcena/bridge version", { timeout: 3500 });
			return stdout.trim() || null;
		} catch {
			return null;
		}
	}
	return null;
}
/**
* Checks if a newer version of `@m3rcena/bridge` is available and logs the notification box.
*/
async function checkPackageUpdates(currentVersion = BRIDGE_VERSION, disabled) {
	if (disabled) return;
	try {
		const latest = await fetchLatestVersion();
		if (!latest) return;
		if (compareSemver(currentVersion, latest) < 0) boxConsole([
			`New ${green("version")} of ${yellow("@m3rcena/bridge")} is available!`,
			`${red(currentVersion)} -> ${green(latest)}`,
			`Registry: ${cyan("https://www.npmjs.com/package/@m3rcena/bridge")}`,
			`Run ${green(`npm i @m3rcena/bridge@${latest}`)} to update!`
		]);
	} catch {}
}
// src/M3rcenaBridge.ts
/**
* @m3rcena/bridge
* The Universal Central Bridge Controller.
* Connects Discord bots, Headless Engines, and Web Dashboards with unified state synchronization,
* cross-platform action dispatching, user presence tracking, and targeted audio cues.
*
* @copyright 2026 M3rcena Development. All rights reserved.
* @license Apache-2.0
*/
var M3rcenaBridge = class extends EventEmitter {
	storage;
	options;
	activeSessions = /* @__PURE__ */ new Map();
	onlinePresences = /* @__PURE__ */ new Map();
	moduleHandlers = /* @__PURE__ */ new Map();
	mountedRouters = /* @__PURE__ */ new Map();
	registeredModules = /* @__PURE__ */ new Set();
	startTime = Date.now();
	stats = {
		totalActionsDispatched: 0,
		totalSessionsCreated: 0,
		totalAudioCuesDispatched: 0,
		totalNotificationsDispatched: 0
	};
	constructor(options = {}) {
		super();
		this.options = {
			autoCleanEndedSessions: options.autoCleanEndedSessions ?? false,
			sessionTimeoutMs: options.sessionTimeoutMs ?? 18e5,
			requireOnlinePresenceForAudio: options.requireOnlinePresenceForAudio ?? false,
			notifyUpdates: options.notifyUpdates ?? true
		};
		this.storage = resolveBridgeStorage(options);
		if (this.options.notifyUpdates) checkPackageUpdates(BRIDGE_VERSION, false).catch(() => {});
	}
	emit(event, ...args) {
		return super.emit(event, ...args);
	}
	on(event, listener) {
		return super.on(event, listener);
	}
	once(event, listener) {
		return super.once(event, listener);
	}
	off(event, listener) {
		return super.off(event, listener);
	}
	addListener(event, listener) {
		return super.addListener(event, listener);
	}
	removeListener(event, listener) {
		return super.removeListener(event, listener);
	}
	prependListener(event, listener) {
		return super.prependListener(event, listener);
	}
	prependOnceListener(event, listener) {
		return super.prependOnceListener(event, listener);
	}
	/**
	* Registers a module (e.g. "games", "economy", "moderation") with an optional action handler.
	*/
	registerModule(name, defaultActionHandler) {
		this.registeredModules.add(name);
		if (defaultActionHandler) this.moduleHandlers.set(name, defaultActionHandler);
		return this;
	}
	/**
	* Returns all registered module keys.
	*/
	getRegisteredModules() {
		return Array.from(this.registeredModules);
	}
	/**
	* Universal method to mount any package, router, or plugin into the Bridge.
	* Supports WekyManager, EcoManager, custom packages, or raw BridgePackageRouter instances.
	* Enables fluent chaining:
	* ```typescript
	* bridge.use(weky).use(eco);
	* ```
	*/
	use(mountable) {
		return this.mount(mountable);
	}
	/**
	* Mounts a package or router into the Bridge.
	* Alias for bridge.use().
	*/
	mount(mountable) {
		if (!mountable) return this;
		if (typeof mountable.name === "string" && typeof mountable.basePath === "string" && typeof mountable.handleRequest === "function") {
			this.mountedRouters.set(mountable.name, mountable);
			this.registeredModules.add(mountable.name);
			return this;
		}
		let router;
		if (typeof mountable.toBridgeRouter === "function") router = mountable.toBridgeRouter();
		else if (mountable.router && typeof mountable.router.handleRequest === "function") router = mountable.router;
		else if (mountable.bridgeRouter && typeof mountable.bridgeRouter.handleRequest === "function") router = mountable.bridgeRouter;
		else if (mountable.bridge?.router && typeof mountable.bridge.router.handleRequest === "function") router = mountable.bridge.router;
		if (router) {
			this.mountedRouters.set(router.name, router);
			this.registeredModules.add(router.name);
		}
		if (typeof mountable.connectBridge === "function") mountable.connectBridge(this);
		else if (typeof mountable.setBridge === "function") mountable.setBridge(this);
		return this;
	}
	/**
	* Mounts a package router or compatible package into the Bridge.
	* Accepts either a BridgePackageRouter or a package instance (WekyManager, EcoManager, etc.).
	*/
	mountPackage(routerOrPackage) {
		return this.mount(routerOrPackage);
	}
	/**
	* Returns all mounted package routers.
	*/
	getMountedRouters() {
		return Array.from(this.mountedRouters.values());
	}
	/**
	* Retrieves a mounted router by package name.
	*/
	getRouter(name) {
		return this.mountedRouters.get(name);
	}
	/**
	* Dispatches an incoming HTTP request across mounted package routers.
	*/
	async dispatchHttpRequest(req) {
		for (const router of this.mountedRouters.values()) {
			const normalizedBase = router.basePath.startsWith("/") ? router.basePath : `/${router.basePath}`;
			if (req.path.startsWith(normalizedBase)) {
				const subPath = req.path.slice(normalizedBase.length) || "/";
				const routedReq = {
					...req,
					subPath: subPath.startsWith("/") ? subPath : `/${subPath}`
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
	createMiddleware() {
		return async (req, res, next) => {
			const url = new URL(req.url || "/", `http://${req.headers?.host || "localhost"}`);
			const query = {};
			url.searchParams.forEach((v, k) => {
				query[k] = v;
			});
			const bridgeReq = {
				method: req.method?.toUpperCase() || "GET",
				url: req.url || "/",
				path: url.pathname,
				subPath: url.pathname,
				params: req.params || {},
				query,
				headers: req.headers || {},
				body: req.body
			};
			const match = await this.dispatchHttpRequest(bridgeReq);
			if (match) {
				res.writeHead(match.status, {
					"Content-Type": match.contentType || "application/json",
					...match.headers || {}
				});
				if (match.isBuffer && Buffer.isBuffer(match.body)) res.end(match.body);
				else if (typeof match.body === "string") res.end(match.body);
				else res.end(JSON.stringify(match.body));
				return;
			}
			if (typeof next === "function") next();
		};
	}
	/**
	* Registers a new active session into the bridge.
	*/
	async registerSession(session) {
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
			timestamp: Date.now()
		});
		return session;
	}
	/**
	* Updates state for an active session and broadcasts synchronization to listeners.
	*/
	async updateSessionState(sessionId, newState, sourcePlatform = "internal") {
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
			timestamp: Date.now()
		});
		return true;
	}
	/**
	* Retrieves an active session by its ID.
	*/
	getSession(sessionId) {
		return this.activeSessions.get(sessionId);
	}
	/**
	* Ends an active session, marking it completed and notifying listeners.
	*/
	async endSession(sessionId, details = {}) {
		const session = this.activeSessions.get(sessionId);
		if (!session) return false;
		session.isEnded = true;
		session.lastUpdated = Date.now();
		if (details.winnerId) session.winnerId = details.winnerId;
		if (details.metadata) session.metadata = {
			...session.metadata,
			...details.metadata
		};
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
	async unregisterSession(sessionId) {
		const deleted = this.activeSessions.delete(sessionId);
		await this.storage.removeSession(sessionId);
		return deleted;
	}
	/**
	* Returns all active, ongoing sessions.
	*/
	getActiveSessions() {
		return Array.from(this.activeSessions.values()).filter((s) => !s.isEnded);
	}
	/**
	* Returns all registered sessions.
	*/
	getAllSessions() {
		return Array.from(this.activeSessions.values());
	}
	/**
	* Returns sessions associated with a specific module (e.g. "games" or "economy").
	*/
	getSessionsByModule(module) {
		return Array.from(this.activeSessions.values()).filter((s) => s.module === module);
	}
	/**
	* Returns sessions where a specific user is a participant.
	*/
	getSessionsForPlayer(playerId) {
		return Array.from(this.activeSessions.values()).filter((s) => s.players.some((p) => p.id === playerId));
	}
	/**
	* Dispatches an action to an active session from any platform (Dashboard, Discord, API).
	*/
	async dispatchAction(action) {
		const session = action.sessionId ? this.activeSessions.get(action.sessionId) : void 0;
		if (action.sessionId && !session) return {
			success: false,
			error: `Session "${action.sessionId}" not found`
		};
		if (session && session.isEnded) return {
			success: false,
			error: `Session "${action.sessionId}" has already ended`
		};
		action.timestamp = action.timestamp || Date.now();
		this.stats.totalActionsDispatched++;
		this.emit("action", action);
		let result;
		if (session && typeof session.onAction === "function") result = await session.onAction(action);
		else if (this.moduleHandlers.has(action.module)) result = await this.moduleHandlers.get(action.module)(action, session);
		else if (session && this.moduleHandlers.has(session.module)) result = await this.moduleHandlers.get(session.module)(action, session);
		else if (this.mountedRouters.has(action.module) && typeof this.mountedRouters.get(action.module).handleAction === "function") result = await this.mountedRouters.get(action.module).handleAction(action);
		else result = { success: true };
		if (result.success && session) {
			if (result.state !== void 0) session.state = result.state;
			if (result.nextTurnId !== void 0) session.currentTurnId = result.nextTurnId;
			if (result.isEnded) {
				session.isEnded = true;
				session.winnerId = result.winnerId;
			}
			session.lastUpdated = Date.now();
			await this.storage.saveSession(session);
			if (result.soundKey && result.soundUrl) {
				const targetUserIds = session.players.map((p) => p.id);
				this.dispatchAudioCue({
					module: session.module,
					sessionId: session.id,
					soundKey: result.soundKey,
					soundUrl: result.soundUrl,
					userId: action.playerId,
					targetUserIds,
					timestamp: Date.now()
				});
			}
			this.emit("sync", {
				sessionId: session.id,
				module: session.module,
				state: session.state,
				source: action.sourcePlatform,
				timestamp: Date.now()
			});
		}
		this.emit("actionResult", result, action);
		return result;
	}
	/**
	* Registers a client as actively connected/online on the dashboard or application.
	*/
	setClientOnline(presence) {
		presence.connectedAt = presence.connectedAt || Date.now();
		presence.lastSeen = Date.now();
		this.onlinePresences.set(presence.userId, presence);
		this.emit("presenceChange", presence, true);
	}
	/**
	* Marks a client as offline upon disconnect.
	*/
	setClientOffline(userId) {
		const existing = this.onlinePresences.get(userId);
		if (existing) {
			this.onlinePresences.delete(userId);
			this.emit("presenceChange", existing, false);
		}
	}
	/**
	* Convenience helper to mark a user as online on the dashboard.
	*/
	setUserOnline(userId, platform = "dashboard", metadata) {
		this.setClientOnline({
			userId,
			platform,
			connectedAt: Date.now(),
			lastSeen: Date.now(),
			metadata
		});
	}
	/**
	* Convenience helper to mark a user as offline.
	*/
	setUserOffline(userId) {
		this.setClientOffline(userId);
	}
	/**
	* Checks whether a specific user is currently active/online.
	*/
	isUserOnline(userId) {
		return this.onlinePresences.has(userId);
	}
	/**
	* Returns all active user IDs currently connected.
	*/
	getActiveUsers() {
		return Array.from(this.onlinePresences.keys());
	}
	/**
	* Returns presence details for a connected user.
	*/
	getPresence(userId) {
		return this.onlinePresences.get(userId);
	}
	/**
	* Dispatches a scoped audio cue to web dashboards.
	*/
	dispatchAudioCue(audio) {
		audio.soundKey = audio.soundKey || audio.sound || "default";
		audio.soundUrl = audio.soundUrl || "";
		if (this.options.requireOnlinePresenceForAudio) {
			const targets = audio.targetUserIds || (audio.userId ? [audio.userId] : []);
			if (targets.length > 0) {
				if (!targets.some((id) => this.isUserOnline(id))) return false;
			} else if (this.onlinePresences.size === 0) return false;
		}
		audio.timestamp = audio.timestamp || Date.now();
		this.stats.totalAudioCuesDispatched++;
		this.emit("audioCue", audio);
		return true;
	}
	/**
	* Dispatches a live notification / toast to connected dashboards.
	*/
	dispatchNotification(notification) {
		const payload = {
			id: notification.id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
			module: notification.module,
			sessionId: notification.sessionId,
			title: notification.title,
			message: notification.message,
			type: notification.type || "info",
			userId: notification.userId,
			targetUserIds: notification.targetUserIds,
			timestamp: Date.now(),
			data: notification.data
		};
		this.stats.totalNotificationsDispatched++;
		this.emit("notification", payload);
		return payload;
	}
	/**
	* Generates a high-level real-time overview for web dashboard home screens.
	*/
	async getDashboardOverview() {
		const activeSessions = this.getActiveSessions();
		const onlineList = Array.from(this.onlinePresences.values()).map((p) => ({
			userId: p.userId,
			username: p.username,
			platform: p.platform
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
				players: s.players.map((p) => ({
					id: p.id,
					username: p.username,
					platform: p.platform
				})),
				currentTurnId: s.currentTurnId,
				lastUpdated: s.lastUpdated,
				isEnded: s.isEnded
			})),
			uptime: Date.now() - this.startTime,
			stats: {
				...this.stats,
				totalActiveSessions: this.activeSessions.size
			}
		};
	}
	async exportAllState() {
		return {
			sessions: Array.from(this.activeSessions.values()).map((s) => ({
				...s,
				onAction: void 0,
				renderSnapshot: void 0
			})),
			presences: Array.from(this.onlinePresences.values()),
			stats: { ...this.stats }
		};
	}
	async importAllState(data) {
		if (data.sessions) for (const s of data.sessions) {
			this.activeSessions.set(s.id, s);
			await this.storage.saveSession(s);
		}
		if (data.stats) this.stats = {
			...this.stats,
			...data.stats
		};
	}
};
// src/server/BridgeServer.ts
/**
* @m3rcena/bridge
* Real-Time WebSocket and HTTP Gateway Server.
* Enables live bi-directional synchronization between web dashboards and Discord bots.
*
* @copyright 2026 M3rcena Development. All rights reserved.
* @license Apache-2.0
*/
var BridgeServer = class {
	bridge;
	options;
	wss = null;
	httpServer = null;
	clients = /* @__PURE__ */ new Set();
	heartbeatTimer = null;
	constructor(bridge, options = {}) {
		this.bridge = bridge;
		this.options = {
			port: options.port ?? 4e3,
			path: options.path ?? "/bridge",
			heartbeatInterval: options.heartbeatInterval ?? 3e4,
			...options
		};
		this.bindBridgeEvents();
	}
	/**
	* Starts the Bridge Server.
	*/
	async start() {
		if (this.options.server) {
			this.httpServer = this.options.server;
			this.wss = new WebSocketServer({
				server: this.httpServer,
				path: this.options.path
			});
		} else {
			this.httpServer = http.createServer((req, res) => this.handleHttpRequest(req, res));
			this.wss = new WebSocketServer({
				server: this.httpServer,
				path: this.options.path
			});
			await new Promise((resolve) => {
				this.httpServer.listen(this.options.port, () => {
					resolve();
				});
			});
		}
		this.setupWebSocketServer();
		this.startHeartbeat();
	}
	/**
	* Stops the Bridge Server and closes all connections.
	*/
	async stop() {
		if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer);
			this.heartbeatTimer = null;
		}
		for (const client of this.clients) try {
			client.ws.close();
		} catch {}
		this.clients.clear();
		if (this.wss) {
			await new Promise((resolve) => this.wss.close(() => resolve()));
			this.wss = null;
		}
		if (this.httpServer && !this.options.server) {
			await new Promise((resolve) => this.httpServer.close(() => resolve()));
			this.httpServer = null;
		}
	}
	setupWebSocketServer() {
		if (!this.wss) return;
		this.wss.on("connection", (ws, req) => {
			if (this.options.secretToken) {
				if ((new URL(req.url || "", `http://${req.headers.host || "localhost"}`).searchParams.get("token") || req.headers["authorization"]?.replace("Bearer ", "")) !== this.options.secretToken) {
					ws.close(4001, "Unauthorized: Invalid or missing secretToken");
					return;
				}
			}
			const client = {
				ws,
				isAlive: true,
				subscribedSessions: /* @__PURE__ */ new Set(),
				subscribedModules: /* @__PURE__ */ new Set()
			};
			this.clients.add(client);
			ws.on("pong", () => {
				client.isAlive = true;
			});
			ws.on("message", async (data) => {
				try {
					const message = JSON.parse(data.toString());
					await this.handleClientMessage(client, message);
				} catch (err) {
					this.sendToSocket(client.ws, {
						type: "error",
						error: `Invalid message format: ${err?.message || err}`
					});
				}
			});
			ws.on("close", () => {
				if (client.userId) this.bridge.setClientOffline(client.userId);
				this.clients.delete(client);
			});
			this.sendToSocket(ws, {
				type: "welcome",
				modules: this.bridge.getRegisteredModules(),
				timestamp: Date.now()
			});
		});
	}
	async handleClientMessage(client, msg) {
		switch (msg.type) {
			case "authenticate":
			case "presence":
				if (msg.userId) {
					client.userId = msg.userId;
					this.bridge.setClientOnline({
						userId: msg.userId,
						username: msg.username,
						platform: msg.platform || "dashboard",
						connectedAt: Date.now(),
						lastSeen: Date.now(),
						metadata: msg.metadata
					});
					this.sendToSocket(client.ws, {
						type: "presence_ack",
						userId: msg.userId
					});
				}
				break;
			case "subscribe_session":
				if (msg.sessionId) {
					client.subscribedSessions.add(msg.sessionId);
					const current = this.bridge.getSession(msg.sessionId);
					this.sendToSocket(client.ws, {
						type: "session_state",
						sessionId: msg.sessionId,
						session: current
					});
				}
				break;
			case "unsubscribe_session":
				if (msg.sessionId) client.subscribedSessions.delete(msg.sessionId);
				break;
			case "subscribe_module":
				if (msg.module) client.subscribedModules.add(msg.module);
				break;
			case "dispatch_action": {
				const action = {
					module: msg.module,
					sessionId: msg.sessionId,
					playerId: msg.playerId || client.userId || "anonymous",
					action: msg.action,
					payload: msg.payload,
					sourcePlatform: msg.sourcePlatform || "dashboard"
				};
				const result = await this.bridge.dispatchAction(action);
				this.sendToSocket(client.ws, {
					type: "action_result",
					correlationId: msg.correlationId,
					result
				});
				break;
			}
			case "get_overview": {
				const overview = await this.bridge.getDashboardOverview();
				this.sendToSocket(client.ws, {
					type: "overview",
					correlationId: msg.correlationId,
					data: overview
				});
				break;
			}
			case "ping":
				this.sendToSocket(client.ws, {
					type: "pong",
					timestamp: Date.now()
				});
				break;
			default: this.sendToSocket(client.ws, {
				type: "unknown_type",
				received: msg.type
			});
		}
	}
	bindBridgeEvents() {
		this.bridge.on("sync", (event) => {
			this.broadcastToSession(event.sessionId, {
				type: "sync",
				...event
			});
		});
		this.bridge.on("audioCue", (cue) => {
			const targets = cue.targetUserIds || (cue.userId ? [cue.userId] : []);
			if (targets.length > 0) this.sendToUsers(targets, {
				type: "audio_cue",
				...cue
			});
			else this.broadcastAll({
				type: "audio_cue",
				...cue
			});
		});
		this.bridge.on("notification", (notif) => {
			const targets = notif.targetUserIds || (notif.userId ? [notif.userId] : []);
			if (targets.length > 0) this.sendToUsers(targets, {
				type: "notification",
				...notif
			});
			else this.broadcastAll({
				type: "notification",
				...notif
			});
		});
		this.bridge.on("sessionStart", (session) => {
			this.broadcastToModule(session.module, {
				type: "session_start",
				session
			});
		});
		this.bridge.on("sessionEnd", (session) => {
			this.broadcastToSession(session.id, {
				type: "session_end",
				session
			});
			this.broadcastToModule(session.module, {
				type: "session_end",
				session
			});
		});
	}
	broadcastAll(data) {
		const payload = JSON.stringify(data);
		for (const client of this.clients) if (client.ws.readyState === WebSocket.OPEN) client.ws.send(payload);
	}
	broadcastToSession(sessionId, data) {
		const payload = JSON.stringify(data);
		for (const client of this.clients) if (client.subscribedSessions.has(sessionId) && client.ws.readyState === WebSocket.OPEN) client.ws.send(payload);
	}
	broadcastToModule(module, data) {
		const payload = JSON.stringify(data);
		for (const client of this.clients) if (client.subscribedModules.has(module) && client.ws.readyState === WebSocket.OPEN) client.ws.send(payload);
	}
	sendToUsers(userIds, data) {
		const targetSet = new Set(userIds);
		const payload = JSON.stringify(data);
		for (const client of this.clients) if (client.userId && targetSet.has(client.userId) && client.ws.readyState === WebSocket.OPEN) client.ws.send(payload);
	}
	sendToSocket(ws, data) {
		if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
	}
	startHeartbeat() {
		this.heartbeatTimer = setInterval(() => {
			for (const client of this.clients) {
				if (!client.isAlive) {
					client.ws.terminate();
					this.clients.delete(client);
					continue;
				}
				client.isAlive = false;
				client.ws.ping();
			}
		}, this.options.heartbeatInterval);
	}
	async handleHttpRequest(req, res) {
		res.setHeader("Access-Control-Allow-Origin", "*");
		res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
		res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
		if (req.method === "OPTIONS") {
			res.writeHead(204);
			res.end();
			return;
		}
		const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
		const query = {};
		url.searchParams.forEach((val, key) => {
			query[key] = val;
		});
		let bodyData = void 0;
		if ([
			"POST",
			"PUT",
			"PATCH"
		].includes(req.method?.toUpperCase() || "")) try {
			const rawBody = await new Promise((resolve) => {
				let b = "";
				req.on("data", (chunk) => b += chunk);
				req.on("end", () => resolve(b));
			});
			if (rawBody.trim()) try {
				bodyData = JSON.parse(rawBody);
			} catch {
				bodyData = rawBody;
			}
		} catch {}
		const bridgeReq = {
			method: req.method?.toUpperCase() || "GET",
			url: req.url || "/",
			path: url.pathname,
			subPath: url.pathname,
			params: {},
			query,
			headers: req.headers,
			body: bodyData
		};
		const packageResponse = await this.bridge.dispatchHttpRequest(bridgeReq);
		if (packageResponse) {
			res.writeHead(packageResponse.status, {
				"Content-Type": packageResponse.contentType || (packageResponse.isBuffer ? "image/png" : "application/json"),
				...packageResponse.headers || {}
			});
			if (packageResponse.isBuffer && Buffer.isBuffer(packageResponse.body)) res.end(packageResponse.body);
			else if (typeof packageResponse.body === "string") res.end(packageResponse.body);
			else res.end(JSON.stringify(packageResponse.body));
			return;
		}
		if (url.pathname === "/health") {
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({
				status: "ok",
				timestamp: Date.now()
			}));
			return;
		}
		if (url.pathname === "/overview" && req.method === "GET") {
			const overview = await this.bridge.getDashboardOverview();
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify(overview));
			return;
		}
		if (url.pathname === "/sessions" && req.method === "GET") {
			const sessions = this.bridge.getActiveSessions();
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify(sessions));
			return;
		}
		if (url.pathname === "/action" && req.method === "POST") {
			let body = "";
			req.on("data", (chunk) => body += chunk);
			req.on("end", async () => {
				try {
					const action = JSON.parse(body);
					const result = await this.bridge.dispatchAction(action);
					res.writeHead(result.success ? 200 : 400, { "Content-Type": "application/json" });
					res.end(JSON.stringify(result));
				} catch (err) {
					res.writeHead(400, { "Content-Type": "application/json" });
					res.end(JSON.stringify({
						success: false,
						error: err?.message || "Invalid JSON"
					}));
				}
			});
			return;
		}
		res.writeHead(404, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ error: "Route not found" }));
	}
};
// src/host.ts
/**
* @m3rcena/bridge - Standalone Local Submodule Host Service
*
* Runs the Bridge WebSocket & REST API gateway locally when cloned via Git submodules.
* Automatically discovers sibling @m3rcena/weky and @m3rcena/eco submodules and mounts them.
*
* @copyright 2026 M3rcena Development. All rights reserved.
* @license Apache-2.0
*/
async function hostBridge(options = {}) {
	const port = options.port ?? parseInt(process.env.PORT || process.env.BRIDGE_PORT || "4000", 10);
	const secretToken = options.secretToken ?? (process.env.BRIDGE_SECRET || "m3rcena-local-token");
	printResolutionSummary();
	const bridge = new M3rcenaBridge({ notifyUpdates: true });
	if (options.autoMountSubmodules !== false) {
		const resolutions = getAllPackageResolutions();
		if (resolutions["@m3rcena/eco"].status === "submodule") try {
			const ecoModule = await import(resolutions["@m3rcena/eco"].path);
			if (ecoModule.EcoManager && ecoModule.EcoBridgeRouter) {
				const eco = new ecoModule.EcoManager();
				bridge.mountPackage(new ecoModule.EcoBridgeRouter(eco));
				console.log(`[m3rcena-bridge] 💰 Auto-mounted local submodule: @m3rcena/eco`);
			}
		} catch (err) {
			console.warn(`[m3rcena-bridge] Could not auto-mount @m3rcena/eco:`, err.message);
		}
		if (resolutions["@m3rcena/weky"].status === "submodule") try {
			const wekyModule = await import(resolutions["@m3rcena/weky"].path);
			if (wekyModule.WekyBridge) {
				const wb = new wekyModule.WekyBridge();
				bridge.mountPackage(wb.router);
				console.log(`[m3rcena-bridge] 🕹️ Auto-mounted local submodule: @m3rcena/weky`);
			}
		} catch (err) {
			console.warn(`[m3rcena-bridge] Could not auto-mount @m3rcena/weky:`, err.message);
		}
	}
	const server = new BridgeServer(bridge, {
		port,
		secretToken
	});
	await server.start();
	console.log(`
┌────────────────────────────────────────────────────────────────────────┐
│  🌉 M3RCENA BRIDGE LOCAL HOST SERVICE                                  │
│  WebSocket & REST Gateway running on http://localhost:${port.toString().padEnd(16)}│
│  Secret Token: ${secretToken.padEnd(55)}│
│  Ready to accept Dashboard and Bot connections via Submodules!         │
└────────────────────────────────────────────────────────────────────────┘
`);
	return {
		bridge,
		server,
		port
	};
}
if (process.argv[1]?.endsWith("host.ts") || process.argv[1]?.endsWith("host.js")) hostBridge().catch((err) => {
	console.error("[m3rcena-bridge host] Fatal error:", err);
	process.exit(1);
});
export { MemoryStorageAdapter as _, boxConsole as a, fetchLatestVersion as c, resolveBridgeStorage as d, PRISMA_BRIDGE_MODEL as f, JsonFileStorageAdapter as g, SqliteBridgeStorage as h, BRIDGE_VERSION as i, stripAnsi as l, applyPrismaBridgeModel as m, BridgeServer as n, checkPackageUpdates as o, PrismaBridgeStorage as p, M3rcenaBridge as r, compareSemver as s, hostBridge as t, BridgeDatabaseHandler as u };

//# sourceMappingURL=host-CL18i1Ep.mjs.map