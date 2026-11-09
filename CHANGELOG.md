# Changelog

All notable changes to the [`@m3rcena/bridge`](https://github.com/M3rcena/m3rcena-bridge) package are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [14.28.1-1] - 2026-11-09

### 🩹 Fixed
- **Fix (Storage)**: Wrap fallback raw SQL queries inside `try/catch` across `saveSession()`, `removeSession()`, and `saveData()` in `PrismaBridgeStorage` to prevent unhandled rejection crashes when executed against PostgreSQL.
- **Fix (Database)**: Correct `ensureMigrated()` logic to ensure `BridgeSession` and `BridgeKeyValue` tables are created during automated bootstrapping even when Prisma client models are pre-generated.

---

## [14.28.1] - 2026-11-05

### 🚀 Enhancements & Compatibility

#### Added
- **Discord.js v14.28.1 Compatibility**:
  - Full compatibility with Discord.js `14.28.1` and `Events.ClientReady` lifecycle.
- **Zero-Dependency Native SQLite Storage (`SqliteBridgeStorage`)**:
  - Built-in persistent storage adapter utilizing Node.js 22+ native `node:sqlite` DatabaseSync with WAL journal mode.
  - Automatic table initialization for `bridge_sessions` and `bridge_kv`.
- **Enterprise Prisma ORM Adapter (`PrismaBridgeStorage`)**:
  - Auto-migrating Prisma storage with auto-schema injection and raw SQL fallbacks for PostgreSQL, MySQL, and SQLite.
  - Migration schema helpers (`PRISMA_BRIDGE_MODEL`, `applyPrismaBridgeModel`).
- **Rust-Style Submodule Resolver & Local Hosting**:
  - Local-first Git submodule detection via `@m3rcena/bridge/resolver`.
  - Zero-config runtime interception flag via `@m3rcena/bridge/register`.
  - Standalone CLI host service via `@m3rcena/bridge/host` (`hostBridge`).
- **Terminal Update Notifier**:
  - Symmetrical terminal notification box with semver comparison.
- **WebSocket Handshake Token Authentication**:
  - Handshake query parameter authentication (`?token=...`) enabling native browser WebSockets to connect securely.
- **Safe BigInt & Circular Reference Serialization**:
  - Handled serialization of Discord snowflakes and permission bitfields across WebSocket and HTTP frames.

---

## [14.28.0] - 2026-11-01

### 🚀 Initial Production Release

#### Added
- **Core Bridge Architecture (`M3rcenaBridge`)**:
  - Unified multi-module registry (`"games"`, `"economy"`, `"moderation"`, `"custom"`).
  - Session lifecycle management (registration, real-time state mutation, conclusion).
  - Cross-platform action dispatcher with correlation tracking.
  - User presence tracker (connected, offline, active sessions).
  - Targeted audio cue & toast notification router with active presence filtering.
  - Real-time dashboard overview generator and telemetry.
- **WebSocket Gateway Server (`BridgeServer`)**:
  - Bi-directional WebSocket server with room broadcasting (`session:${id}`, `module:${name}`).
  - Works standalone or attaches directly to existing HTTP servers (Express, Fastify, Next.js).
  - Built-in REST endpoints (`/health`, `/overview`, `/sessions`, `/action`).
  - Secret token authorization.
- **Universal Client SDK (`BridgeClient` & `@m3rcena/bridge/client`)**:
  - Works across browsers (React, Next.js, Vue) and Node.js environments.
  - Auto-reconnect with exponential backoff.
  - Session subscriptions, action dispatching, and audio/notification listeners.
- **Pluggable Storage Adapters**:
  - High-speed `MemoryStorageAdapter` (default).
  - Persistent `JsonFileStorageAdapter`.
- **Targeting & Parity**:
  - Targeted for Node.js 22, 24, and 26 LTS.
  - TypeScript 7.0 with dual ESM/CJS compilation via `tsdown` (Rolldown).

