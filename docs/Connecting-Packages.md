# 🔌 Connecting Packages to @m3rcena/bridge

This guide demonstrates how package authors and developers connect their packages to `@m3rcena/bridge` using the **Universal Package Router** model.

---

## 🎯 The Philosophy: Decoupled State vs Custom Visuals

The core philosophy of `@m3rcena/bridge` is **strict separation between mechanics and presentation**:

1. **The Engine handles mechanics**: Turn validation, board math, bank account balances, dice rolls, cooldowns, and win/loss states.
2. **The Dashboard handles presentation**: React components, 3D Canvas, Tailwind styles, custom sprites, and interactive animations.
3. **The Bridge synchronizes everything**: Dispatches actions from buttons/clicks, streams state updates over WebSockets, generates on-demand canvas cards, and notifies players.

Developers using the bridge can completely reskin games and economy dashboards without touching the underlying game logic!

---

## 🏛️ The `BridgePackageRouter` Interface

To connect any package to the bridge, create an object or class implementing `BridgePackageRouter`:

```typescript
export interface BridgeRequest {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  url: string;        // Full original request URL (e.g., "/api/custom/stats?user=123")
  path: string;       // Full pathname (e.g., "/api/custom/stats")
  subPath: string;    // Path relative to package mount (e.g., "/stats")
  params: Record<string, string>;
  query: Record<string, string>;
  headers: Record<string, string | string[] | undefined>;
  body?: any;
}

export interface BridgeResponse {
  status: number;
  contentType?: string;
  isBuffer?: boolean;
  body: any;
  headers?: Record<string, string>;
}

export interface BridgePackageRouter {
  name: string;                                          // Unique package key (e.g., "weky", "eco")
  basePath: string;                                      // Base mount route (e.g., "/api/weky", "/api/eco")
  handleRequest(req: BridgeRequest): Promise<BridgeResponse | null> | BridgeResponse | null;
}
```

---

## 🎮 Case Study 1: Connecting `@m3rcena/weky`

`@m3rcena/weky` provides `WekyBridgeRouter`, which exposes the entire minigame engine and canvas card generator to the Bridge:

```typescript
import { M3rcenaBridge } from "@m3rcena/bridge";
import { WekyManager, WekyBridgeRouter } from "@m3rcena/weky";

// 1. Initialize Weky Engine
const weky = new WekyManager();

// 2. Initialize Bridge
const bridge = new M3rcenaBridge();

// 3. Connect Weky to Bridge
const wekyRouter = new WekyBridgeRouter(weky);
bridge.mountPackage(wekyRouter);
```

### What `WekyBridgeRouter` Exposes:
- **`GET /api/weky/games`**: Returns metadata and schemas for all 17 minigames.
- **`POST /api/weky/games/start`**: Starts a headless game session.
- **`POST /api/weky/games/action`**: Executes a game action (e.g. TicTacToe move, Connect4 drop, 2048 slide).
- **`GET /api/weky/cards/gamer-profile`**: Generates a high-performance Rust canvas gamer card image.
- **`GET /api/weky/cards/game-board`**: Renders on-demand PNG snapshots of current board states.

---

## 💰 Case Study 2: Connecting `@m3rcena/eco`

`@m3rcena/eco` provides `EcoBridgeRouter`, which connects the real-economy engine, bank vaults, credit scores, stock exchange, and casino to the Bridge:

```typescript
import { M3rcenaBridge } from "@m3rcena/bridge";
import { EcoManager } from "@m3rcena/eco";
import { EcoBridgeRouter } from "@m3rcena/eco";

// 1. Initialize Eco Engine
const eco = new EcoManager({
  currencySymbol: "🪙",
  startingBalance: 1000,
});

// 2. Initialize Bridge
const bridge = new M3rcenaBridge();

// 3. Connect Eco to Bridge
const ecoRouter = new EcoBridgeRouter(eco);
bridge.mountPackage(ecoRouter);
```

### What `EcoBridgeRouter` Exposes:
- **`GET /api/eco/profile/:userId`**: Balance, bank, vault tier, credit score, inventory, job, and tax status.
- **`POST /api/eco/vault/upgrade`**: Upgrades user bank vault tier.
- **`POST /api/eco/loan/apply`**: Applies for a collateralized bank loan based on credit score.
- **`POST /api/eco/casino/play`**: Headless casino round (Blackjack, Roulette, Slots, Crash).
- **`GET /api/eco/cards/bank-card`**: Generates high-res PNG bank debit cards.
- **`GET /api/eco/cards/candlestick`**: Generates live stock market candlestick charts.

---

## 🛠️ Writing Your Own Custom Package Router

Here is how you can create a custom package router for your own system (e.g. an RPG / Leveling system):

```typescript
import { BridgePackageRouter, BridgeRequest, BridgeResponse } from "@m3rcena/bridge";

export class LevelingBridgeRouter implements BridgePackageRouter {
  public name = "levels";
  public basePath = "/api/levels";

  constructor(private levelingEngine: any) {}

  public async handleRequest(req: BridgeRequest): Promise<BridgeResponse | null> {
    const { subPath, method, query, body } = req;

    // GET /api/levels/rank?userId=123
    if (method === "GET" && subPath === "/rank") {
      const userRank = await this.levelingEngine.getRank(query.userId);
      return {
        status: 200,
        body: userRank,
      };
    }

    // POST /api/levels/award-xp
    if (method === "POST" && subPath === "/award-xp") {
      const { userId, amount } = body;
      const updated = await this.levelingEngine.addXp(userId, amount);
      return {
        status: 200,
        body: { success: true, updated },
      };
    }

    // GET /api/levels/card?userId=123 (Canvas image response)
    if (method === "GET" && subPath === "/card") {
      const imageBuffer = await this.levelingEngine.renderRankCard(query.userId);
      return {
        status: 200,
        contentType: "image/png",
        isBuffer: true,
        body: imageBuffer,
      };
    }

    // Path not handled by this router
    return null;
  }
}
```

### Mounting the Custom Router
```typescript
bridge.mountPackage(new LevelingBridgeRouter(myLevelingEngine));
```

Now, any dashboard client connecting via HTTP or WebSocket can query `/api/levels/rank` or `/api/levels/card` seamlessly!

---

## 🔄 Bidirectional State Sync Flow

When a player clicks a button on the dashboard:
1. Dashboard client sends `dispatch_action` over WebSocket or `POST /action` via REST.
2. The Bridge locates the active session and invokes `onAction(action)`.
3. The underlying engine executes the game logic and calculates the new state.
4. The Bridge emits a `sync` event.
5. All connected dashboard clients and Discord message components update instantly with the new state.

Both Discord and Web users play simultaneously with zero latency!
