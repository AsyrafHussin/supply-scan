import { type ResultType, type CheckResult, type ScanSummary, type Rule } from './types.js';

// ─── Terminal Detection ─────────────────────────────────────────────

const isTTY = !!process.stdout.isTTY;
const noColor = !!process.env.NO_COLOR || process.env.TERM === 'dumb';
const hasTruecolor = isTTY && !noColor && (
  process.env.COLORTERM === 'truecolor' ||
  process.env.COLORTERM === '24bit' ||
  !!process.env.WT_SESSION ||
  process.env.TERM_PROGRAM === 'vscode' ||
  process.env.TERM_PROGRAM === 'iTerm.app'
);
const hasColor = isTTY && !noColor;

const ESC = '\x1b';

// ─── Color Helpers ──────────────────────────────────────────────────

function fg(r: number, g: number, b: number): string {
  if (hasTruecolor) return `${ESC}[38;2;${r};${g};${b}m`;
  if (hasColor) return `${ESC}[36m`;
  return '';
}

function bg(r: number, g: number, b: number): string {
  if (hasTruecolor) return `${ESC}[48;2;${r};${g};${b}m`;
  if (hasColor) return `${ESC}[44m`;
  return '';
}

export const c = {
  red: hasColor ? `${ESC}[1;31m` : '',
  green: hasColor ? `${ESC}[1;32m` : '',
  yellow: hasColor ? `${ESC}[1;33m` : '',
  cyan: hasColor ? `${ESC}[1;36m` : '',
  white: hasColor ? `${ESC}[1;37m` : '',
  dim: hasColor ? `${ESC}[2m` : '',
  bold: hasColor ? `${ESC}[1m` : '',
  reset: hasColor ? `${ESC}[0m` : '',
  bgRed: hasColor ? `${ESC}[41m` : '',
  bgGreen: hasColor ? `${ESC}[42m` : '',
  bgYellow: hasColor ? `${ESC}[43m` : '',
  bgBlue: hasColor ? `${ESC}[44m` : '',
  reverse: hasColor ? `${ESC}[7m` : '',
};

// ─── ANSI Helpers ───────────────────────────────────────────────────

function termW(): number {
  return process.stdout.columns || 80;
}

const W = () => Math.min(termW(), 70);

function line(char = '─'): string {
  return `${c.dim}${char.repeat(W())}${c.reset}`;
}

// ─── Severity ───────────────────────────────────────────────────────

function severityBadge(sev: string): string {
  const label = sev.toUpperCase();
  if (!hasColor) return `[${label}]`;
  const colors: Record<string, [number, number, number]> = {
    critical: [220, 38, 38],
    high: [234, 179, 8],
    medium: [59, 130, 246],
    low: [107, 114, 128],
  };
  const col = colors[sev] || [107, 114, 128];
  return `${bg(col[0], col[1], col[2])}${c.white} ${label} ${c.reset}`;
}

// ─── Result Badge ───────────────────────────────────────────────────

function badge(type: ResultType): string {
  if (!hasColor) return `[${type.toUpperCase()}]`;
  const badges: Record<ResultType, string> = {
    pass: `${bg(34, 197, 94)}${c.white} PASS ${c.reset}`,
    fail: `${bg(239, 68, 68)}${c.white} FAIL ${c.reset}`,
    warn: `${bg(234, 179, 8)}${ESC}[30m WARN ${c.reset}`,
    info: `${bg(107, 114, 128)}${c.white} INFO ${c.reset}`,
  };
  return badges[type];
}

// ─── Banner ─────────────────────────────────────────────────────────

export function banner(ruleCount: number, version = '0.0.0'): void {
  const art = [
    '  ┌─┐┬ ┬┌─┐┌─┐┬  ┬ ┬  ┌─┐┌─┐┌─┐┌┐┌',
    '  └─┐│ │├─┘├─┘│  └┬┘  └─┐│  ├─┤│││',
    '  └─┘└─┘┴  ┴  ┴─┘ ┴   └─┘└─┘┴ ┴┘└┘',
  ];

  const vBadge = `${bg(59, 130, 246)}${c.white} v${version} ${c.reset}`;

  console.log('');
  for (let i = 0; i < art.length; i++) {
    const t = art.length > 1 ? i / (art.length - 1) : 0;
    const r = Math.round(0 + 120 * t);
    const g = Math.round(200 - 120 * t);
    const b = Math.round(255);
    console.log(`${fg(r, g, b)}${art[i]}${c.reset}`);
  }
  console.log('');
  console.log(`  ${c.white}Universal npm Supply Chain Attack Scanner${c.reset}  ${vBadge}`);
  console.log(`  ${c.dim}Detects ${ruleCount} known attacks · Zero dependencies${c.reset}`);
  console.log('');
  console.log(line());
}

