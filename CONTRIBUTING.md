# Contributing to supply-scan

Thank you for your interest in contributing to supply-scan! This guide will help you get started.

## Getting Started

### Prerequisites

- Node.js >= 20
- npm

### Setup

```bash
git clone https://github.com/AsyrafHussin/supply-scan.git
cd supply-scan
npm install
npm run build
npm test
```

### Development Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Build with tsup |
| `npm run dev` | Run the CLI locally |
| `npm test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage |
| `npm run typecheck` | TypeScript type checking |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |

## How to Contribute

### Adding a New Attack Rule

This is the most common and valuable contribution. **No code changes needed** — just add a JSON file.

1. Create a new file in `rules/` named `<attack-id>.json`
2. Follow the schema documented in [docs/RULES.md](docs/RULES.md)
3. Test locally: `node dist/index.js --rule <your-rule-id> --path .`
4. Submit a PR with a link to the attack advisory

See [docs/RULES.md](docs/RULES.md) for the complete rule schema and examples.

### Fixing Bugs or Adding Features

1. Fork the repository
2. Create a feature branch: `git checkout -b my-feature`
3. Make your changes
4. Add/update tests if applicable
5. Ensure all checks pass:
   ```bash
   npm run typecheck
   npm test
   npm run lint
   npm run build
   ```
6. Commit with a clear message
7. Push and open a Pull Request

### Writing Tests

- Tests live in `__tests__/` using Vitest
- Use `__tests__/fixtures/` for test data
- For filesystem-dependent tests, create temp dirs with `mkdtempSync` and clean up in `afterEach`
- Run `npm run test:coverage` to check coverage

## Pull Request Guidelines

- Keep PRs focused on a single change
- Include a description of what changed and why
- Link to related issues if applicable
- Ensure CI passes (tests, typecheck, lint, build)
- For new rules, include a reference link to the attack advisory

## Project Architecture

```
supply-scan/
├── src/
│   ├── index.ts        # CLI entry + interactive prompts
│   ├── scanner.ts      # Orchestrates all checks
│   ├── ui.ts           # Terminal UI (zero deps, ANSI codes)
│   ├── utils.ts        # Utilities (path, JSON, args, etc.)
│   ├── types.ts        # TypeScript interfaces
│   └── checks/
│       ├── packages.ts # node_modules + lockfile scanner
│       ├── files.ts    # Malware file detector
│       ├── network.ts  # C2 connection checker
│       ├── processes.ts# Process scanner
│       └── cache.ts    # Package manager cache scanner
├── rules/              # JSON attack definitions
├── __tests__/          # Unit tests (Vitest)
└── dist/               # Compiled output (tsup)
```

**Key design principle:** Zero runtime dependencies. All terminal UI uses raw ANSI escape codes. This is a security scanner — we avoid depending on packages that could themselves be compromised.

## Code of Conduct

Be respectful. We're all here to make the npm ecosystem safer.
