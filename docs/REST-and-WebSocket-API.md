# 📡 REST & WebSocket Protocol Specification

This document details the HTTP REST endpoints and the real-time WebSocket protocol provided by **`@m3rcena/bridge`**.

---

## 🌐 Server Deployment

The bridge gateway runs either as a standalone HTTP + WebSocket server or attached to an existing HTTP server (Express, Fastify, Next.js).

```typescript
import { BridgeServer } from "@m3rcena/bridge";

const server = new BridgeServer(bridge, {
  port: 4000,                  // Standalone port
  path: "/bridge",             // WebSocket mount path
  heartbeatInterval: 30000,    // 30s ping-pong keepalive
  secretToken: "secret_123",   // Optional API authorization
});

await server.start();
```

---

## 📬 Built-in REST Endpoints

### 1. Gateway Health Check
* **Endpoint**: `GET /health`
* **Response**:
```json
{
  "status": "ok",
  "timestamp": 1761984000000
}
```

---

### 2. Dashboard Overview Telemetry
* **Endpoint**: `GET /overview`
* **Response**:
```json
{
  "activeModules": ["weky", "eco"],
  "activeSessionsCount": 3,
  "onlineUsersCount": 12,
  "totalActionsDispatched": 1420,
  "uptimeSeconds": 3600,
  "memoryUsage": {
    "rss": 54210560,
    "heapTotal": 31200000,
    "heapUsed": 24800000
  }
}
```

---

### 3. Active Sessions List
* **Endpoint**: `GET /sessions`
* **Response**: An array of active session snapshots:
```json
[
  {
    "id": "ttt-guild-ch",
    "module": "weky",
    "type": "tictactoe",
    "platform": "hybrid",
    "players": [
      { "id": "102794864", "username": "M3rcena", "platform": "discord" }
    ],
    "currentTurnId": "102794864",
    "isEnded": false,
    "createdAt": 1761983000000,
    "lastUpdated": 1761983020000
  }
]
```

---

### 4. Dispatch Action
* **Endpoint**: `POST /action`
* **Headers**: `Content-Type: application/json`
* **Request Body**:
```json
{
  "module": "weky",
  "sessionId": "ttt-guild-ch",
  "playerId": "102794864",
  "action": "move",
  "payload": { "index": 4 },
  "sourcePlatform": "dashboard"
}
```
* **Success Response (200 OK)**:
```json
{
  "success": true,
  "nextTurnId": "opponent_id",
  "isEnded": false,
  "state": {
    "board": ["", "", "", "", "X", "", "", "", ""],
    "turn": "O"
  }
}
```
* **Failure Response (400 Bad Request)**:
```json
{
  "success": false,
  "error": "Not your turn or square already occupied"
}
```

---

### 5. Mounted Package Routers
All routes matching package base paths (e.g., `/api/weky/*`, `/api/eco/*`) are automatically routed to their respective package routers:

* `GET /api/weky/games` $\rightarrow$ Weky game metadata catalog
* `GET /api/eco/profile/:userId` $\rightarrow$ Eco balance, credit score, vault status
* `GET /api/weky/cards/gamer-profile?userId=123` $\rightarrow$ Canvas PNG image response

---

## ⚡ Real-Time WebSocket Protocol (`/bridge`)

Connect to the WebSocket endpoint at `ws://<host>:<port>/bridge`. All frames are UTF-8 JSON strings.

### Client-to-Server Messages (Inbound)

#### 1. Identify Client & Presence
Announces the client's user identity to track presence and receive targeted audio cues.
```json
{
  "type": "identify",
  "userId": "102794864",
  "username": "M3rcena",
  "platform": "dashboard"
}
```

#### 2. Subscribe to Session
Subscribes the socket to state updates for an active session.
```json
{
  "type": "subscribe_session",
  "sessionId": "ttt-guild-ch"
}
```

#### 3. Unsubscribe from Session
```json
{
  "type": "unsubscribe_session",
  "sessionId": "ttt-guild-ch"
}
```

#### 4. Subscribe to Module
Subscribes to all events occurring in a module (e.g. `eco` transactions or `weky` matches).
```json
{
  "type": "subscribe_module",
  "module": "eco"
}
```

#### 5. Dispatch Action
Dispatches an interactive action into the bridge engine.
```json
{
  "type": "dispatch_action",
  "correlationId": "req_abc123",
  "module": "weky",
  "sessionId": "ttt-guild-ch",
  "playerId": "102794864",
  "action": "move",
  "payload": { "index": 0 }
}
```

#### 6. Ping / Heartbeat
```json
{ "type": "ping" }
```

---

### Server-to-Client Messages (Outbound)

#### 1. Session State Sync (`sync`)
Broadcast to all sockets subscribed to the session whenever the state changes.
```json
{
  "type": "sync",
  "sessionId": "ttt-guild-ch",
  "module": "weky",
  "state": {
    "board": ["X", "", "", "", "O", "", "", "", ""],
    "turn": "X"
  },
  "currentTurnId": "102794864",
  "isEnded": false,
  "winnerId": null,
  "lastUpdated": 1761984025000
}
```

#### 2. Action Result (`action_result`)
Returned directly to the requesting client socket matching the `correlationId`.
```json
{
  "type": "action_result",
  "correlationId": "req_abc123",
  "result": {
    "success": true,
    "nextTurnId": "opponent_id",
    "isEnded": false
  }
}
```

#### 3. Audio Cue (`audio_cue`)
Targeted to specific users or broadcast across all dashboard clients.
```json
{
  "type": "audio_cue",
  "module": "weky",
  "soundKey": "move_placed",
  "soundUrl": "https://assets.example.com/click.mp3",
  "volume": 0.5,
  "userId": "102794864"
}
```

#### 4. Notification Toast (`notification`)
```json
{
  "type": "notification",
  "id": "notif_789",
  "title": "Level Up!",
  "message": "You reached Level 50!",
  "type": "success",
  "timestamp": 1761984030000
}
```

#### 5. Pong
```json
{
  "type": "pong",
  "timestamp": 1761984035000
}
```
