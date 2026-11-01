<div align="center">
  <h1>@m3rcena/bridge</h1>
  <h3>Universal Cross-Platform Gateway & Real-Time State Synchronizer</h3>
  <p>
    <b>Connect your Discord Bot Ecosystem to Web Dashboards, REST APIs, and WebSockets.</b><br>
    The shared, production-grade bridge standard for all <code>@m3rcena</code> packages.
  </p>

  <p>
    <a href="https://www.npmjs.com/package/@m3rcena/bridge">
      <img src="https://img.shields.io/npm/v/@m3rcena/bridge?style=for-the-badge&color=crimson" alt="NPM Version" />
    </a>
    <a href="https://discord.gg/U4E2Pn2wyn">
      <img src="https://img.shields.io/discord/1447491639550410796?style=for-the-badge&label=Support&color=5865F2" alt="Discord Support" />
    </a>
  </p>
  <p>
    <img src="https://img.shields.io/badge/Node.js-22%20%7C%2024%20%7C%2026%20LTS-green?style=flat-square&logo=node.js" alt="Node LTS" />
    <img src="https://img.shields.io/badge/TypeScript-7.0-blue?style=flat-square&logo=typescript" alt="TypeScript" />
    <img src="https://img.shields.io/badge/License-Apache--2.0-blueviolet?style=flat-square" alt="Apache-2.0" />
    <a href="https://github.com/M3rcena/m3rcena-weky/wiki/Bridge-Architecture-and-Routers">
      <img src="https://img.shields.io/badge/Wiki-Documentation-purple?style=flat-square&logo=gitbook" alt="Wiki Documentation" />
    </a>
  </p>
</div>

> 📚 **Complete Documentation Wiki**: For detailed architecture guides, package router specs, and client SDK walkthroughs, visit the **[M3rcena Official Wiki](https://github.com/M3rcena/m3rcena-weky/wiki/Bridge-Architecture-and-Routers)**.

---

## ⚡ Why @m3rcena/bridge?

Instead of implementing custom, duplicate bridge code inside each separate Discord bot package (`@m3rcena/weky`, `@m3rcena/eco`, etc.), **`@m3rcena/bridge`** provides a single, high-performance universal synchronization standard:

- 🌐 **Multi-Module Registry**: Mount multiple bot disciplines (`games`, `economy`, `moderation`, `custom`) on a single unified bridge gateway.
- 🔄 **Real-Time State Synchronization**: Live WebSocket push updates whenever sessions, matches, or inventories change.
- 🎮 **Cross-Platform Action Dispatching**: Seamlessly trigger game moves, economy transactions, or admin actions from Web Dashboards, REST APIs, or Discord bots with correlated response handling.
- 🔊 **Targeted Scoped Audio & Notifications**: Broadcast audio cues (MP3 sounds) and notifications strictly to the active player's browser session with presence filtering (`requireOnlinePresenceForAudio`).
- 👥 **User Presence Tracking**: Detect when dashboard users connect or disconnect with instant online/offline state.
- 💾 **Pluggable Storage Adapters**: In-memory (default) or file-based (`JsonFileStorageAdapter`), with simple interfaces for database persistence (MongoDB, PostgreSQL, Prisma).
- 💻 **Universal Client SDK**: Ready-to-use client SDK exported directly via `@m3rcena/bridge/client` for Next.js, React, Vue, Electron, or Node.js.

---

## 📦 Installation

```bash
npm install @m3rcena/bridge
# or
pnpm add @m3rcena/bridge
# or
yarn add @m3rcena/bridge
```

---

## 🚀 Quick Start: Server Side (Discord Bot or Backend)

### 1. Initialize the Core Bridge

```typescript
import { M3rcenaBridge, BridgeServer } from "@m3rcena/bridge";

// 1. Create the Bridge controller
export const bridge = new M3rcenaBridge({
  requireOnlinePresenceForAudio: true, // Only emit sounds if the user has an open dashboard tab
});

// 2. Register your modules with action handlers
bridge.registerModule("games", async (action, session) => {
  if (action.action === "hit") {
    const newHp = Math.max(0, session.state.hp - 20);
    return {
      success: true,
      state: { ...session.state, hp: newHp },
      soundKey: "hit",
      soundUrl: "/sounds/hit.mp3",
    };
  }
  return { success: false, error: "Unknown action" };
});

bridge.registerModule("economy");

// 3. Start the Real-Time WebSocket Server Gateway
const server = new BridgeServer(bridge, {
  port: 4000,
  path: "/bridge",
  secretToken: "your_secure_bridge_secret",
});

await server.start();
console.log("🚀 Bridge WebSocket Gateway running at ws://localhost:4000/bridge");
```

---

## 💻 Quick Start: Client Side (Web Dashboard / React / Next.js)

Import the lightweight client SDK directly:

```typescript
import { createBridgeClient } from "@m3rcena/bridge/client";

// 1. Connect to the Bridge
const client = createBridgeClient({
  url: "ws://localhost:4000/bridge",
  token: "your_secure_bridge_secret",
  userId: "1447491639550410796", // Authenticated Discord user ID
  username: "M3rcena",
  platform: "dashboard",
});

await client.connect();

// 2. Subscribe to live match or session state
const unsubscribe = client.subscribeSession("sess_fight_123", (newState) => {
  console.log("Live State Update:", newState);
  // Update your React / Vue state
});

// 3. Dispatch moves/actions directly from your dashboard UI
const result = await client.dispatchAction("games", "sess_fight_123", "hit");
console.log("Action Result:", result);

// 4. Listen for targeted sound cues
client.onAudioCue(({ soundKey, soundUrl }) => {
  new Audio(soundUrl).play();
});

// 5. Listen for real-time notifications
client.onNotification(({ title, message, type }) => {
  showToast(`${title}: ${message}`);
});
```

---

## 📊 Dashboard Overview Endpoint

Get a real-time overview of all connected users, active games, and system stats for your dashboard home screen:

```typescript
const overview = await bridge.getDashboardOverview();
console.log(overview);
/*
{
  activeModules: ["games", "economy"],
  onlineUsersCount: 14,
  onlineUsers: [{ userId: "123", username: "Alpha", platform: "dashboard" }],
  activeSessionsCount: 3,
  activeSessions: [...],
  uptime: 3600000,
  stats: { totalActionsDispatched: 85, totalSessionsCreated: 12 }
}
*/
```

---

## 📄 License

Distributed under the **Apache-2.0 License**. See [LICENSE](./LICENSE) for details.

<p align="center">
  Engineered with ❤️ by <b>M3rcena</b>
</p>

