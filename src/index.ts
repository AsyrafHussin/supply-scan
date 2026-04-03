import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { Rule } from './types.js';
import {
  parseArgs,
  loadRules,
  readJSON,
  findProjects,
  getCommonProjectDirs,
  prompt,
} from './utils.js';
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

export async function run(argv: string[]): Promise<void> {
  const opts = parseArgs(argv);

  // Handle --version
  if (opts.version) {
    console.log(VERSION);
    process.exit(0);
  }

  // Handle --help
  if (opts.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  // Load rules
  const allRules = loadRules(RULES_DIR);

  if (allRules.length === 0) {
    console.error(`${ui.c.red}No rules found in ${RULES_DIR}${ui.c.reset}`);
    process.exit(1);
  }

  // Handle --list
  if (opts.list) {
    ui.banner(allRules.length, VERSION);
    ui.printRuleList(allRules);
    process.exit(0);
  }

  // Filter rules if --rule specified
  let selectedRules: Rule[];
  if (opts.rules.length > 0) {
    selectedRules = allRules.filter((r) => opts.rules.includes(r.id));
    if (selectedRules.length === 0) {
      console.error(`${ui.c.red}No matching rules found. Use --list to see available rules.${ui.c.reset}`);
      process.exit(1);
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
    if (!opts.ci) ui.spinnerStart('Searching for npm projects...');
    projectDirs = findProjects([opts.path]);
    if (!opts.ci) ui.spinnerStop();
  } else if (opts.ci || opts.all) {
    // Default to current directory in non-interactive modes
    if (!opts.ci) ui.spinnerStart('Searching for npm projects...');
    projectDirs = findProjects([process.cwd()]);
    if (!opts.ci) ui.spinnerStop();
  } else {
    projectDirs = await interactivePathSelection();
  }

  if (!opts.ci) {
    console.log(`\n   ${ui.c.dim}Scanning ${projectDirs.length} projects with ${selectedRules.length} rules...${ui.c.reset}`);
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
    process.exit(1);
  } else if (summary.warnings > 0) {
    process.exit(2);
  } else {
    if (opts.ci) {
      console.log('OK');
    }
    process.exit(0);
  }
}

// ─── Interactive Prompts ────────────────────────────────────────────

async function interactiveRuleSelection(rules: Rule[]): Promise<Rule[]> {
  console.log('');
  console.log(`   ${ui.c.white}Select attacks to scan:${ui.c.reset}`);
  console.log('');
  console.log(`   ${ui.c.cyan}0${ui.c.reset}) ${ui.c.green}All attacks (${rules.length} rules)${ui.c.reset}`);

  for (let i = 0; i < rules.length; i++) {
    const r = rules[i];
    const sc = ui.severityColors[r.severity] || ui.c.dim;
    console.log(`   ${ui.c.cyan}${i + 1}${ui.c.reset}) ${r.name} ${sc}(${r.severity})${ui.c.reset}`);
  }

  console.log('');
  const answer = await prompt(`   ${ui.c.yellow}Enter numbers separated by commas (default=0): ${ui.c.reset}`);

  if (!answer || answer === '0') {
    return rules;
  }

  const indices = answer.split(',').map((s) => parseInt(s.trim(), 10) - 1);
  const selected = indices
    .filter((i) => i >= 0 && i < rules.length)
    .map((i) => rules[i]);

  return selected.length > 0 ? selected : rules;
}

async function interactivePathSelection(): Promise<string[]> {
  console.log('');
  console.log(`   ${ui.c.white}Where should I scan?${ui.c.reset}`);
  console.log('');
  console.log(`   ${ui.c.cyan}1${ui.c.reset}) Current directory`);
  console.log(`   ${ui.c.cyan}2${ui.c.reset}) Common project directories`);
  console.log(`   ${ui.c.cyan}3${ui.c.reset}) Enter a custom path`);
  console.log('');

  const choice = await prompt(`   ${ui.c.yellow}Choose (1/2/3, default=1): ${ui.c.reset}`);

  let baseDirs: string[];
  switch (choice) {
    case '2':
      baseDirs = getCommonProjectDirs();
      if (baseDirs.length === 0) {
        console.log(`   ${ui.c.dim}No common directories found, scanning current directory...${ui.c.reset}`);
        baseDirs = [process.cwd()];
      }
      break;
    case '3': {
      const customPath = await prompt(`   ${ui.c.cyan}Enter path: ${ui.c.reset}`);
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

  console.log(`   ${ui.c.dim}Found ${projects.length} npm projects${ui.c.reset}`);

  return projects;
}

// ─── Auto-run when executed as CLI ──────────────────────────────────

const isCLI =
  process.argv[1]?.includes('supply-scan') ||
  process.argv[1]?.includes('dist/index');

if (isCLI) {
  run(process.argv.slice(2));
}
