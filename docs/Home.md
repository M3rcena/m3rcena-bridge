# 🌉 Welcome to @m3rcena/bridge Documentation

Welcome to the official documentation for **`@m3rcena/bridge`** — the unified, cross-platform state synchronization and communication protocol designed to connect Discord bots, web dashboards, REST APIs, and WebSockets.

---

## 🌟 What is @m3rcena/bridge?

`@m3rcena/bridge` solves the fundamental challenge of building modern Discord bots: **cross-platform synchronization**. Traditionally, Discord bots live in isolation; building a web dashboard meant hacking together custom webhooks, polling databases, or creating brittle custom WebSocket implementations.

`@m3rcena/bridge` decouples business logic from presentation:
- **Headless Engines**: Run games, economy actions, or moderation headlessly without requiring Discord interaction objects.
- **Bi-directional Synchronization**: Changes made in Discord reflect on the dashboard in real-time, and actions dispatched from the dashboard execute instantaneously inside Discord.
- **Universal Package Routers**: Any package (`@m3rcena/weky`, `@m3rcena/eco`, or your own custom bot systems) mounts directly into the Bridge via `BridgePackageRouter`.
- **Targeted Audio & Haptics**: Stream real-time sound cues and toast notifications to specific web dashboard users or global sessions.
- **Universal Client SDK**: Plug-and-play browser client (`@m3rcena/bridge/client`) with native React hooks (`useBridgeSession`), automatic reconnection, and state synchronization.

---

## 🚀 Quick Navigation

Explore the comprehensive guides below:

| Guide | Description |
| :--- | :--- |
| 🏗️ **[Architecture & Design](Architecture.md)** | Core controller, session lifecycle, presence tracking, and storage adapters. |
| 🔌 **[Connecting Packages](Connecting-Packages.md)** | How to connect `@m3rcena/weky`, `@m3rcena/eco`, or custom packages to the bridge. |
| 📡 **[REST & WebSocket Protocol](REST-and-WebSocket-API.md)** | Full HTTP endpoint specifications and real-time WebSocket protocol frames. |
| 💻 **[Client SDK & React Hooks](Client-SDK.md)** | Integrating dashboards with React, Vue, Next.js, and vanilla JavaScript. |

---

## 📦 Installation

Install `@m3rcena/bridge` alongside your Discord bot or web backend:

```bash
# npm
npm install @m3rcena/bridge

# pnpm
pnpm add @m3rcena/bridge

# yarn
yarn add @m3rcena/bridge
```

### Peer Dependencies
- **Node.js**: `>= 22.0.0` (Native `fetch`, `crypto`, and ES Modules)
- **TypeScript**: `>= 5.0` (Full type safety)
- **ws**: `^8.18.0` (Included)

---

## ⚡ 60-Second Quickstart

### 1. Initialize the Bridge in your Bot / Backend
```typescript
import { M3rcenaBridge, BridgeServer } from "@m3rcena/bridge";
import { WekyBridgeRouter } from "@m3rcena/weky";
import { EcoBridgeRouter } from "@m3rcena/eco";

// 1. Create Bridge Controller
export const bridge = new M3rcenaBridge({
  autoCleanEndedSessions: false,
  sessionTimeoutMs: 30 * 60 * 1000,
});

// 2. Mount Package Routers
bridge.mountPackage(new WekyBridgeRouter(wekyManager));
bridge.mountPackage(new EcoBridgeRouter(ecoManager));

// 3. Launch Standalone Gateway Server (or attach to Express)
export const bridgeServer = new BridgeServer(bridge, {
  port: 4000,
  path: "/bridge",
});

await bridgeServer.start();
console.log("🌉 Bridge Gateway running at http://localhost:4000/bridge");
```

### 2. Connect from Web Dashboard (React Example)
```tsx
import React from "react";
import { BridgeClient, useBridgeSession } from "@m3rcena/bridge/client";

const client = new BridgeClient({
  url: "ws://localhost:4000/bridge",
  userId: "102794864",
  autoConnect: true,
});

export function GameDashboard({ sessionId }: { sessionId: string }) {
  const { session, isConnected, dispatchAction } = useBridgeSession(client, sessionId);

  if (!isConnected) return <div>Connecting to Bridge Gateway...</div>;
  if (!session) return <div>Waiting for active session...</div>;

  return (
    <div className="game-card">
      <h2>Session: {session.type} ({session.id})</h2>
      <p>Current Turn: {session.currentTurnId}</p>
      <button onClick={() => dispatchAction("make_move", { index: 4 })}>
        Play Move (Center)
      </button>
    </div>
  );
}
```

---

*Need help? Check out our [Connecting Packages Guide](Connecting-Packages.md) or open an issue on GitHub.*
