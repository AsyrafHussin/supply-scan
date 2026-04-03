import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { Rule } from './types.js';
import { parseArgs } from './args.js';
import { loadRules } from './rules.js';
import { readJSON, findProjects, getCommonProjectDirs } from './utils.js';
import { prompt } from './prompt.js';
import * as ui from './ui.js';
import { scan } from './scanner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const RULES_DIR = join(__dirname, '..', 'rules');
const PKG_JSON_PATH = join(__dirname, '..', 'package.json');

const VERSION = readJSON<{ version: string }>(PKG_JSON_PATH)?.version ?? '0.0.0';

const HELP_TEXT = `
${ui.c.white}supply-scan${ui.c.reset} — Universal npm supply chain attack scanner

${ui.c.yellow}USAGE${ui.c.reset}
  npx supply-scan                     Interactive mode (default)
  npx supply-scan --all               Scan all attacks, skip prompts
  npx supply-scan --rule axios-2026   Scan specific attack(s)
  npx supply-scan --list              List all available rules
  npx supply-scan --ci                CI mode (non-interactive)

${ui.c.yellow}OPTIONS${ui.c.reset}
  -a, --all              Scan all attacks (skip rule selection)
  -r, --rule <id>        Scan specific rule (repeatable)
  -p, --path <dir>       Scan specific directory
  -l, --list             List all available rules
  --ci                   CI mode (non-interactive, exit codes only)
  -h, --help             Show this help
  -v, --version          Show version

${ui.c.yellow}EXIT CODES${ui.c.reset}
  0  All clear
  1  Compromise detected
  2  Warnings found

${ui.c.yellow}EXAMPLES${ui.c.reset}
  npx supply-scan --path ~/projects/my-app
  npx supply-scan --rule axios-2026 --rule node-ipc-2022
  npx supply-scan --ci --all
`;

export async function run(argv: string[]): Promise<number> {
  const opts = parseArgs(argv);

  // Handle --version
  if (opts.version) {
    console.log(VERSION);
    return 0;
  }

  // Handle --help
  if (opts.help) {
    console.log(HELP_TEXT);
    return 0;
  }

  // Load rules
  const allRules = loadRules(RULES_DIR);

  if (allRules.length === 0) {
    console.error(`${ui.c.red}No rules found in ${RULES_DIR}${ui.c.reset}`);
    return 1;
  }

  // Handle --list
  if (opts.list) {
    ui.banner(allRules.length, VERSION);
    ui.printRuleList(allRules);
    return 0;
  }

  // Filter rules if --rule specified
  let selectedRules: Rule[];
  if (opts.rules.length > 0) {
    selectedRules = allRules.filter((r) => opts.rules.includes(r.id));
    if (selectedRules.length === 0) {
      console.error(`${ui.c.red}No matching rules found. Use --list to see available rules.${ui.c.reset}`);
      return 1;
    }
  } else if (opts.all || opts.ci) {
    selectedRules = allRules;
  } else {
    // Interactive: show banner and rule selection
    ui.banner(allRules.length, VERSION);
    selectedRules = await interactiveRuleSelection(allRules);
  }

  if (!opts.ci && (opts.all || opts.rules.length > 0)) {
    ui.banner(selectedRules.length, VERSION);
  }

  // Determine scan directories
  let projectDirs: string[];

  if (opts.path) {
    projectDirs = discoverProjects([opts.path], opts.ci);
  } else if (opts.ci || opts.all) {
    projectDirs = discoverProjects([process.cwd()], opts.ci);
  } else {
    projectDirs = await interactivePathSelection();
  }

  if (!opts.ci) {
    console.log('');
    ui.info(`Scanning ${projectDirs.length} projects with ${selectedRules.length} rules...`);
  }

  // Run scan
  const summary = await scan({
    rules: selectedRules,
    projectDirs,
    ci: opts.ci,
  });

  // Print summary
  if (!opts.ci) {
    ui.printSummary(summary);
  }

  // Exit code
  if (summary.failed > 0) {
    return 1;
  } else if (summary.warnings > 0) {
    return 2;
  } else {
    if (opts.ci) {
      console.log('OK');
    }
    return 0;
  }
}

function discoverProjects(dirs: string[], ci: boolean): string[] {
  if (!ci) ui.spinnerStart('Searching for npm projects...');
  const projects = findProjects(dirs);
  if (!ci) {
    ui.spinnerStop();
    ui.success(`Found ${projects.length} projects`);
  }
  return projects;
}

// ─── Interactive Prompts ────────────────────────────────────────────

async function interactiveRuleSelection(rules: Rule[]): Promise<Rule[]> {
  console.log('');
  const selected = await ui.interactiveMultiSelect({
    message: 'Select attacks to scan:',
    items: rules.map((r) => ({
      label: r.name,
      value: r,
      hint: `${r.severity}  ${r.date}`,
    })),
    allOption: { label: `All attacks (${rules.length} rules)` },
  });
  return selected.length > 0 ? selected : rules;
}

async function interactivePathSelection(): Promise<string[]> {
  const choice = await ui.interactiveSingleSelect({
    message: 'Where should I scan?',
    items: [
      { label: 'Current directory', value: 'cwd' as const, hint: process.cwd() },
      { label: 'Common project directories', value: 'common' as const, hint: 'Desktop, Projects, dev...' },
      { label: 'Entire home directory', value: 'home' as const, hint: '(slower)' },
      { label: 'Enter a custom path', value: 'custom' as const },
    ],
  });

  let baseDirs: string[];
  switch (choice) {
    case 'common':
      baseDirs = getCommonProjectDirs();
      if (baseDirs.length === 0) {
        ui.info('No common directories found, scanning current directory...');
        baseDirs = [process.cwd()];
      } else {
        ui.info(`Scanning ${baseDirs.length} directories:`);
        for (const d of baseDirs.slice(0, 5)) {
          console.log(`     ${ui.c.dim}${d}${ui.c.reset}`);
        }
        if (baseDirs.length > 5) console.log(`     ${ui.c.dim}...and ${baseDirs.length - 5} more${ui.c.reset}`);
      }
      break;
    case 'home':
      baseDirs = [process.env.HOME || '/'];
      ui.info(`Scanning home directory (this may take a while)...`);
      break;
    case 'custom': {
      const customPath = await prompt(`\n   ${ui.c.cyan}Enter path:${ui.c.reset} `);
      baseDirs = [customPath.replace(/^~/, process.env.HOME || '')];
      break;
    }
    default:
      baseDirs = [process.cwd()];
  }

  console.log('');
  ui.spinnerStart('Searching for npm projects...');
  const projects = findProjects(baseDirs);
  ui.spinnerStop();
  ui.success(`Found ${projects.length} npm projects`);

  return projects;
}

// ─── Auto-run when executed as CLI ──────────────────────────────────

// CLI entry — only runs when executed directly (not imported as library)
const isCLI =
  process.argv[1]?.endsWith('supply-scan') ||
  process.argv[1]?.endsWith('dist/index.js') ||
  process.argv[1]?.includes('/supply-scan/');

if (isCLI) {
  run(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error(`${ui.c.red}Error: ${err instanceof Error ? err.message : err}${ui.c.reset}`);
      process.exit(1);
    });
}
