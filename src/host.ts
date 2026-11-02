/**
 * @m3rcena/bridge - Standalone Local Submodule Host Service
 *
 * Runs the Bridge WebSocket & REST API gateway locally when cloned via Git submodules.
 * Automatically discovers sibling @m3rcena/weky and @m3rcena/eco submodules and mounts them.
 *
 * @copyright 2026 M3rcena Development. All rights reserved.
 * @license Apache-2.0
 */

import http from "node:http";
import { M3rcenaBridge } from "./M3rcenaBridge.js";
import { BridgeServer } from "./server/BridgeServer.js";
import { getAllPackageResolutions, printResolutionSummary } from "./resolver.js";

export interface HostBridgeOptions {
  port?: number;
  secretToken?: string;
  autoMountSubmodules?: boolean;
}

export async function hostBridge(options: HostBridgeOptions = {}): Promise<{
  bridge: M3rcenaBridge;
  server: BridgeServer;
  port: number;
}> {
  const port = options.port ?? parseInt(process.env.PORT || process.env.BRIDGE_PORT || "4000", 10);
  const secretToken = options.secretToken ?? (process.env.BRIDGE_SECRET || "m3rcena-local-token");

  printResolutionSummary();

  const bridge = new M3rcenaBridge({
    notifyUpdates: true,
  });

  // Auto-mount discovered local submodules
  if (options.autoMountSubmodules !== false) {
    const resolutions = getAllPackageResolutions();

    // Try mounting Eco if discovered
    if (resolutions["@m3rcena/eco"].status === "submodule") {
      try {
        const ecoModule = await import(resolutions["@m3rcena/eco"].path);
        if (ecoModule.EcoManager && ecoModule.EcoBridgeRouter) {
          const eco = new ecoModule.EcoManager();
          bridge.mountPackage(new ecoModule.EcoBridgeRouter(eco));
          console.log(`[m3rcena-bridge] 💰 Auto-mounted local submodule: @m3rcena/eco`);
        }
      } catch (err: any) {
        console.warn(`[m3rcena-bridge] Could not auto-mount @m3rcena/eco:`, err.message);
      }
    }

    // Try mounting Weky if discovered
    if (resolutions["@m3rcena/weky"].status === "submodule") {
      try {
        const wekyModule = await import(resolutions["@m3rcena/weky"].path);
        if (wekyModule.WekyBridge) {
          const wb = new wekyModule.WekyBridge();
          bridge.mountPackage(wb.router);
          console.log(`[m3rcena-bridge] 🕹️ Auto-mounted local submodule: @m3rcena/weky`);
        }
      } catch (err: any) {
        console.warn(`[m3rcena-bridge] Could not auto-mount @m3rcena/weky:`, err.message);
      }
    }
  }

  const server = new BridgeServer(bridge, {
    port,
    secretToken,
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

  return { bridge, server, port };
}

// Direct execution via CLI: node/tsx host.ts
if (process.argv[1]?.endsWith("host.ts") || process.argv[1]?.endsWith("host.js")) {
  hostBridge().catch((err) => {
    console.error("[m3rcena-bridge host] Fatal error:", err);
    process.exit(1);
  });
}
