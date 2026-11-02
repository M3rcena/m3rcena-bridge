import assert from "node:assert";
import http from "node:http";
import { resolvePackage, getAllPackageResolutions, generateTsConfigPaths, hostBridge } from "../src/index.js";

async function runSubmoduleTests() {
  console.log("=== TESTING RUST-STYLE SUBMODULE RESOLVER & HOST ===");

  // 1. Package resolution
  const resolutions = getAllPackageResolutions();
  assert.ok(resolutions["@m3rcena/bridge"], "Bridge must be resolvable");
  assert.strictEqual(resolutions["@m3rcena/bridge"].status, "submodule", "Bridge should be detected as submodule in local repo");
  assert.strictEqual(resolutions["@m3rcena/weky"].status, "submodule", "Weky should be detected as submodule");
  assert.strictEqual(resolutions["@m3rcena/eco"].status, "submodule", "Eco should be detected as submodule");
  console.log("  ✓ Sibling submodules detected and resolved");

  // 2. TypeScript Paths Generation
  const tsPaths = generateTsConfigPaths();
  assert.ok(tsPaths["@m3rcena/bridge"], "Must generate bridge paths");
  assert.ok(tsPaths["@m3rcena/weky"], "Must generate weky paths");
  assert.ok(tsPaths["@m3rcena/eco"], "Must generate eco paths");
  console.log("  ✓ tsconfig.json compilerOptions.paths generated");

  // 3. Local Host Service Lifecycle
  const { server, port } = await hostBridge({ port: 5123, secretToken: "unit-test-token" });
  assert.strictEqual(port, 5123);

  const res = await new Promise<{ status: number; body: any }>((resolve, reject) => {
    http.get(`http://localhost:${port}/health`, (response) => {
      let data = "";
      response.on("data", (c) => (data += c));
      response.on("end", () => resolve({ status: response.statusCode ?? 0, body: JSON.parse(data) }));
    }).on("error", reject);
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.status, "ok");
  await server.stop();
  console.log("  ✓ Local host server booted, served /health, and terminated cleanly");

  console.log("🎉 ALL SUBMODULE RESOLVER TESTS PASSED!\n");
}

runSubmoduleTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
