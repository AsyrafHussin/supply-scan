# Writing Attack Rules

This guide explains how to create a new attack rule for supply-scan. Each known npm supply chain attack is defined as a JSON file in the `rules/` directory. The scanner engine reads all rule files automatically — **no code changes needed**.

## Quick Start

1. Create `rules/my-attack-2026.json`
2. Fill in the schema (see below)
3. Test: `node dist/index.js --rule my-attack-2026 --path .`
4. Submit a PR

## Rule Schema

```json
{
  "id": "my-attack-2026",
  "name": "My Attack Name",
  "date": "2026-01-15",
  "severity": "critical",
  "description": "Brief description of the attack",
  "references": [
    "https://example.com/advisory"
  ],
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
      "darwin": ["/path/on/macos"],
      "linux": ["/path/on/linux"],
      "win32": ["%TEMP%\\path\\on\\windows"]
    },
    "domains": ["c2-server.com"],
    "ips": ["1.2.3.4"],
    "ports": [8080],
    "processes": ["malware-process-name"],
    "strings": ["suspicious-string-in-code"]
  }
}
```

## Field Reference

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier. Convention: `name-year` (e.g., `axios-2026`) |
| `name` | string | Human-readable name shown in scanner output |
| `date` | string | Date of attack discovery (YYYY-MM-DD) |
| `severity` | string | One of: `critical`, `high`, `medium`, `low` |
| `description` | string | Brief description (1-2 sentences) |
| `references` | string[] | URLs to advisories, blog posts, CVEs |
| `packages` | object | Package detection rules (see below) |

### packages.compromised

Legitimate packages that had malicious versions published. The scanner checks if any of these exact versions are installed in `node_modules` or referenced in lockfiles.

```json
"compromised": {
  "axios": ["1.14.1", "0.30.4"],
  "@solana/web3.js": ["1.95.6", "1.95.7"]
}
```

**Key:** npm package name (supports scoped packages)
**Value:** Array of compromised version strings

### packages.malicious

Packages that are entirely malicious and should never exist in any project. The scanner checks if these package directories exist in `node_modules`.

```json
"malicious": {
  "plain-crypto-js": ["4.2.0", "4.2.1"],
  "flatmap-stream": ["0.1.1"]
}
```

If the attack doesn't involve a separate malicious package, use an empty object: `"malicious": {}`

### ioc (Indicators of Compromise)

All IOC fields are **optional**. Include only what's relevant to the attack.

#### ioc.files

OS-specific file paths where malware drops artifacts.

```json
"files": {
  "darwin": ["/Library/Caches/com.apple.act.mond", "/tmp/6202033"],
  "linux": ["/tmp/ld.py"],
  "win32": ["%PROGRAMDATA%\\wt.exe", "%TEMP%\\sdd.dll"]
}
```

**Supported OS keys:** `darwin` (macOS), `linux`, `win32` (Windows)

**Path variables expanded automatically:**
| Variable | Expands to |
|----------|-----------|
| `~` | User's home directory |
| `%PROGRAMDATA%` | `C:\ProgramData` (or `$PROGRAMDATA` env) |
| `%TEMP%` | System temp directory |
| `%USERPROFILE%` | User's home directory (Windows) |

#### ioc.domains

C2 (Command & Control) server domains.

```json
"domains": ["sfrclak.com", "callnrwise.com"]
```

The scanner checks active network connections and `/etc/hosts` for these domains.

#### ioc.ips

C2 server IP addresses.

```json
"ips": ["142.11.206.73", "159.148.186.228"]
```

Checked against active network connections.

#### ioc.ports

Network ports used by the malware.

```json
"ports": [8000, 443]
```

Currently stored for reference. Future versions may use these for targeted connection checks.

#### ioc.processes

Process names to look for in the running process list.

```json
"processes": ["com.apple.act.mond", "jsextension", "wt.exe"]
```

The scanner runs `ps aux` (Unix) or `tasklist` (Windows) and searches for these strings.

#### ioc.strings

Suspicious strings that may appear in source code, configs, or LaunchAgents.

```json
"strings": ["OrDeR_7077", "6202033", "pastorcryptograph.at"]
```

Used to scan macOS LaunchAgents/LaunchDaemons for persistence mechanisms.

## Severity Guidelines

| Severity | When to use |
|----------|-------------|
| `critical` | RAT, worm, data stealer, file wiper, credential theft |
| `high` | Targeted theft (wallet stealer, token stealer), significant impact |
| `medium` | DoS/sabotage, protest-ware, limited impact |
| `low` | Typosquatting with minimal payload, quickly removed |

## Example: Creating a Rule from an Advisory

Say a new advisory reports that `my-lib@3.5.0` was compromised and drops a file at `/tmp/.hidden-miner`:

```json
{
  "id": "my-lib-2026",
  "name": "my-lib Cryptominer Injection",
  "date": "2026-06-15",
  "severity": "high",
  "description": "my-lib v3.5.0 compromised via maintainer account takeover, deploys cryptominer",
  "references": [
    "https://github.com/advisories/GHSA-xxxx-xxxx-xxxx"
  ],
  "packages": {
    "compromised": {
      "my-lib": ["3.5.0"]
    },
    "malicious": {}
  },
  "ioc": {
    "files": {
      "linux": ["/tmp/.hidden-miner"],
      "darwin": ["/tmp/.hidden-miner"]
    },
    "processes": [".hidden-miner"]
  }
}
```

## Testing Your Rule

```bash
# Build first
npm run build

# Test with your specific rule
node dist/index.js --rule my-lib-2026 --path ~/projects

# Verify it shows up in the rule list
node dist/index.js --list
```

## Lockfile Detection Patterns

The scanner automatically checks these lockfile formats:

| Format | File | Pattern matched |
|--------|------|----------------|
| npm | `package-lock.json` | `"pkg": "version"` |
| yarn | `yarn.lock` | `pkg@version` |
| pnpm | `pnpm-lock.yaml` | `pkg@version` |
| bun | `bun.lock` | `"pkg": "version"` |
| bun (binary) | `bun.lockb` | Binary substring match |

## Cache Detection

The scanner checks caches for all supported package managers:

- **npm:** `~/.npm`
- **pnpm:** pnpm store (`pnpm store path`)
- **yarn v1:** yarn cache dir (`yarn cache dir`)
- **yarn v2+:** `.yarn/cache`
- **bun:** `~/.bun/install/cache`
