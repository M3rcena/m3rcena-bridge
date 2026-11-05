/**
 * @m3rcena/bridge - Rust-Style Submodule & Path Resolver
 *
 * Inspired by Cargo's workspace and [patch.crates-io] resolver algorithm.
 * Enables zero-friction consumption of @m3rcena packages via Git submodules,
 * local vendor paths, or standard NPM registry installs without code changes.
 *
 * @copyright 2026 M3rcena Development. All rights reserved.
 * @license Apache-2.0
 */
export type M3rcenaPackageName = "@m3rcena/weky" | "@m3rcena/eco" | "@m3rcena/bridge";
export interface PackageResolution {
  name: M3rcenaPackageName;
  status: "submodule" | "npm" | "missing";
  type: "source" | "dist" | "registry";
  path: string;
  rootDirectory?: string;
  version?: string;
  isBuilt?: boolean;
}
export interface ResolverOptions {
  /** Base directory to start searching from (defaults to process.cwd()) */
  cwd?: string;
  /** Explicit directory where submodules are placed (e.g. './submodules', './vendor') */
  submodulesDir?: string;
  /** Prefer TypeScript source ('src/index.ts') over compiled dist */
  preferSource?: boolean;
  /** Custom overrides for package paths */
  overrides?: Partial<Record<M3rcenaPackageName, string>>;
  /** Silent mode: suppress console notices */
  silent?: boolean;
}
export interface M3rcenaResolverConfig {
  submodulesDir?: string;
  preferSource?: boolean;
  packages?: Partial<Record<M3rcenaPackageName, string>>;
}
/**
 * Checks whether the current Node runtime is executing in a TypeScript environment
 * (e.g. tsx, ts-node, bun, vitest, or esm loader).
 */
export declare function isTypeScriptRuntime(): boolean;
/**
 * Searches upwards from startDir to locate the project root containing package.json.
 */
export declare function findProjectRoot(startDir?: string): string;
/**
 * Loads optional m3rcena.resolver.json or package.json "m3rcena" configuration.
 */
export declare function loadResolverConfig(cwd?: string): M3rcenaResolverConfig | null;
/**
 * Resolves a single @m3rcena package using the Rust-inspired resolution strategy:
 * 1. Explicit option overrides
 * 2. Environment variable overrides (e.g. M3RCENA_WEKY_PATH)
 * 3. Configuration file (m3rcena.resolver.json)
 * 4. Local filesystem submodule candidate paths
 * 5. NPM registry / node_modules fallback
 */
export declare function resolvePackage(packageName: M3rcenaPackageName, options?: ResolverOptions): PackageResolution;
/**
 * Returns a resolution report for all 3 @m3rcena packages.
 */
export declare function getAllPackageResolutions(options?: ResolverOptions): Record<M3rcenaPackageName, PackageResolution>;
/**
 * Generates tsconfig.json compilerOptions.paths mappings for submodules.
 */
export declare function generateTsConfigPaths(options?: ResolverOptions): Record<string, string[]>;
/**
 * Prints a styled Rust-Cargo status box displaying local vs npm package resolutions.
 */
export declare function printResolutionSummary(options?: ResolverOptions): void;
//# sourceMappingURL=resolver.d.cts.map