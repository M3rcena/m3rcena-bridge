# 💻 Universal Client SDK & Framework Integration

This guide demonstrates how to consume `@m3rcena/bridge` in frontend applications (React, Next.js, Vue, vanilla JavaScript) using the official `@m3rcena/bridge/client` SDK.

---

## 📦 Importing the Client SDK

The client SDK is bundled with `@m3rcena/bridge` and is tree-shakeable:

```typescript
// Core Client class
import { BridgeClient } from "@m3rcena/bridge/client";

// React Hooks
import { useBridgeSession } from "@m3rcena/bridge/client";
```

---

## 🚀 `BridgeClient` API Reference

### Initialization & Options
```typescript
const client = new BridgeClient({
  url: "ws://localhost:4000/bridge", // Bridge WebSocket gateway URL
  userId: "102794864",               // Connected Discord user ID
  username: "M3rcena",               // Optional username for display
  autoConnect: true,                 // Automatically connect upon instantiation
  reconnectInterval: 3000,           // Time between reconnect attempts (ms)
  maxReconnectAttempts: 10,          // Maximum reconnect retries
});
```

### Core Methods

| Method | Return Type | Description |
| :--- | :--- | :--- |
| `connect()` | `Promise<void>` | Manually initiates the WebSocket connection. |
| `disconnect()` | `void` | Closes the connection and cancels reconnect timers. |
| `subscribeSession(sessionId)` | `void` | Subscribes socket to state sync frames for a session. |
| `unsubscribeSession(sessionId)` | `void` | Leaves session subscription. |
| `dispatchAction(action)` | `Promise<BridgeActionResult>` | Dispatches an interactive action and awaits the result. |
| `getOverview()` | `Promise<DashboardOverview>` | Fetches live gateway telemetry via WebSocket. |
| `on(event, handler)` | `void` | Listens for events (`sync`, `audioCue`, `notification`, `connected`, `disconnected`). |

---

## ⚛️ React Integration: `useBridgeSession`

`useBridgeSession` is a production-ready React hook that handles subscribing, local state updates, turn tracking, and action dispatching with zero boilerplate:

```tsx
import React from "react";
import { BridgeClient, useBridgeSession } from "@m3rcena/bridge/client";

const bridgeClient = new BridgeClient({
  url: "ws://localhost:4000/bridge",
  userId: "102794864",
  autoConnect: true,
});

export function TicTacToeView({ sessionId }: { sessionId: string }) {
  const { session, isConnected, error, dispatchAction } = useBridgeSession(
    bridgeClient,
    sessionId
  );

  if (!isConnected) return <div>Connecting to Bridge Gateway...</div>;
  if (!session) return <div>Loading match session...</div>;

  const board: string[] = session.state?.board || Array(9).fill("");
  const isMyTurn = session.currentTurnId === "102794864";

  const handleCellClick = async (index: number) => {
    if (!isMyTurn || board[index] !== "" || session.isEnded) return;

    const res = await dispatchAction("move", { index });
    if (!res.success) {
      alert(res.error || "Invalid move!");
    }
  };

  return (
    <div className="ttt-game">
      <h2>Game Status: {session.isEnded ? "Match Over!" : `Turn: ${session.currentTurnId}`}</h2>
      {session.winnerId && <h3>Winner: {session.winnerId}</h3>}

      <div className="grid-3x3">
        {board.map((cell, idx) => (
          <button
            key={idx}
            disabled={!isMyTurn || cell !== "" || session.isEnded}
            onClick={() => handleCellClick(idx)}
            className="cell"
          >
            {cell || " "}
          </button>
        ))}
      </div>
    </div>
  );
}
```

---

## 🔊 Handling Targeted Audio & Notifications

The client SDK automatically receives targeted sound cues and system alerts dispatched from the bot:

```typescript
client.on("audioCue", (cue) => {
  console.log("Playing sound cue:", cue.soundKey, cue.soundUrl);
  if (cue.soundUrl) {
    const audio = new Audio(cue.soundUrl);
    audio.volume = cue.volume ?? 1.0;
    audio.play().catch(console.error);
  }
});

client.on("notification", (notif) => {
  // Show a toast or banner
  toast({
    title: notif.title,
    description: notif.message,
    status: notif.type,
  });
});
```

---

## 🌐 Vanilla JavaScript / HTML Integration

For minimal setups without modern build frameworks:

```html
<!DOCTYPE html>
<html>
<head>
  <title>M3rcena Bridge Client</title>
</head>
<body>
  <div id="status">Connecting...</div>
  <pre id="state"></pre>

  <script type="module">
    import { BridgeClient } from "./node_modules/@m3rcena/bridge/dist/client.mjs";

    const client = new BridgeClient({
      url: "ws://localhost:4000/bridge",
      userId: "user_1",
      autoConnect: true,
    });

    client.on("connected", () => {
      document.getElementById("status").textContent = "Connected to Bridge!";
      client.subscribeSession("active_session_id");
    });

    client.on("sync", (event) => {
      document.getElementById("state").textContent = JSON.stringify(event.state, null, 2);
    });
  </script>
</body>
</html>
```