// ─── Divider ────────────────────────────────────────────────────────

export function divider(): void {
  console.log(line());
}

// ─── Section Header ─────────────────────────────────────────────────

export function sectionHeader(num: number, total: number, title: string, icon: string): void {
  const w = W();
  const step = `${bg(59, 130, 246)}${c.white} ${num}/${total} ${c.reset}`;
  const text = ` ${icon}  ${step} ${c.white}${c.bold}${title}${c.reset} `;
  const textLen = 4 + 4 + title.length + 4; // approximate
  const fill = Math.max(w - textLen - 2, 0);
  console.log('');
  console.log(`${c.dim}──${c.reset}${text}${c.dim}${'─'.repeat(fill)}${c.reset}`);
}

// ─── Result Formatters ──────────────────────────────────────────────

export function result(type: ResultType, msg: string): void {
  const color = type === 'fail' ? c.red : type === 'warn' ? c.yellow : type === 'pass' ? c.green : c.dim;
  console.log(`   ${badge(type)} ${color}${msg}${c.reset}`);
}

export function resultDetail(msg: string): void {
  console.log(`          ${c.dim}↳${c.reset} ${c.red}${msg}${c.reset}`);
}

// ─── Terminal Helpers ────────────────────────────────────────────────

function hideCursor(): void {
  if (isTTY) process.stdout.write(`${ESC}[?25l`);
}

function showCursor(): void {
  if (isTTY) process.stdout.write(`${ESC}[?25h`);
}

function teardownStdin(listener: (data: Buffer) => void): void {
  if (process.stdin.isTTY) process.stdin.setRawMode(false);
  process.stdin.pause();
  process.stdin.removeListener('data', listener);
  showCursor();
}

// ─── Spinner ────────────────────────────────────────────────────────

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

// Pre-compute spinner colors (10 frames)
const SPIN_COLORS = FRAMES.map((_, i) => {
  const r = Math.round(80 + 40 * Math.sin(i * 0.6));
  const g = Math.round(180 + 20 * Math.cos(i * 0.6));
  return fg(r, g, 255);
});

let spinTimer: ReturnType<typeof setInterval> | null = null;
let spinIdx = 0;

export function spinnerStart(msg: string): void {
  spinIdx = 0;
  hideCursor();
  spinTimer = setInterval(() => {
    const i = spinIdx % FRAMES.length;
    process.stdout.write(`\r${ESC}[2K   ${SPIN_COLORS[i]}${FRAMES[i]}${c.reset} ${c.dim}${msg}${c.reset}`);
    spinIdx++;
  }, 80);
}

export function spinnerStop(): void {
  if (spinTimer) {
    clearInterval(spinTimer);
    spinTimer = null;
    process.stdout.write(`\r${ESC}[2K`);
    showCursor();
  }
}

// ─── Progress Bar ───────────────────────────────────────────────────

export function progressBar(current: number, total: number, label: string): void {
  const barW = 20;
  const ratio = total > 0 ? current / total : 0;
  const pct = Math.round(ratio * 100);
  const filled = Math.round(ratio * barW);
  const name = label.length > 20 ? label.slice(0, 17) + '...' : label;
  const bar = `${c.green}${'█'.repeat(filled)}${c.reset}${c.dim}${'░'.repeat(barW - filled)}${c.reset}`;
  process.stdout.write(`\r${ESC}[2K   ${bar} ${c.white}${String(pct).padStart(3)}%${c.reset} ${c.dim}${name}${c.reset}`);
}

export function progressClear(): void {
  process.stdout.write(`\r${ESC}[2K`);
}

// ─── Info Line ──────────────────────────────────────────────────────

export function info(msg: string): void {
  console.log(`   ${c.dim}${msg}${c.reset}`);
}

export function success(msg: string): void {
  console.log(`   ${c.green}✓${c.reset} ${msg}`);
}

// ─── Rule List ──────────────────────────────────────────────────────

export function printRuleList(rules: Rule[]): void {
  console.log('');
  console.log(`  ${c.white}${c.bold}Available rules (${rules.length}):${c.reset}`);
  console.log('');

  for (const rule of rules) {
    const pkgCount = Object.keys(rule.packages.compromised).length + Object.keys(rule.packages.malicious).length;
    console.log(`   ${severityBadge(rule.severity)} ${c.white}${rule.id}${c.reset} ${c.dim}· ${rule.date} · ${pkgCount} pkgs${c.reset}`);
    console.log(`      ${c.dim}${rule.description}${c.reset}`);
  }
  console.log('');
}

// ─── Summary ────────────────────────────────────────────────────────

