import { type ResultType, type CheckResult, type ScanSummary, type Rule } from './types.js';

// ─── ANSI Color Codes (zero deps) ──────────────────────────────────

const ESC = '\x1b';

export const c = {
  red: `${ESC}[1;31m`,
  green: `${ESC}[1;32m`,
  yellow: `${ESC}[1;33m`,
  cyan: `${ESC}[1;36m`,
  white: `${ESC}[1;37m`,
  dim: `${ESC}[2m`,
  bold: `${ESC}[1m`,
  reset: `${ESC}[0m`,
  bgRed: `${ESC}[41m`,
  bgGreen: `${ESC}[42m`,
  bgYellow: `${ESC}[43m`,
  bgBlue: `${ESC}[44m`,
};

// ─── Symbols ────────────────────────────────────────────────────────

const sym = {
  pass: '\u2705',
  fail: '\uD83D\uDEA8',
  warn: '\u26A0\uFE0F ',
  info: '\uD83D\uDCA1',
  scan: '\uD83D\uDD0D',
  shield: '\uD83D\uDEE1\uFE0F ',
  skull: '\uD83D\uDC80',
  clean: '\u2728',
  gear: '\u2699\uFE0F ',
  pkg: '\uD83D\uDCE6',
  lock: '\uD83D\uDD12',
  globe: '\uD83C\uDF10',
  folder: '\uD83D\uDCC1',
};

// ─── Banner ─────────────────────────────────────────────────────────

export function banner(ruleCount: number, version = '0.0.0'): void {
  const w = process.stdout.write.bind(process.stdout);
  w('\n');
  w(`${c.cyan}   ___ _   _ ___ ___ _   _   _    ___  ___   _   _  _ ${c.reset}\n`);
  w(`${c.cyan}  / __| | | | _ \\ _ \\ | | | | |  / __|/ __| /_\\ | \\| |${c.reset}\n`);
  w(`${c.cyan}  \\__ \\ |_| |  _/  _/ |_| |_| |_| (__| (__ / _ \\| .\` |${c.reset}\n`);
  w(`${c.cyan}  |___/\\___/|_| |_|  \\__, |_____|\\___|\\___|_/ \\_\\_|\\_|${c.reset}\n`);
  w(`${c.cyan}                      |___/        ${c.dim}v${version}${c.reset}\n`);
  w('\n');
  w(`  ${c.white}Universal npm Supply Chain Attack Scanner${c.reset}\n`);
  w(`  ${c.dim}Detects ${ruleCount} known attacks | Zero dependencies${c.reset}\n`);
  w('\n');
  divider();
}

// ─── Divider ────────────────────────────────────────────────────────

export function divider(): void {
  console.log(`${c.dim}${'─'.repeat(60)}${c.reset}`);
}

// ─── Section Header ─────────────────────────────────────────────────

export function sectionHeader(num: number, total: number, title: string, icon: string): void {
  console.log('');
  console.log(`${c.bgBlue}${c.white}${c.bold}  ${icon}  CHECK ${num}/${total}  │  ${title}  ${c.reset}`);
  divider();
}

// ─── Result Formatters ──────────────────────────────────────────────

export function result(type: ResultType, msg: string): void {
  const icons: Record<ResultType, string> = {
    pass: sym.pass,
    fail: sym.fail,
    warn: sym.warn,
    info: sym.info,
  };
  const colors: Record<ResultType, string> = {
    pass: c.green,
    fail: `${c.red}${c.bold}`,
    warn: c.yellow,
    info: c.dim,
  };
  console.log(`   ${icons[type]} ${colors[type]}${msg}${c.reset}`);
}

export function resultDetail(msg: string): void {
  console.log(`      ${c.red}→ ${msg}${c.reset}`);
}

// ─── Spinner ────────────────────────────────────────────────────────

const SPIN_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

let spinnerTimer: ReturnType<typeof setInterval> | null = null;
let spinnerFrame = 0;

export function spinnerStart(msg: string): void {
  spinnerFrame = 0;
  spinnerTimer = setInterval(() => {
    const frame = SPIN_FRAMES[spinnerFrame % SPIN_FRAMES.length];
    process.stdout.write(`\r   ${c.cyan}${frame}${c.reset} ${c.dim}${msg}${c.reset}`);
    spinnerFrame++;
  }, 80);
}

export function spinnerStop(): void {
  if (spinnerTimer) {
    clearInterval(spinnerTimer);
    spinnerTimer = null;
    process.stdout.write('\r\x1b[K');
  }
}

// ─── Progress Bar ───────────────────────────────────────────────────

export function progressBar(current: number, total: number, label: string): void {
  const width = 30;
  const pct = Math.round((current / total) * 100);
  const filled = Math.round((current / total) * width);
  const empty = width - filled;
  const bar = `${c.green}${'█'.repeat(filled)}${c.reset}${c.dim}${'░'.repeat(empty)}${c.reset}`;
  const name = label.length > 25 ? label.slice(0, 22) + '...' : label;
  process.stdout.write(`\r   ${c.dim}[${c.reset}${bar}${c.dim}]${c.reset} ${c.white}${pct}%${c.reset} ${c.dim}${name.padEnd(25)}${c.reset}`);
}

export function progressClear(): void {
  process.stdout.write('\r\x1b[K');
}

// ─── Rule List ──────────────────────────────────────────────────────

export const severityColors: Record<string, string> = {
  critical: c.red,
  high: c.yellow,
  medium: c.cyan,
  low: c.dim,
};

