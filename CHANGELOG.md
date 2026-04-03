# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
- CI pipeline with GitHub Actions (Node 18/20/22 matrix)
- Automated npm publishing workflow on tag push
- Dependency review workflow for PRs
- ESLint v9 + Prettier for code quality
- CONTRIBUTING.md and docs/RULES.md for contributors