export function printSummary(summary: ScanSummary): void {

  console.log('');
  console.log(line('═'));
  console.log('');

  // Stats
  console.log(`   ${c.dim}Projects scanned${c.reset}  ${c.white}${c.bold}${summary.projectsScanned}${c.reset}`);
  console.log(`   ${c.dim}Rules checked${c.reset}     ${c.white}${c.bold}${summary.rulesChecked}${c.reset}`);
  console.log('');
  console.log(`   ${badge('pass')} ${c.green}${summary.passed}${c.reset}    ${badge('warn')} ${c.yellow}${summary.warnings}${c.reset}    ${badge('fail')} ${c.red}${summary.failed}${c.reset}`);
  console.log('');

  if (summary.failed > 0) {
    console.log(`   ${bg(220, 38, 38)}${c.white}${c.bold} ⛔ COMPROMISE DETECTED ⛔ ${c.reset}`);
    console.log('');
    console.log(`   ${c.red}${c.bold}Immediate Actions:${c.reset}`);
    console.log(`   ${c.red}1.${c.reset} Disconnect from the network`);
    console.log(`   ${c.red}2.${c.reset} Rotate ALL credentials, tokens, API keys`);
    console.log(`   ${c.red}3.${c.reset} ${c.white}npm install <pkg>@latest${c.reset} for compromised packages`);
    console.log(`   ${c.red}4.${c.reset} ${c.white}npm cache clean --force${c.reset}`);
    console.log(`   ${c.red}5.${c.reset} Review system for backdoors and persistence`);

    if (summary.compromisedProjects.length > 0) {
      console.log('');
      console.log(`   ${c.red}${c.bold}Compromised:${c.reset}`);
      for (const p of summary.compromisedProjects) {
        console.log(`   ${c.red}  → ${p}${c.reset}`);
      }
    }

    const byRule = new Map<string, CheckResult[]>();
    for (const r of summary.results.filter((r) => r.type === 'fail')) {
      const arr = byRule.get(r.rule) || [];
      arr.push(r);
      byRule.set(r.rule, arr);
    }
    for (const [rule, results] of byRule) {
      console.log('');
      console.log(`   ${c.red}${c.bold}${rule}:${c.reset}`);
      for (const r of results) {
        console.log(`     ${c.red}→ ${r.message}${c.reset}`);
        if (r.details) console.log(`       ${c.dim}${r.details}${c.reset}`);
      }
    }
  } else if (summary.warnings > 0) {
    console.log(`   ${bg(234, 179, 8)}${ESC}[30m${c.bold} ⚠ WARNINGS — REVIEW RECOMMENDED ⚠ ${c.reset}`);
    console.log('');
    console.log(`   ${c.yellow}Some items need manual review.${c.reset}`);
  } else {
    console.log(`   ${bg(34, 197, 94)}${c.white}${c.bold} ✓ ALL CLEAR ${c.reset}`);
    console.log('');
    console.log(`   ${c.green}No supply chain compromises detected.${c.reset}`);
    console.log('');
    console.log(`   ${c.dim}Tips:${c.reset}`);
    console.log(`   ${c.cyan}›${c.reset} Use lockfiles and verify integrity`);
    console.log(`   ${c.cyan}›${c.reset} Pin dependencies to exact versions`);
    console.log(`   ${c.cyan}›${c.reset} Enable npm audit in CI/CD`);
    console.log(`   ${c.cyan}›${c.reset} Monitor SLSA provenance on critical packages`);
  }

  console.log('');
  console.log(line('═'));
  console.log(`   ${c.dim}${new Date().toISOString()}${c.reset}`);
  console.log(`   ${c.dim}https://github.com/AsyrafHussin/supply-scan${c.reset}`);
  console.log('');
}

// ─── Interactive Select ─────────────────────────────────────────────

interface SelectItem<T> {
  label: string;
  value: T;
  hint?: string;
}

