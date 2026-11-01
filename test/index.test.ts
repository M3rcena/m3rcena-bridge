/**
 * Comprehensive Test Suite for @m3rcena/bridge
 */

import assert from "assert";
import fs from "fs";
import path from "path";
import {
  M3rcenaBridge,
  BridgeServer,
  BridgeClient,
  MemoryStorageAdapter,
  JsonFileStorageAdapter,
} from "../src/index.js";

async function runTests() {
  console.log("=== STARTING @m3rcena/bridge COMPREHENSIVE TEST SUITE ===\n");

  // --------------------------------------------------------------------------
  // 1. Core Bridge Initialization & Module Registration
  // --------------------------------------------------------------------------
  console.log("1. Testing Core Bridge & Module Registry...");
  const bridge = new M3rcenaBridge({
    autoCleanEndedSessions: false,
    requireOnlinePresenceForAudio: true,
  });

  bridge.registerModule("games", async (action, session) => {
    if (action.action === "hit") {
      const currentHp = session.state.hp || 100;
      const newHp = Math.max(0, currentHp - 25);
      return {
        success: true,
        state: { ...session.state, hp: newHp },
        isEnded: newHp === 0,
        winnerId: newHp === 0 ? action.playerId : undefined,
        soundKey: "hit",
        soundUrl: "/assets/sounds/hit.mp3",
      };
    }
    return { success: false, error: "Unknown action" };
  });

  bridge.registerModule("economy");

  const modules = bridge.getRegisteredModules();
  assert(modules.includes("games"), "Module 'games' registered");
  assert(modules.includes("economy"), "Module 'economy' registered");
  console.log("  ✓ Module registration verified\n");

  // --------------------------------------------------------------------------
  // 2. Session Lifecycle Management
  // --------------------------------------------------------------------------
  console.log("2. Testing Session Lifecycle...");
  let syncCaptured: any = null;
  bridge.on("sync", (ev) => {
    syncCaptured = ev;
  });

  const session1 = await bridge.registerSession({
    id: "sess_fight_1",
    module: "games",
    type: "fight",
    platform: "discord",
    players: [
      { id: "p1", username: "Knight", platform: "discord" },
      { id: "p2", username: "Dragon", platform: "dashboard" },
    ],
    state: { hp: 100, turn: "p1" },
    createdAt: Date.now(),
    lastUpdated: Date.now(),
    isEnded: false,
  });

  assert(session1.id === "sess_fight_1", "Session registered with correct ID");
  assert(syncCaptured?.sessionId === "sess_fight_1", "Sync event fired upon session creation");
  assert(bridge.getActiveSessions().length === 1, "Active sessions count is 1");

  // Update session state directly
  await bridge.updateSessionState("sess_fight_1", { hp: 90, turn: "p2" }, "discord");
  const fetched = bridge.getSession("sess_fight_1");
  assert(fetched?.state.hp === 90, "Session state updated to 90");
  assert(fetched?.state.turn === "p2", "Turn updated to p2");

  // Filter sessions by player
  const p1Sessions = bridge.getSessionsForPlayer("p1");
  assert(p1Sessions.length === 1 && p1Sessions[0].id === "sess_fight_1", "getSessionsForPlayer verified");

  console.log("  ✓ Session creation, state update, and filtering verified\n");

  // --------------------------------------------------------------------------
  // 3. Action Dispatching & Sound Triggering
  // --------------------------------------------------------------------------
  console.log("3. Testing Action Dispatching...");
  let capturedAudio: any = null;
  bridge.on("audioCue", (cue) => {
    capturedAudio = cue;
  });

  // Action executed via module handler
  const actionRes = await bridge.dispatchAction({
    module: "games",
    sessionId: "sess_fight_1",
    playerId: "p1",
    action: "hit",
    sourcePlatform: "discord",
  });

  assert(actionRes.success, "Action executed successfully");
  assert(actionRes.state.hp === 65, "Action reduced HP from 90 to 65 (-25)");

  // End session
  await bridge.endSession("sess_fight_1", { winnerId: "p1", reason: "Knockout" });
  assert(bridge.getSession("sess_fight_1")?.isEnded === true, "Session marked ended");
  assert(bridge.getActiveSessions().length === 0, "No active sessions remaining");
  console.log("  ✓ Action execution, state mutation, and session conclusion verified\n");

  // --------------------------------------------------------------------------
  // 4. Presence Tracking & Scoped Audio Delivery
  // --------------------------------------------------------------------------
  console.log("4. Testing User Presence & Scoped Audio Cues...");
  assert(!bridge.isUserOnline("user_alpha"), "User is initially offline");

  // Attempt audio cue while offline (with requireOnlinePresenceForAudio: true)
  const offlineAudioResult = bridge.dispatchAudioCue({
    soundKey: "victory",
    soundUrl: "/assets/sounds/victory.mp3",
    userId: "user_alpha",
    timestamp: Date.now(),
  });
  assert(!offlineAudioResult, "Audio cue skipped when user is offline");

  // Mark user online
  bridge.setClientOnline({
    userId: "user_alpha",
    username: "AlphaGamer",
    platform: "dashboard",
    connectedAt: Date.now(),
    lastSeen: Date.now(),
  });

  assert(bridge.isUserOnline("user_alpha"), "User is recognized as online");
  assert(bridge.getActiveUsers().includes("user_alpha"), "User present in active users list");

  // Now audio cue should dispatch
  const onlineAudioResult = bridge.dispatchAudioCue({
    soundKey: "victory",
    soundUrl: "/assets/sounds/victory.mp3",
    userId: "user_alpha",
    timestamp: Date.now(),
  });
  assert(onlineAudioResult, "Audio cue dispatched for online user");
  assert(capturedAudio?.soundKey === "victory", "Captured audio cue key matches");

  // Mark user offline
  bridge.setClientOffline("user_alpha");
  assert(!bridge.isUserOnline("user_alpha"), "User is marked offline upon disconnect");
  console.log("  ✓ User presence tracking and scoped audio filtering verified\n");

  // --------------------------------------------------------------------------
  // 5. Notifications & Dashboard Overview
  // --------------------------------------------------------------------------
  console.log("5. Testing Notifications & Dashboard Overview...");
  let capturedNotif: any = null;
  bridge.on("notification", (n) => {
    capturedNotif = n;
  });

  const notif = bridge.dispatchNotification({
    module: "economy",
    title: "Daily Reward Claimed",
    message: "You claimed 500 coins!",
    type: "success",
    userId: "user_beta",
  });
  assert(notif.id.startsWith("notif_"), "Generated unique notification ID");
  assert(capturedNotif?.title === "Daily Reward Claimed", "Captured notification matches");

  const overview = await bridge.getDashboardOverview();
  assert(Array.isArray(overview.activeModules), "activeModules is an array");
  assert(typeof overview.onlineUsersCount === "number", "onlineUsersCount is a number");
  assert(typeof overview.uptime === "number", "uptime is a number");
  console.log("  ✓ Notifications and dashboard overview verified\n");

  // --------------------------------------------------------------------------
  // 6. Pluggable Storage Adapters
  // --------------------------------------------------------------------------
  console.log("6. Testing Storage Adapters...");
  const memStorage = new MemoryStorageAdapter();
  await memStorage.saveData("balance_p1", 1500);
  assert((await memStorage.getData("balance_p1")) === 1500, "MemoryStorage saved and retrieved data");

  const testJsonPath = path.resolve(process.cwd(), "./test-bridge-data.json");
  if (fs.existsSync(testJsonPath)) fs.unlinkSync(testJsonPath);

  const jsonStorage = new JsonFileStorageAdapter("./test-bridge-data.json");
  await jsonStorage.saveData("server_prefix", "!");
  assert((await jsonStorage.getData("server_prefix")) === "!", "JsonFileStorage saved and retrieved data");

  // Clean up test file
  if (fs.existsSync(testJsonPath)) fs.unlinkSync(testJsonPath);
  console.log("  ✓ MemoryStorageAdapter and JsonFileStorageAdapter verified\n");

  // --------------------------------------------------------------------------
  // 7. Full Live WebSocket Server & Client Roundtrip
  // --------------------------------------------------------------------------
  console.log("7. Testing Live WebSocket Server & Client SDK Gateway...");
  const serverBridge = new M3rcenaBridge();
  serverBridge.registerModule("economy", async (action, session) => {
    if (action.action === "pay") {
      const amount = action.payload?.amount || 0;
      session.state.balance = (session.state.balance || 1000) - amount;
      return {
        success: true,
        state: session.state,
        announcement: `Transferred ${amount} coins`,
      };
    }
    return { success: false, error: "Unknown action" };
  });

  const testPort = 4055;
  const bridgeServer = new BridgeServer(serverBridge, {
    port: testPort,
    path: "/bridge",
    secretToken: "secret_bridge_token_123",
  });
  await bridgeServer.start();

  const client = new BridgeClient({
    url: `ws://localhost:${testPort}/bridge`,
    token: "secret_bridge_token_123",
    userId: "client_user_1",
    username: "DashMaster",
    autoReconnect: false,
  });

  await client.connect();
  assert(client.connected, "BridgeClient successfully connected to BridgeServer");

  // Create an active session on server
  await serverBridge.registerSession({
    id: "sess_eco_100",
    module: "economy",
    type: "bank",
    platform: "discord",
    players: [{ id: "client_user_1", username: "DashMaster", platform: "dashboard" }],
    state: { balance: 1000 },
    createdAt: Date.now(),
    lastUpdated: Date.now(),
    isEnded: false,
  });

  // Client subscribes to session
  let clientSyncedState: any = null;
  const unsubscribe = client.subscribeSession("sess_eco_100", (state) => {
    clientSyncedState = state;
  });

  // Client dispatches action via WebSocket
  const moveRes = await client.dispatchAction("economy", "sess_eco_100", "pay", { amount: 250 });
  assert(moveRes.success, "Client action dispatched and succeeded");
  assert(moveRes.state.balance === 750, "Server state updated balance to 750");

  // Verify client received sync update
  assert(clientSyncedState?.balance === 750, "Client received real-time WebSocket state sync");

  // Client requests overview
  const clientOverview = await client.getOverview();
  assert(clientOverview.activeSessionsCount === 1, "Client received live dashboard overview");

  // Test client audio cue listener
  let clientHeardSound = false;
  client.onAudioCue((cue) => {
    if (cue.soundKey === "coin_drop") clientHeardSound = true;
  });

  serverBridge.dispatchAudioCue({
    soundKey: "coin_drop",
    soundUrl: "/assets/sounds/coin.mp3",
    userId: "client_user_1",
    timestamp: Date.now(),
  });

  // Short delay for WS message arrival
  await new Promise((r) => setTimeout(r, 100));
  assert(clientHeardSound, "Client received targeted audio cue via WebSocket");

  unsubscribe();
  client.disconnect();
  await bridgeServer.stop();
  console.log("  ✓ Full WebSocket client-server roundtrip verified\n");

  // --------------------------------------------------------------------------
  // 8. Universal Package Mounting via bridge.use() & bridge.mount()
  // --------------------------------------------------------------------------
  console.log("8. Testing Universal Package Mounting (bridge.use fluent chaining)...");
  const testBridge = new M3rcenaBridge();

  let wekyHandshakeCalled = false;
  const mockWeky = {
    name: "weky",
    router: {
      name: "weky",
      basePath: "/api/weky",
      handleRequest: async () => ({ status: 200, body: { ok: true } }),
    },
    connectBridge: (b: any) => {
      assert(b === testBridge, "Bridge passed to package");
      wekyHandshakeCalled = true;
    },
  };

  let ecoHandshakeCalled = false;
  const mockEco = {
    name: "economy",
    toBridgeRouter: () => ({
      name: "economy",
      basePath: "/api/eco",
      handleRequest: async () => ({ status: 200, body: { balance: 999 } }),
    }),
    setBridge: (b: any) => {
      assert(b === testBridge, "Bridge passed to package");
      ecoHandshakeCalled = true;
    },
  };

  // Test fluent chaining
  testBridge.use(mockWeky).use(mockEco);

  assert(wekyHandshakeCalled, "Weky handshake completed");
  assert(ecoHandshakeCalled, "Eco handshake completed");
  assert(testBridge.getMountedRouters().some((r) => r.basePath === "/api/weky"), "Weky router mounted");
  assert(testBridge.getMountedRouters().some((r) => r.basePath === "/api/eco"), "Eco router mounted");
  console.log("  ✓ bridge.use() fluent chaining and bi-directional handshake verified\n");

  console.log("🎉 ALL @m3rcena/bridge TESTS PASSED WITH 100% SUCCESS!");
}

runTests().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});