export function printRuleList(rules: Rule[]): void {
  console.log('');
  console.log(`  ${c.white}Available attack rules (${rules.length}):${c.reset}`);
  console.log('');

  for (const rule of rules) {
    const sc = severityColors[rule.severity] || c.dim;
    const pkgCount =
      Object.keys(rule.packages.compromised).length +
      Object.keys(rule.packages.malicious).length;
    console.log(
      `   ${c.dim}•${c.reset} ${c.white}${rule.id.padEnd(25)}${c.reset} ${sc}${rule.severity.padEnd(10)}${c.reset} ${c.dim}${rule.date}${c.reset}  ${c.dim}(${pkgCount} pkgs)${c.reset}`
    );
    console.log(`     ${c.dim}${rule.description}${c.reset}`);
  }
  console.log('');
}

// ─── Summary ────────────────────────────────────────────────────────

export function printSummary(summary: ScanSummary): void {
  console.log('');
  console.log(`${c.cyan}${'═'.repeat(60)}${c.reset}`);
  console.log(`  ${sym.shield} ${c.white}${c.bold}SCAN COMPLETE${c.reset}`);
  console.log(`${c.cyan}${'═'.repeat(60)}${c.reset}`);
  console.log('');
  console.log(`   ${c.dim}Projects scanned:${c.reset}  ${c.white}${summary.projectsScanned}${c.reset}`);
  console.log(`   ${c.dim}Rules checked:${c.reset}     ${c.white}${summary.rulesChecked}${c.reset}`);
  console.log(`   ${c.dim}Total checks:${c.reset}      ${c.white}${summary.totalChecks}${c.reset}`);
  console.log(`   ${c.green}Passed:${c.reset}            ${c.green}${summary.passed}${c.reset}`);
  console.log(`   ${c.yellow}Warnings:${c.reset}          ${c.yellow}${summary.warnings}${c.reset}`);
  console.log(`   ${c.red}Failed:${c.reset}            ${c.red}${summary.failed}${c.reset}`);
  console.log('');
  divider();

  if (summary.failed > 0) {
    console.log('');
    console.log(`   ${c.bgRed}${c.white}${c.bold}  ⛔  COMPROMISE DETECTED  ⛔  ${c.reset}`);
    console.log('');
    console.log(`   ${c.red}${c.bold}Immediate Actions Required:${c.reset}`);
    console.log('');
    console.log(`   ${c.red}1.${c.reset} Disconnect from the network`);
    console.log(`   ${c.red}2.${c.reset} Rotate ALL credentials, tokens, API keys, SSH keys`);
    console.log(`   ${c.red}3.${c.reset} Remove compromised packages: ${c.white}npm install <pkg>@latest${c.reset}`);
    console.log(`   ${c.red}4.${c.reset} Clean npm cache: ${c.white}npm cache clean --force${c.reset}`);
    console.log(`   ${c.red}5.${c.reset} Review system for backdoors and persistence mechanisms`);
    console.log(`   ${c.red}6.${c.reset} Consider full system wipe if RAT/worm was executed`);
    console.log('');

    if (summary.compromisedProjects.length > 0) {
      console.log(`   ${c.red}${c.bold}Compromised Projects:${c.reset}`);
      for (const proj of summary.compromisedProjects) {
        console.log(`      ${c.red}${sym.skull} ${proj}${c.reset}`);
      }
      console.log('');
    }

    // Show failed results grouped by rule
    const failedByRule = new Map<string, CheckResult[]>();
    for (const r of summary.results.filter((r) => r.type === 'fail')) {
      const arr = failedByRule.get(r.rule) || [];
      arr.push(r);
      failedByRule.set(r.rule, arr);
    }
    for (const [rule, results] of failedByRule) {
      console.log(`   ${c.red}${c.bold}${rule}:${c.reset}`);
      for (const r of results) {
        console.log(`      ${c.red}→ ${r.message}${c.reset}`);
        if (r.details) console.log(`        ${c.dim}${r.details}${c.reset}`);
      }
      console.log('');
    }
  } else if (summary.warnings > 0) {
    console.log('');
    console.log(`   ${c.bgYellow}${c.white}${c.bold}  ⚠  WARNINGS FOUND — REVIEW RECOMMENDED  ⚠  ${c.reset}`);
    console.log('');
    console.log(`   ${c.yellow}Some items need manual review. Check the warnings above.${c.reset}`);
    console.log('');
  } else {
    console.log('');
    console.log(`   ${c.bgGreen}${c.white}${c.bold}  ${sym.clean} ALL CLEAR — NO COMPROMISE DETECTED ${sym.clean}  ${c.reset}`);
    console.log('');
    console.log(`   ${c.green}Your system appears clean from all known supply chain attacks.${c.reset}`);
    console.log('');
    console.log(`   ${c.dim}Prevention tips:${c.reset}`);
    console.log(`   ${c.cyan}›${c.reset} Use lockfiles and verify package integrity`);
    console.log(`   ${c.cyan}›${c.reset} Pin dependencies to exact versions`);
    console.log(`   ${c.cyan}›${c.reset} Enable npm audit in your CI/CD pipeline`);
    console.log(`   ${c.cyan}›${c.reset} Monitor for SLSA provenance on critical packages`);
    console.log('');
  }

  divider();
  console.log('');
  console.log(`   ${c.dim}Scan completed at ${new Date().toISOString()}${c.reset}`);
  console.log(`   ${c.dim}https://github.com/AsyrafHussin/supply-scan${c.reset}`);
  console.log('');
}
