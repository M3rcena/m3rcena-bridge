# 📖 @m3rcena/bridge Comprehensive API Documentation

> 📚 **Official GitHub Wiki**: The full, categorized documentation, tutorials, and deep-dive guides are organized in the **[M3rcena Bridge Official Wiki](https://github.com/M3rcena/m3rcena-bridge/wiki)**:
> - **[Architecture & Storage](https://github.com/M3rcena/m3rcena-bridge/wiki/Architecture)**
> - **[Client SDK (React / Next.js / Vue)](https://github.com/M3rcena/m3rcena-bridge/wiki/Client-SDK)**
> - **[Connecting Packages & Handshake Standard](https://github.com/M3rcena/m3rcena-bridge/wiki/Connecting-Packages)**
> - **[REST & WebSocket Protocol Specification](https://github.com/M3rcena/m3rcena-bridge/wiki/REST-and-WebSocket-API)**

Welcome to the definitive documentation for **`@m3rcena/bridge`** (v14.28.1) — the universal real-time state synchronization gateway and communications standard connecting Discord bot packages (`@m3rcena/weky`, `@m3rcena/eco`) with web dashboards, REST APIs, and WebSockets.

---

## 📑 Table of Contents

1. [Architecture & Design Principles](#1-architecture--design-principles)
2. [Installation & Requirements](#2-installation--requirements)
3. [Quickstart Setup](#3-quickstart-setup)
4. [The Core Gateway: `M3rcenaBridge`](#4-the-core-gateway-m3rcenabridge)
5. [Database Handlers & Persistence Layer](#5-database-handlers--persistence-layer)
   - [5.1. Zero-Config Local SQLite (`node:sqlite`)](#51-zero-config-local-sqlite-nodesqlite)
   - [5.2. Enterprise Prisma ORM Integration](#52-enterprise-prisma-orm-integration)
   - [5.3. Manual Prisma Migration Tables (PostgreSQL, MySQL, SQLite)](#53-manual-prisma-migration-tables)
   - [5.4. JSON File Storage (`JsonFileStorageAdapter`)](#54-json-file-storage-jsonfilestorageadapter)
   - [5.5. In-Memory Ephemeral Storage (`MemoryStorageAdapter`)](#55-in-memory-ephemeral-storage-memorystorageadapter)
   - [5.6. Custom Storage Adapters (`BridgeStorageAdapter`)](#56-custom-storage-adapters-bridgestorageadapter)
6. [Server Gateway: `BridgeServer`](#6-server-gateway-bridgeserver)
   - [6.1. Standalone HTTP & WebSocket Server](#61-standalone-http--websocket-server)
   - [6.2. Attaching to Existing Express / Fastify / Next.js Servers](#62-attaching-to-existing-express--fastify--nextjs-servers)
7. [Client SDK: `BridgeClient`](#7-client-sdk-bridgeclient)
   - [7.1. Dashboard React / Vue / Browser Usage](#71-dashboard-react--vue--browser-usage)
   - [7.2. Listening to Audio Cues, Notifications, and Moves](#72-listening-to-audio-cues-notifications-and-moves)
   - [7.3. Dispatching Inbound Dashboard Actions](#73-dispatching-inbound-dashboard-actions)
8. [Universal Package Mounting Standard (`bridge.use`)](#8-universal-package-mounting-standard-bridgeuse)
9. [Complete REST API Route Reference](#9-complete-rest-api-route-reference)
10. [Real-Time WebSocket Protocol Specification](#10-real-time-websocket-protocol-specification)
11. [Complete TypeScript Types Reference](#11-complete-typescript-types-reference)

---

## 1. Architecture & Design Principles

`@m3rcena/bridge` provides a unified protocol layer enabling seamless, real-time interoperability between Discord bot processes and web dashboards.

```
┌─────────────────────────────────┐                 ┌─────────────────────────────────┐
│        Discord Bot Process      │                 │     Web Dashboard (Browser)     │
│  @m3rcena/weky  @m3rcena/eco    │                 │   React / Next.js / Vue / Svelte│
└───────────────┬─────────────────┘                 └────────────────┬────────────────┘
                │                                                    │
                │ bridge.use(pkg)                                    │ BridgeClient
                ▼                                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    M3rcenaBridge                                    │
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌─────────────────────────┐  │
│  │ Module Registry       │  │ Session Lifecycle     │  │ Presence & Audio Scope  │  │
│  └───────────────────────┘  └───────────────────────┘  └─────────────────────────┘  │
│                                                                                     │
│  ┌───────────────────────────────────────────────────────────────────────────────┐  │
│  │                 BridgeServer (HTTP Dispatcher + WebSocket Gateway)            │  │
│  └───────────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────┬──────────────────────────────────────────┘
                                           ▼
                            ┌─────────────────────────────┐
                            │    BridgeStorageAdapter     │
                            │  (SQLite / Prisma / Memory) │
                            └─────────────────────────────┘
```

- **Universal Package Mounting**: Connect any package with `bridge.use(pkg)` or `new WekyManager(client, { bridge })`.
- **Bidirectional State Sync**: Actions made on Discord reflect in real time on the web dashboard via WebSockets, and vice versa.
- **Scoped Audio Delivery**: Dispatches sounds (`hit`, `coin_drop`, `game_over`) strictly to players currently online on the dashboard.
- **Zero-Dependency Native SQLite**: Native `node:sqlite` storage for session and metadata persistence.
- **Enterprise Prisma ORM**: Auto-migrating Prisma storage with raw SQL fallbacks.

---

## 2. Installation & Requirements

```bash
npm install @m3rcena/bridge ws
```

### System Requirements
- **Node.js**: `>= 22.0.0` (Node 22, 24, or 26 recommended; supports native `node:sqlite`).
- **WebSockets**: `ws ^8.0.0` (bundled automatically).

---

## 3. Quickstart Setup

### Discord Bot Server
```typescript
import { M3rcenaBridge, BridgeServer } from "@m3rcena/bridge";
import { WekyManager } from "@m3rcena/weky";
import { EcoManager } from "@m3rcena/eco";

// 1. Initialize Shared Bridge
export const bridge = new M3rcenaBridge({
  database: "sqlite", // Zero configuration! Auto-creates ./bridge.sqlite
});

// 2. Connect Ecosystem Packages via fluent mounting
export const weky = new WekyManager(client, { bridge });
export const eco = new EcoManager({ bridge });
bridge.use(weky).use(eco);

// 3. Start WebSocket & REST HTTP Server Gateway
export const bridgeServer = new BridgeServer(bridge, {
  port: 3001,
  secret: "super-secret-dashboard-token",
});
await bridgeServer.start();
console.log("🌐 Bridge Gateway running at http://localhost:3001");
```

---

## 4. The Core Gateway: `M3rcenaBridge`

`M3rcenaBridge` manages the active session lifecycle, action dispatching, user presence tracking, and sound cue filtering.

### Constructor Options (`BridgeOptions`)

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `database` | `BridgeDatabaseConfig` | `"memory"` | Database storage configuration (`"sqlite"`, `"prisma"`, `"json"`, or object). |
| `storage` | `BridgeStorageAdapter` | `MemoryStorageAdapter` | Custom storage adapter instance. |
| `autoCleanEndedSessions` | `boolean` | `false` | Automatically purge sessions from memory when `isEnded: true`. |
| `sessionTimeoutMs` | `number` | `1800000` (30m) | Milliseconds of inactivity before a session is purged. |
| `requireOnlinePresenceForAudio` | `boolean` | `false` | Only dispatch audio cues if the target user has an active dashboard presence. |
| `notifyUpdates` | `boolean` | `true` | Log styled terminal update notification box when a newer version is on npm. |

### Core Methods

#### `bridge.use(pkg: BridgeCompatiblePackage): this`
Fluent mounting method that mounts the package's router and executes the bidirectional handshake.

#### `bridge.registerSession(session: BridgeSession): Promise<BridgeSession>`
Registers an active game or economy session in the bridge. Automatically notifies all dashboard clients via WebSocket.

#### `bridge.getSession(id: string): Promise<BridgeSession | null>`
Retrieves an active or historical session.

#### `bridge.updateSessionState(id: string, newState: any): Promise<BridgeSession | null>`
Updates session state and broadcasts a `sync` event across the WebSocket gateway.

#### `bridge.endSession(id: string, winnerId?: string): Promise<BridgeSession | null>`
Concludes a session, marks `isEnded: true`, and broadcasts session conclusion to dashboards.

#### `bridge.dispatchAction(action: BridgeAction): Promise<BridgeActionResult>`
Processes an inbound move from Discord, Web Dashboard, or REST API. Invokes the module's registered action handler.

#### `bridge.dispatchAudioCue(cue: BridgeAudioCue): void`
Emits an audio cue (sound effect). If `requireOnlinePresenceForAudio` is enabled, only emits if the target user is online.

#### `bridge.dispatchNotification(notification: BridgeNotification): void`
Broadcasts a toast notification to connected dashboard clients.

#### `bridge.setUserPresence(userId: string, isOnline: boolean, platform: BridgePlatform): void`
Updates user online presence.

#### `bridge.getDashboardOverview(): DashboardOverview`
Returns a system-wide status snapshot: active sessions count, registered modules, online users count, and telemetry.

---

## 5. Database Handlers & Persistence Layer

`@m3rcena/bridge` supports zero-config SQLite, Prisma ORM, JSON files, or memory storage via the `database` configuration.

```typescript
export type BridgeDatabaseConfig =
  | "sqlite"
  | "memory"
  | "json"
  | { type: "sqlite"; path?: string }
  | { type: "prisma"; client: any; model?: string; autoMigrate?: boolean }
  | { type: "json"; path?: string }
  | { type: "memory" };
```

---

### 5.1. Zero-Config Local SQLite (`node:sqlite`)

Uses Node.js `>= 22.0.0` built-in `node:sqlite` (`DatabaseSync`). Zero npm compilation, zero C++ build tools, instant startup, WAL mode enabled by default, and indexed queries.

```typescript
import { M3rcenaBridge } from "@m3rcena/bridge";

const bridge = new M3rcenaBridge({
  // Auto-creates ./bridge.sqlite with sessions & kv tables
  database: "sqlite",

  // Or with custom directory:
  database: {
    type: "sqlite",
    path: "./data/bridge.sqlite",
  },
});
```

---

### 5.2. Enterprise Prisma ORM Integration

Pass an existing `PrismaClient` instance. If your database hasn't compiled the `BridgeSession` or `BridgeKeyValue` delegates, `@m3rcena/bridge` automatically runs DDL creation and executes queries via raw SQL:

```typescript
import { PrismaClient } from "@prisma/client";
import { M3rcenaBridge, applyPrismaBridgeModel } from "@m3rcena/bridge";

const prisma = new PrismaClient();

// Optional: Automatically appends models to schema.prisma if missing:
applyPrismaBridgeModel();

const bridge = new M3rcenaBridge({
  database: {
    type: "prisma",
    client: prisma,
    autoMigrate: true, // Auto-creates tables if missing
  },
});
```

---

### 5.3. Manual Prisma Migration Tables

If you prefer to manage database schemas manually or with `npx prisma migrate dev`, use the schema snippet below:

#### Prisma Schema Snippet (`schema.prisma`):
```prisma
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
```

#### PostgreSQL Manual Migration SQL:
```sql
CREATE TABLE IF NOT EXISTS "BridgeSession" (
  "id" VARCHAR(191) PRIMARY KEY,
  "module" VARCHAR(191),
  "state" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "BridgeKeyValue" (
  "key" VARCHAR(191) PRIMARY KEY,
  "value" TEXT NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bridge_sessions_module ON "BridgeSession" ("module");
```

#### MySQL Manual Migration SQL:
```sql
CREATE TABLE IF NOT EXISTS `BridgeSession` (
  `id` VARCHAR(191) PRIMARY KEY,
  `module` VARCHAR(191),
  `state` LONGTEXT NOT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_bridge_sessions_module (`module`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `BridgeKeyValue` (
  `key` VARCHAR(191) PRIMARY KEY,
  `value` LONGTEXT NOT NULL,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

#### SQLite Manual Migration SQL:
```sql
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
```

---

### 5.4. JSON File Storage (`JsonFileStorageAdapter`)

```typescript
const bridge = new M3rcenaBridge({
  database: "json", // Defaults to ./bridge-data.json
  // Or:
  database: {
    type: "json",
    path: "./data/bridge.json",
  },
});
```

---

### 5.5. In-Memory Ephemeral Storage (`MemoryStorageAdapter`)

Sub-millisecond memory storage with zero disk I/O (default):

```typescript
const bridge = new M3rcenaBridge({
  database: "memory",
});
```

---

### 5.6. Custom Storage Adapters (`BridgeStorageAdapter`)

Implement `BridgeStorageAdapter` for Redis or MongoDB:

```typescript
import { BridgeStorageAdapter, BridgeSession } from "@m3rcena/bridge";

export class RedisBridgeStorage implements BridgeStorageAdapter {
  constructor(private redis: any) {}

  async getSession(id: string): Promise<BridgeSession | null> {
    const raw = await this.redis.get(`bridge:session:${id}`);
    return raw ? JSON.parse(raw) : null;
  }
  async saveSession(session: BridgeSession): Promise<void> {
    await this.redis.set(`bridge:session:${session.id}`, JSON.stringify(session), "EX", 3600);
  }
  async removeSession(id: string): Promise<void> {
    await this.redis.del(`bridge:session:${id}`);
  }
  async getAllSessions(): Promise<BridgeSession[]> {
    return [];
  }
  async saveData(key: string, value: any): Promise<void> {
    await this.redis.set(`bridge:kv:${key}`, JSON.stringify(value));
  }
  async getData(key: string): Promise<any> {
    const raw = await this.redis.get(`bridge:kv:${key}`);
    return raw ? JSON.parse(raw) : null;
  }
}
```

---

## 6. Server Gateway: `BridgeServer`

The embedded HTTP and WebSocket server. Exposes the REST API and WebSocket connection endpoint.

### Options (`BridgeServerOptions`)

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `port` | `number` | `3001` | TCP port for standalone HTTP/WebSocket server. |
| `secret` | `string` | `undefined` | Shared authorization secret (Bearer token). |
| `enableCors` | `boolean` | `true` | Add permissive CORS headers (`Access-Control-Allow-Origin: *`). |
| `httpServer` | `http.Server` | `undefined` | Existing HTTP server instance to attach WebSockets to. |
| `path` | `string` | `"/bridge"` | WebSocket connection endpoint pathname. |

---

### 6.1. Standalone HTTP & WebSocket Server

```typescript
import { BridgeServer } from "@m3rcena/bridge";

const server = new BridgeServer(bridge, {
  port: 3001,
  secret: "m3rcena-super-token",
});

await server.start();
```

---

### 6.2. Attaching to Existing Express / Fastify / Next.js Servers

```typescript
import express from "express";
import http from "http";
import { BridgeServer } from "@m3rcena/bridge";

const app = express();
const server = http.createServer(app);

// Attach WebSocket gateway directly to existing HTTP server
const bridgeServer = new BridgeServer(bridge, {
  httpServer: server,
  path: "/api/bridge/ws",
});
await bridgeServer.start();

// Express routes delegate to bridge handler
app.all("/api/bridge/*", async (req, res) => {
  const result = await bridgeServer.handleHttpRequest(req, res);
  // Handled automatically
});

server.listen(3000);
```

---

## 7. Client SDK: `BridgeClient`

`@m3rcena/bridge/client` provides an ultra-lightweight client SDK for React, Next.js, Vue, and vanilla browser dashboards.

```typescript
import { createBridgeClient } from "@m3rcena/bridge/client";

export const client = createBridgeClient({
  url: "ws://localhost:3001/bridge",
  secret: "m3rcena-super-token",
  userId: "dashboard_admin",
  username: "M3rcenaAdmin",
  autoReconnect: true,
});
```

---

### 7.1. Dashboard React / Vue / Browser Usage

```typescript
import React, { useEffect, useState } from "react";
import { createBridgeClient } from "@m3rcena/bridge/client";

const client = createBridgeClient({
  url: "ws://localhost:3001/bridge",
  userId: "web_user_1",
});

export function LiveArcade() {
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    // 1. Listen for live state updates
    const unsub = client.onSync((syncEvent) => {
      console.log("State updated:", syncEvent.sessionId, syncEvent.state);
    });

    // 2. Listen for audio sound effects
    client.onAudioCue((cue) => {
      const audio = new Audio(cue.soundUrl);
      audio.play();
    });

    return () => unsub();
  }, []);

  const makeMove = async (sessionId, move) => {
    // 3. Send move to bridge
    await client.sendAction({
      module: "weky",
      sessionId,
      action: "move",
      payload: { index: move },
    });
  };

  return <div>Live Dashboard</div>;
}
```

---

### 7.2. Listening to Audio Cues, Notifications, and Moves

```typescript
// Listen for live toast notifications
client.onNotification((notif) => {
  toast[notif.type || "info"](notif.message);
});

// Listen for action dispatches
client.onAction((action) => {
  console.log(`Action: ${action.action} by ${action.playerId}`);
});
```

---

### 7.3. Dispatching Inbound Dashboard Actions

```typescript
const result = await client.sendAction({
  module: "weky",
  sessionId: "session_tictactoe_123",
  action: "move",
  payload: { cellIndex: 4 },
});

if (result.success) {
  console.log("New game board:", result.state);
}
```

---

## 8. Universal Package Mounting Standard (`bridge.use`)

Any package or custom bot module can integrate with `@m3rcena/bridge` by implementing the `BridgeCompatiblePackage` interface.

### The Standard Contract
```typescript
export interface BridgeCompatiblePackage {
  name: string;
  router?: BridgePackageRouter;
  toBridgeRouter?: () => BridgePackageRouter;
  connectBridge?: (bridge: any) => void;
  setBridge?: (bridge: any) => void;
}
```

### Example: Mounting Custom Bot Modules
```typescript
import { M3rcenaBridge, BridgePackageRouter } from "@m3rcena/bridge";

export class ModerationRouter implements BridgePackageRouter {
  public name = "moderation";
  public basePath = "/api/moderation";

  async handleRequest(req) {
    if (req.subPath === "/warnings") {
      return { status: 200, body: [{ userId: "123", reason: "Spam" }] };
    }
    return { status: 404, body: { error: "Not found" } };
  }
}

const bridge = new M3rcenaBridge();
bridge.mountPackage(new ModerationRouter());
```

---

## 9. Complete REST API Route Reference

All HTTP requests can be authenticated by passing `Authorization: Bearer <secret>`.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Server health check (`{ status: "ok", uptime: 12450 }`). |
| `GET` | `/api/overview` | Returns system overview, active session counts, and online users count. |
| `GET` | `/api/sessions` | List all active sessions (supports `?module=weky` and `?isEnded=false`). |
| `GET` | `/api/sessions/:id` | Get full state snapshot for a specific session. |
| `POST` | `/api/action` | Execute an action (body: `BridgeAction`). |
| `POST` | `/api/presence` | Update user presence (body: `{ userId, isOnline, platform }`). |
| `ALL` | `/api/weky/*` | Delegated to mounted `@m3rcena/weky` router (Games, Hub, Canvas Cards). |
| `ALL` | `/api/eco/*` | Delegated to mounted `@m3rcena/eco` router (Accounts, Cards, Markets, Loans). |

---

## 10. Real-Time WebSocket Protocol Specification

WebSocket connections are initiated at `ws://<host>:<port>/bridge`.

### Inbound Frame Format
```typescript
{
  "type": "auth" | "action" | "presence" | "heartbeat",
  "payload": any,
  "requestId"?: string
}
```

### Outbound Broadcast Frame Format
```typescript
{
  "type": "sync" | "action" | "audioCue" | "notification" | "presence" | "overview",
  "payload": any,
  "timestamp": number
}
```

---

## 11. Complete TypeScript Types Reference

All types, adapters, and factories are exported from `@m3rcena/bridge`:

```typescript
export {
  M3rcenaBridge,
  BridgeServer,
  BridgeClient,
  createBridgeClient,
  // Database Handlers
  SqliteBridgeStorage,
  PrismaBridgeStorage,
  BridgeDatabaseHandler,
  resolveBridgeStorage,
  applyPrismaBridgeModel,
  PRISMA_BRIDGE_MODEL,
  // Storage Adapters
  MemoryStorageAdapter,
  JsonFileStorageAdapter,
  // Types
  type BridgeOptions,
  type BridgeDatabaseConfig,
  type BridgeStorageAdapter,
  type BridgeServerOptions,
  type BridgeClientOptions,
  type BridgeAction,
  type BridgeActionResult,
  type BridgeSession,
  type BridgePlayer,
  type BridgePlatform,
  type BridgeAudioCue,
  type BridgeNotification,
  type DashboardOverview,
  type BridgeCompatiblePackage,
  type BridgePackageRouter,
};
```
