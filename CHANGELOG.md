# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.3] - 2026-04-03

### Added

- Modern terminal UI with arrow-key interactive selects for rule and path selection
- Truecolor support with graceful fallback to 256/16/no color
- Text badges (PASS/FAIL/WARN/INFO) replacing emoji markers
- Gradient banner coloring
- `info()` and `success()` UI helpers for better scan feedback
- "Entire home directory" scan option
- Directory hints in path selection menu
- Per-project version caching to avoid redundant file reads
- Pre-compiled regex cache for lockfile scanning
- Unit tests for all check modules (files, network, processes, cache) — 52 total tests
- `escapeRegex()` shared utility
- `discoverProjects()` helper to deduplicate project search pattern

### Fixed

- Banner version now reads from package.json dynamically (was hardcoded)
- Base64 encode IOC strings in rule files to prevent macOS XProtect false positives
- Use Node 24 in publish workflow (npm 11.x with native OIDC support)
- **Security:** Replace substring matching with regex word-boundary matching for IPs, domains, processes, and lockfile package names — eliminates false positives
- **Security:** Shell injection prevention — use `runSafe()` (execFileSync) in processes.ts and cache.ts
- **Security:** Windows hosts file path (`C:\Windows\System32\drivers\etc\hosts`) instead of hardcoded `/etc/hosts`
- Multi-rule IOC attribution — `ruleByIOC` map now tracks all matching rules instead of overwriting
- `passed` count in summary now correctly counts only pass-type results
- Unhandled promise rejection at CLI entry — added `.catch()` handler
- `progressBar` division by zero guard
- `interactiveMultiSelect` cursor off-by-one bug
- `interactiveMultiSelect` resolve logic — empty selection returns all (was broken ternary)
- Cursor hide/show inconsistency — consistent `isTTY` guard via shared helpers

### Changed

- Split `utils.ts` into focused modules: `args.ts`, `rules.ts`, `shell.ts`, `prompt.ts`
- Simplified section headers (divider-style instead of boxed)
- Removed broken `drawBox` — summary uses clean line-based layout
- `SKIP_DIRS` changed from Array to Set for O(1) lookup
- `buildSummary` single-pass counting instead of 4 separate `.filter()` calls
- Lockfile discovery uses `readdirSync` once per project instead of try/catch per file
- Removed dead code: `ScanContext`, `getHomeDir()`, `severityColors` export
- Removed unused re-exports from `utils.ts`
- `run()` returns exit code instead of calling `process.exit()` directly — testable as library

## [1.0.2] - 2026-04-03

### Fixed

- Updated README with correct architecture, Node >=20 requirement, and package manager support table
- Fixed Node version references in CONTRIBUTING.md and CHANGELOG.md (18 → 20)
- OIDC Trusted Publisher for npm (no token secrets needed)
- Dropped Node 18 from CI matrix (Vitest v4 requires Node 20+)
- Linked LICENSE file in README

## [1.0.0] - 2026-04-03

### Added

- Initial release of supply-scan CLI
- 12 attack rules covering known npm supply chain attacks (2018-2026):
  - Axios 2026 (plain-crypto-js RAT)
  - Chalk/Debug 2025 (crypto wallet stealer)
  - Shai-Hulud 2.0 2025 (self-replicating worm)
  - GlassWorm 2026 (Solana C2 + invisible Unicode)
  - ua-parser-js 2021 (cryptominer + password stealer)
  - event-stream 2018 (Bitcoin wallet stealer)
  - eslint-scope 2018 (npm token stealer)
  - coa/rc 2021 (Danabot password stealer)
  - colors/faker 2022 (sabotage DoS)
  - node-ipc 2022 (geotargeted file wiper)
  - @solana/web3.js 2024 (private key stealer)
  - @lottiefiles/lottie-player 2024 (wallet drainer)
- 5 check categories: compromised packages, malware files, network connections, suspicious processes, package manager caches
- Interactive CLI with rule selection menu
- Non-interactive CI mode (`--ci`)
- Selective rule scanning (`--rule <id>`)
- Custom path scanning (`--path <dir>`)
- Support for npm, pnpm, yarn (v1 & v2+), and bun lockfiles and caches
- JSON rule-driven architecture for easy extensibility
- Zero runtime dependencies
- Unit tests with Vitest (41 tests)
- CI pipeline with GitHub Actions (Node 20/22/24 matrix)
- Automated npm publishing workflow on tag push
- Dependency review workflow for PRs
- ESLint v9 + Prettier for code quality
- CONTRIBUTING.md and docs/RULES.md for contributors
