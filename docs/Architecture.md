# 🏗️ Bridge Architecture & Core Controller

This guide explains the internal design, lifecycle, and operational model of **`@m3rcena/bridge`**.

---

## 📐 Conceptual Model

`@m3rcena/bridge` operates on a **Module $\rightarrow$ Session $\rightarrow$ Action** architecture:

```text
 ┌─────────────────────────────────────────────────────────────┐
 │                    Discord Bot Runtime                      │
 │  • Discord.js Interactions & Message Components             │
 │  • Headless State Engines (@m3rcena/weky, @m3rcena/eco)     │
 └──────────────────────────────┬──────────────────────────────┘
                                │ State Updates / Dispatch Actions
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │                    M3rcenaBridge Controller                 │
 │                                                             │
 │  [Module Registry]  • "games", "economy", "moderation"      │
 │  [Session Store]    • Active sessions, turns, winners       │
 │  [Presence Tracker] • Web/Discord online status             │
 │  [Signal Bus]       • Scoped audio cues & notifications     │
 │  [Package Routers]  • Sub-path request dispatching          │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │               BridgeServer (WebSocket + REST)               │
 │                                                             │
 │  • WebSocket Gateway: /bridge (JSON framing + Heartbeat)    │
 │  • Built-in REST Gateway: /overview, /sessions, /action     │
 │  • Package Sub-routes: /api/weky/*, /api/eco/*              │
 └──────────────────────────────┬──────────────────────────────┘
                                │ WebSocket Frames / HTTP Requests
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │                      Web Dashboard                          │
 │  • React / Next.js / Vue / Svelte Frontend                  │
 │  • @m3rcena/bridge/client SDK                               │
 │  • Custom UI Skins, Canvas Viewers & Live Stats             │
 └─────────────────────────────────────────────────────────────┘
```

---

## 🎛️ The Core Controller: `M3rcenaBridge`

`M3rcenaBridge` is the event-driven brain that coordinates state synchronization across all modules, platforms, and connected clients.

```typescript
import { M3rcenaBridge } from "@m3rcena/bridge";

const bridge = new M3rcenaBridge({
  autoCleanEndedSessions: true,
  sessionTimeoutMs: 15 * 60 * 1000, // 15 minutes of inactivity
  requireOnlinePresenceForAudio: false,
});
```

### Configuration Options (`BridgeOptions`)

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `storage` | `BridgeStorageAdapter` | `MemoryStorageAdapter` | Persistence backend for bridge session state and metadata. |
| `autoCleanEndedSessions` | `boolean` | `false` | When `true`, automatically removes sessions from memory upon termination. |
| `sessionTimeoutMs` | `number` | `1800000` (30m) | Duration in milliseconds before idle sessions are pruned. |
| `requireOnlinePresenceForAudio` | `boolean` | `false` | When `true`, skips dispatching audio cues to users who are currently offline. |

---

## 🔄 Session Lifecycle

A **Session** (`BridgeSession<TState>`) represents an isolated, interactive entity—such as a Tic-Tac-Toe match, a Blackjack table, or a multiplayer heist.

### 1. Registering a Session
```typescript
const session = await bridge.registerSession({
  id: "ttt-guild123-channel456",
  module: "weky",
  type: "tictactoe",
  platform: "hybrid",
  players: [
    { id: "user_1", username: "Alice", platform: "discord", role: "player" },
    { id: "user_2", username: "Bob", platform: "dashboard", role: "player" },
  ],
  currentTurnId: "user_1",
  state: {
    board: ["", "", "", "", "", "", "", "", ""],
    turn: "X",
  },
  onAction: async (action) => {
    // Engine move logic here...
    return { success: true, nextTurnId: "user_2" };
  },
});
```

### 2. Updating Session State
Whenever state changes, notify the bridge. The bridge automatically propagates the delta to all subscribed WebSocket clients:
```typescript
await bridge.updateSessionState("ttt-guild123-channel456", {
  board: ["X", "", "", "", "", "", "", "", ""],
  turn: "O",
}, "user_2"); // Optional: set new current turn
```

### 3. Ending a Session
```typescript
await bridge.endSession("ttt-guild123-channel456", "user_1"); // Marks ended with winner ID
```

---

## ⚡ Cross-Platform Action Dispatching

Actions can originate from **Discord** (buttons, slash commands) or the **Dashboard** (clicks, sliders). The bridge handles them uniformly:

```typescript
const result = await bridge.dispatchAction({
  module: "weky",
  sessionId: "ttt-guild123-channel456",
  playerId: "user_2",
  action: "move",
  payload: { index: 4 },
  sourcePlatform: "dashboard",
});

if (result.success) {
  console.log("Move accepted! Next turn:", result.nextTurnId);
} else {
  console.error("Move rejected:", result.error);
}
```

---

## 🔊 Targeted Audio Cues & Toast Notifications

The bridge features a built-in notification and sound dispatching bus with user-level targeting:

```typescript
// Play a sound to a specific dashboard user
bridge.dispatchAudioCue({
  soundKey: "victory_fanfare",
  soundUrl: "https://assets.example.com/sounds/win.mp3",
  volume: 0.8,
  userId: "user_1", // Targeted to user_1 only!
});

// Broadcast a system-wide announcement toast
bridge.dispatchNotification({
  title: "Mega Jackpot Won!",
  message: "Alice just won $1,000,000 in the High Roller Casino!",
  type: "success",
});
```

---

## 💾 Pluggable Storage Adapters

By default, the bridge uses an ultra-fast in-memory storage adapter (`MemoryStorageAdapter`). For multi-process clustering or persistent deployments, implement `BridgeStorageAdapter`:

```typescript
import { BridgeStorageAdapter, BridgeSession } from "@m3rcena/bridge";

export class RedisBridgeStorage implements BridgeStorageAdapter {
  constructor(private redis: any) {}

  async getSession(id: string): Promise<BridgeSession | null> {
    const raw = await this.redis.get(`bridge:session:${id}`);
    return raw ? JSON.parse(raw) : null;
  }

  async setSession(id: string, session: BridgeSession): Promise<void> {
    await this.redis.set(`bridge:session:${id}`, JSON.stringify(session), "EX", 3600);
  }

  async deleteSession(id: string): Promise<void> {
    await this.redis.del(`bridge:session:${id}`);
  }

  async getAllSessions(): Promise<BridgeSession[]> {
    // Return all active sessions from Redis
    return [];
  }
}
```

---

## 🔗 Express & Connect Middleware

If you are already running an Express, Fastify, or NestJS server for your dashboard, you can mount the Bridge's HTTP dispatch middleware directly:

```typescript
import express from "express";
import { bridge } from "./bot.js";

const app = express();
app.use(express.json());

// Mount bridge package routers (/api/weky, /api/eco, etc.)
app.use(bridge.createMiddleware());

app.listen(3001, () => {
  console.log("Dashboard backend listening on http://localhost:3001");
});
```
