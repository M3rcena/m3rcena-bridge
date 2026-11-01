# 📖 @m3rcena/bridge Comprehensive API Documentation

Welcome to the definitive API documentation for **`@m3rcena/bridge`**.

`@m3rcena/bridge` is the unified cross-platform state synchronization and communication protocol designed to connect Discord bots (`@m3rcena/weky`, `@m3rcena/eco`, and custom bots) with Web Dashboards, REST APIs, and WebSockets.

---

## 📑 Table of Contents

1. [Architecture & Protocol Overview](#1-architecture--protocol-overview)
2. [Core Controller: `M3rcenaBridge`](#2-core-controller-m3rcenabridge)
   - [Constructor & Options](#constructor--options)
   - [Module Registry](#module-registry)
   - [Session Lifecycle](#session-lifecycle)
   - [Action Dispatching](#action-dispatching)
   - [Presence & Scoped Audio](#presence--scoped-audio)
   - [Telemetry & Overview](#telemetry--overview)
3. [WebSocket Gateway Server: `BridgeServer`](#3-websocket-gateway-server-bridgeserver)
   - [Standalone Server](#standalone-server)
   - [Attaching to Express / Fastify / Next.js](#attaching-to-express--fastify--nextjs)
   - [REST HTTP Endpoints](#rest-http-endpoints)
4. [Universal Client SDK: `BridgeClient`](#4-universal-client-sdk-bridgeclient)
   - [Browser & React Integration](#browser--react-integration)
   - [Session Subscriptions](#session-subscriptions)
   - [Action Execution](#action-execution)
   - [Audio Cues & Notifications](#audio-cues--notifications)
5. [Pluggable Storage Adapters](#5-pluggable-storage-adapters)
6. [Type Definitions Reference](#6-type-definitions-reference)

---

## 1. Architecture & Protocol Overview

The bridge operates on a **Module $\rightarrow$ Session $\rightarrow$ Action** protocol hierarchy:

```text
 ┌───────────────────────┐             ┌─────────────────────────┐
 │   Discord Bot Node    │             │      Web Dashboard      │
 │ (@m3rcena/weky / eco) │             │  (React / Next / Vue)   │
 └──────────┬────────────┘             └────────────┬────────────┘
            │                                       │
            ▼                                       ▼
 ┌───────────────────────────────────────────────────────────────┐
 │                     M3rcenaBridge Controller                  │
 │                                                               │
 │  • Modules: "games", "economy", "moderation"                  │
 │  • Active Sessions Registry (state, players, turns)          │
 │  • User Presence Tracker (online/offline)                     │
 │  • Targeted Audio & Toast Notification Dispatcher             │
 └──────────────────────────────┬────────────────────────────────┘
                                │
                                ▼
 ┌───────────────────────────────────────────────────────────────┐
 │               BridgeServer (WebSocket + HTTP)                 │
 │  • Real-time broadcast rooms (session:id, module:name)        │
 │  • Scoped player routing (targetUserIds)                      │
 │  • Built-in REST API (/overview, /sessions, /action)          │
 └───────────────────────────────────────────────────────────────┘
```

---

## 2. Core Controller: `M3rcenaBridge`

### Constructor & Options

```typescript
import { M3rcenaBridge } from "@m3rcena/bridge";

const bridge = new M3rcenaBridge({
  autoCleanEndedSessions: false, // Automatically remove ended sessions from memory
  sessionTimeoutMs: 30 * 60 * 1000, // Session expiration threshold (default: 30 mins)
  requireOnlinePresenceForAudio: true, // Only dispatch sound cues if the target player is online
});
```

### Module Registry

```typescript
bridge.registerModule("economy", async (action, session) => {
  if (action.action === "buy") {
    // Process economy buy action
    return {
      success: true,
      state: { ...session.state, balance: session.state.balance - action.payload.cost },
      announcement: `Purchased ${action.payload.item}`,
      soundKey: "purchase",
      soundUrl: "/sounds/purchase.mp3",
    };
  }
  return { success: false, error: "Unsupported action" };
});
```

### Session Lifecycle

```typescript
// 1. Register a session
const session = await bridge.registerSession({
  id: "session_123",
  module: "economy",
  type: "market_auction",
  platform: "discord",
  players: [{ id: "user_1", username: "Alice", platform: "discord" }],
  state: { currentBid: 50, highestBidder: "user_1" },
  createdAt: Date.now(),
  lastUpdated: Date.now(),
  isEnded: false,
});

// 2. Update state
await bridge.updateSessionState("session_123", { currentBid: 75, highestBidder: "user_2" });

// 3. Conclude session
await bridge.endSession("session_123", { winnerId: "user_2", reason: "Auction timer expired" });
```

---

## 3. WebSocket Gateway Server: `BridgeServer`

### Standalone Server

```typescript
import { BridgeServer } from "@m3rcena/bridge";

const server = new BridgeServer(bridge, {
  port: 4000,
  path: "/bridge",
  secretToken: "SUPER_SECRET_TOKEN",
});

await server.start();
```

### Attaching to Express / Fastify / Next.js

```typescript
import express from "express";
import http from "http";
import { BridgeServer } from "@m3rcena/bridge";

const app = express();
const httpServer = http.createServer(app);

const server = new BridgeServer(bridge, {
  server: httpServer,
  path: "/bridge",
  secretToken: process.env.BRIDGE_SECRET,
});

await server.start();
httpServer.listen(3000);
```

---

## 4. Universal Client SDK: `BridgeClient`

Imported from `@m3rcena/bridge/client`:

```typescript
import { createBridgeClient } from "@m3rcena/bridge/client";

const client = createBridgeClient({
  url: "ws://localhost:4000/bridge",
  token: "SUPER_SECRET_TOKEN",
  userId: "user_42",
  username: "Commander",
  platform: "dashboard",
});

await client.connect();

// Live State Subscription
const unsubscribe = client.subscribeSession("session_123", (state) => {
  console.log("Updated state:", state);
});

// Action Execution
const result = await client.dispatchAction("economy", "session_123", "buy", { cost: 50, item: "Shield" });
```

---

## 5. Pluggable Storage Adapters

```typescript
import { M3rcenaBridge, JsonFileStorageAdapter } from "@m3rcena/bridge";

// File-based persistence across server restarts
const bridge = new M3rcenaBridge({
  storage: new JsonFileStorageAdapter("./data/bridge.json"),
});
```

---

## 6. Type Definitions Reference

All types are exported from the main entry point:

- `BridgePlatform`: `"discord" | "dashboard" | "web" | "api" | "mobile" | "cli"`
- `BridgePlayer`: Participant structure.
- `BridgeSession`: Session state container.
- `BridgeAction`: Inbound action payload.
- `BridgeActionResult`: Result returned from action handlers.
- `BridgeAudioCue`: Scoped audio payload.
- `BridgeNotification`: Live toast notification payload.
- `DashboardOverview`: System status telemetry.