export async function interactiveMultiSelect<T>(opts: {
  message: string;
  items: SelectItem<T>[];
  allOption?: { label: string };
}): Promise<T[]> {
  if (!process.stdin.isTTY) return opts.items.map((i) => i.value);

  const items = opts.items;
  const hasAll = !!opts.allOption;
  const totalRows = hasAll ? items.length + 1 : items.length;
  let cursor = 0;
  const selected = new Set<number>();
  let allSelected = true;

  const headerLines = 3; // message + hint + blank
  const totalLines = headerLines + totalRows;

  function render(initial = false): void {
    if (!initial) process.stdout.write(`${ESC}[${totalLines}A`);

    process.stdout.write(`${ESC}[2K\n`);
    process.stdout.write(`${ESC}[2K  ${c.white}${c.bold}${opts.message}${c.reset}\n`);
    process.stdout.write(`${ESC}[2K  ${c.dim}↑↓ navigate · space toggle · enter confirm${c.reset}\n`);

    if (hasAll) {
      const active = cursor === 0;
      const icon = allSelected ? `${c.green}◉${c.reset}` : `${c.dim}○${c.reset}`;
      const ptr = active ? `${c.cyan}❯${c.reset}` : ' ';
      const lbl = active ? `${c.green}${c.bold}${opts.allOption!.label}${c.reset}` : `${c.dim}${opts.allOption!.label}${c.reset}`;
      process.stdout.write(`${ESC}[2K  ${ptr} ${icon} ${lbl}\n`);
    }

    for (let i = 0; i < items.length; i++) {
      const idx = hasAll ? i + 1 : i;
      const active = cursor === idx;
      const sel = allSelected || selected.has(i);
      const icon = sel ? `${c.green}◉${c.reset}` : `${c.dim}○${c.reset}`;
      const ptr = active ? `${c.cyan}❯${c.reset}` : ' ';
      const hint = items[i].hint ? `  ${c.dim}${items[i].hint}${c.reset}` : '';
      const lbl = active ? `${c.white}${items[i].label}${c.reset}` : `${c.dim}${items[i].label}${c.reset}`;
      process.stdout.write(`${ESC}[2K  ${ptr} ${icon} ${lbl}${hint}\n`);
    }
  }

  return new Promise<T[]>((resolve) => {
    hideCursor();
    render(true);
    process.stdin.setRawMode(true);
    process.stdin.resume();

    // hasAll: indices 0 (all) + 1..N (items) → max = items.length
    // no all: indices 0..N-1 → max = items.length - 1
    const maxCursor = hasAll ? items.length : items.length - 1;

    const onData = (data: Buffer) => {
      const key = data.toString();
      if (key === '\x1b[A') { cursor = cursor <= 0 ? maxCursor : cursor - 1; render(); }
      else if (key === '\x1b[B') { cursor = cursor >= maxCursor ? 0 : cursor + 1; render(); }
      else if (key === ' ') {
        if (hasAll && cursor === 0) { allSelected = !allSelected; selected.clear(); }
        else {
          const ii = hasAll ? cursor - 1 : cursor;
          allSelected = false;
          if (selected.has(ii)) selected.delete(ii); else selected.add(ii);
          if (selected.size === items.length) { allSelected = true; selected.clear(); }
        }
        render();
      }
      else if (key === '\r') {
        teardownStdin(onData);
        if (allSelected || selected.size === 0) {
          resolve(items.map((i) => i.value));
        } else {
          resolve([...selected].map((i) => items[i].value));
        }
      }
      else if (key === '\x03') { teardownStdin(onData); process.exit(130); }
    };

    process.stdin.on('data', onData);
  });
}

export async function interactiveSingleSelect<T>(opts: {
  message: string;
  items: SelectItem<T>[];
}): Promise<T> {
  if (!process.stdin.isTTY) return opts.items[0].value;

  const items = opts.items;
  let cursor = 0;
  const headerLines = 3;
  const totalLines = headerLines + items.length;

  function render(initial = false): void {
    if (!initial) process.stdout.write(`${ESC}[${totalLines}A`);

    process.stdout.write(`${ESC}[2K\n`);
    process.stdout.write(`${ESC}[2K  ${c.white}${c.bold}${opts.message}${c.reset}\n`);
    process.stdout.write(`${ESC}[2K  ${c.dim}↑↓ navigate · enter select${c.reset}\n`);

    for (let i = 0; i < items.length; i++) {
      const active = cursor === i;
      const ptr = active ? `${c.cyan}❯${c.reset}` : ' ';
      const hint = items[i].hint ? `  ${c.dim}${items[i].hint}${c.reset}` : '';
      const lbl = active ? `${c.white}${c.bold}${items[i].label}${c.reset}` : `${c.dim}${items[i].label}${c.reset}`;
      process.stdout.write(`${ESC}[2K  ${ptr}  ${lbl}${hint}\n`);
    }
  }

  return new Promise<T>((resolve) => {
    hideCursor();
    render(true);
    process.stdin.setRawMode(true);
    process.stdin.resume();

    const onData = (data: Buffer) => {
      const key = data.toString();
      if (key === '\x1b[A') { cursor = cursor <= 0 ? items.length - 1 : cursor - 1; render(); }
      else if (key === '\x1b[B') { cursor = cursor >= items.length - 1 ? 0 : cursor + 1; render(); }
      else if (key === '\r') { teardownStdin(onData); resolve(items[cursor].value); }
      else if (key === '\x03') { teardownStdin(onData); process.exit(130); }
    };

    process.stdin.on('data', onData);
  });
}
