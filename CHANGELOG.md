# Changelog

All notable changes to the [`@m3rcena/bridge`](https://github.com/M3rcena/m3rcena-bridge) package are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-11-01

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
