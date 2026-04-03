# supply-scan

Universal npm supply chain attack scanner. Detects compromised packages from **12 known attacks** spanning 2018-2026. Zero runtime dependencies.

[![Version](https://img.shields.io/npm/v/supply-scan.svg)](https://npmjs.org/package/supply-scan)
[![Downloads/week](https://img.shields.io/npm/dw/supply-scan.svg)](https://npmjs.org/package/supply-scan)
[![NPM total downloads](https://img.shields.io/npm/dt/supply-scan.svg?style=flat)](https://www.npmjs.com/package/supply-scan)
[![License](https://img.shields.io/npm/l/supply-scan.svg)](https://github.com/AsyrafHussin/supply-scan/blob/main/LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)
[![GitHub Workflow Status](https://github.com/AsyrafHussin/supply-scan/actions/workflows/ci.yml/badge.svg)](https://github.com/AsyrafHussin/supply-scan/actions)

```bash
npx supply-scan
```

> Requires Node.js >= 20

## Features

- **Interactive CLI** — Arrow-key rule selection and path picker
- **12 attack rules** — Axios, Chalk/Debug, Shai-Hulud, GlassWorm, and more
- **5 check categories** — Packages, malware files, network, processes, caches
- **All package managers** — npm, pnpm, yarn (v1 & v2+), bun
- **CI mode** — Non-interactive with exit codes for pipelines
- **Zero runtime deps** — Security scanner that doesn't depend on potentially compromised packages
- **Extensible** — Add new attacks by dropping a JSON file in `rules/`

## What It Detects

| Attack | Date | Severity | Type |
|--------|------|----------|------|
| **Axios** (plain-crypto-js) | 2026-03 | Critical | RAT (North Korea) |
| **GlassWorm** (invisible Unicode) | 2026-03 | Critical | Stealer via Solana C2 |
| **Shai-Hulud 2.0** (npm worm) | 2025-11 | Critical | Self-replicating worm |
| **Chalk/Debug** (18 packages) | 2025-09 | Critical | Crypto wallet stealer |
| **@solana/web3.js** | 2024-12 | Critical | Private key stealer |
| **Lottie Player** | 2024-10 | High | Wallet drainer |
| **node-ipc** (peacenotwar) | 2022-03 | Critical | Geotargeted file wiper |
| **colors/faker** | 2022-01 | Medium | Sabotage / infinite loop |
| **coa/rc** (Danabot) | 2021-11 | Critical | Password stealer |
| **ua-parser-js** | 2021-10 | Critical | Cryptominer + stealer |
| **event-stream** (flatmap-stream) | 2018-11 | High | Bitcoin wallet stealer |
| **eslint-scope** | 2018-07 | High | npm token stealer |

## 5 Check Categories

1. **Compromised Packages** — Scans `node_modules` and lockfiles for known bad versions
2. **Malware Files** — Checks for RAT payloads, droppers, and artifacts on disk
3. **Network Connections** — Detects active connections to C2 servers (regex word-boundary matching)
4. **Suspicious Processes** — Identifies running malware and persistence mechanisms
5. **Package Manager Caches** — Scans npm, pnpm, yarn, and bun caches for malicious packages

## Supported Package Managers

| Manager | Lockfile | Cache |
|---------|----------|-------|
| npm | `package-lock.json` | `~/.npm` |
| pnpm | `pnpm-lock.yaml` | pnpm store |
| yarn v1 | `yarn.lock` | yarn cache dir |
| yarn v2+ | `yarn.lock` | `.yarn/cache` |
| bun | `bun.lock` / `bun.lockb` | `~/.bun/install/cache` |

## Usage

### Interactive Mode (default)

```bash
npx supply-scan
```

Uses arrow keys to select which attacks to scan and which directories to scan.

### Scan All Attacks

```bash
npx supply-scan --all
```

### Scan Specific Attacks

```bash
npx supply-scan --rule axios-2026
npx supply-scan --rule axios-2026 --rule chalk-debug-2025
```

### Scan Specific Directory

```bash
npx supply-scan --path ~/projects/my-app
```

### CI Mode

```bash
npx supply-scan --ci
```

Non-interactive, outputs "OK" on clean scan. Exit codes:
- `0` — All clear
- `1` — Compromise detected
- `2` — Warnings found

### List Available Rules

```bash
npx supply-scan --list
```

## Adding New Rules

Each attack is defined as a JSON file in the `rules/` directory. To add a new attack, create a new `.json` file:

```json
{
  "id": "my-attack-2026",
  "name": "My Attack Name",
  "date": "2026-01-01",
  "severity": "critical",
  "description": "Description of the attack",
  "references": ["https://example.com/advisory"],
  "packages": {
    "compromised": {
      "package-name": ["1.0.0", "1.0.1"]
    },
    "malicious": {
      "evil-package": ["0.1.0"]
    }
  },
  "ioc": {
    "files": {
      "darwin": ["/path/to/malware"],
      "linux": ["/tmp/malware"],
      "win32": ["%TEMP%\\malware.exe"]
    },
    "domains": ["evil-c2.com"],
    "ips": ["1.2.3.4"],
    "ports": [8080],
    "processes": ["malware-process"],
    "strings": ["suspicious-string"]
  }
}
```

No code changes needed — the scanner automatically picks up new rule files. See [docs/RULES.md](docs/RULES.md) for the complete schema reference.

## Architecture

```
supply-scan/
├── src/
│   ├── index.ts             # CLI entry + interactive prompts
│   ├── scanner.ts           # Scan engine orchestrator
│   ├── ui.ts                # Terminal UI (zero deps, ANSI + truecolor)
│   ├── args.ts              # CLI argument parser
│   ├── rules.ts             # Rule loader + base64 decoder
│   ├── shell.ts             # Safe shell command execution
│   ├── prompt.ts            # Readline prompt helper
│   ├── utils.ts             # Path/fs utilities
│   ├── types.ts             # TypeScript interfaces
│   └── checks/
│       ├── packages.ts      # Package + lockfile scanner
│       ├── files.ts         # Malware file detector
│       ├── network.ts       # C2 connection checker
│       ├── processes.ts     # Process + persistence scanner
│       └── cache.ts         # Package manager cache scanner
├── rules/                   # Attack definitions (JSON, base64-encoded IOCs)
├── __tests__/               # Unit tests (Vitest, 52 tests)
├── scripts/                 # Rule encoding utility
├── docs/                    # Rule writing guide
├── .github/workflows/       # CI (Node 20/22/24) + npm publish + dependency review
└── dist/                    # Compiled output (tsup, single file)
```

**Zero runtime dependencies.** This is a security scanner — we don't depend on packages that could themselves be compromised. All terminal UI uses raw ANSI escape codes with truecolor support and graceful fallback.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, how to add new attack rules, and PR guidelines.

## License

[MIT](LICENSE)
