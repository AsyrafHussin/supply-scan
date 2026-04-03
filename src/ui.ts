import { type ResultType, type CheckResult, type ScanSummary, type Rule } from './types.js';

// ─── Color Level Detection ──────────────────────────────────────────

function colorLevel(): 0 | 1 | 2 | 3 {
  if (process.env.NO_COLOR || process.env.TERM === 'dumb') return 0;
  if (!process.stdout.isTTY) return 0;
  if (process.env.COLORTERM === 'truecolor' || process.env.COLORTERM === '24bit') return 3;
  const term = process.env.TERM || '';
  if (term.includes('256color')) return 2;
  return 1;
}

const level = colorLevel();

// ─── Color Primitives ───────────────────────────────────────────────

const ESC = '\x1b';

function rgb(r: number, g: number, b: number): string {
  if (level >= 3) return `${ESC}[38;2;${r};${g};${b}m`;
  if (level >= 1) return `${ESC}[36m`; // fallback cyan
  return '';
}

function bgRgb(r: number, g: number, b: number): string {
  if (level >= 3) return `${ESC}[48;2;${r};${g};${b}m`;
  if (level >= 1) return `${ESC}[44m`; // fallback blue bg
  return '';
}

export const c = {
  red: level >= 1 ? `${ESC}[1;31m` : '',
  green: level >= 1 ? `${ESC}[1;32m` : '',
  yellow: level >= 1 ? `${ESC}[1;33m` : '',
  cyan: level >= 1 ? `${ESC}[1;36m` : '',
  white: level >= 1 ? `${ESC}[1;37m` : '',
  dim: level >= 1 ? `${ESC}[2m` : '',
  bold: level >= 1 ? `${ESC}[1m` : '',
  reset: level >= 1 ? `${ESC}[0m` : '',
  bgRed: level >= 1 ? `${ESC}[41m` : '',
  bgGreen: level >= 1 ? `${ESC}[42m` : '',
  bgYellow: level >= 1 ? `${ESC}[43m` : '',
  bgBlue: level >= 1 ? `${ESC}[44m` : '',
  reverse: level >= 1 ? `${ESC}[7m` : '',
};

// ─── Helpers ────────────────────────────────────────────────────────

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

function visLen(str: string): number {
  return stripAnsi(str).length;
}

function termWidth(): number {
  return process.stdout.columns || 80;
}

function gradientLine(text: string, from: [number, number, number], to: [number, number, number], lineIdx: number, totalLines: number): string {
  if (level < 3) return `${c.cyan}${text}${c.reset}`;
  const t = totalLines > 1 ? lineIdx / (totalLines - 1) : 0;
  const r = Math.round(from[0] + (to[0] - from[0]) * t);
  const g = Math.round(from[1] + (to[1] - from[1]) * t);
  const b = Math.round(from[2] + (to[2] - from[2]) * t);
  return `${rgb(r, g, b)}${text}${c.reset}`;
}

// ─── Severity ───────────────────────────────────────────────────────

export const severityColors: Record<string, string> = {
  critical: c.red,
  high: c.yellow,
  medium: c.cyan,
  low: c.dim,
};

function severityBadge(sev: string): string {
  const label = ` ${sev.toUpperCase()} `;
  if (level < 1) return label;
  const badges: Record<string, string> = {
    critical: `${bgRgb(220, 38, 38)}${c.white}${label}${c.reset}`,
    high: `${bgRgb(234, 179, 8)}${ESC}[30m${label}${c.reset}`,
    medium: `${bgRgb(59, 130, 246)}${c.white}${label}${c.reset}`,
    low: `${c.dim}${label}${c.reset}`,
  };
  return badges[sev] || `${c.dim}${label}${c.reset}`;
}

// ─── Box Drawing ────────────────────────────────────────────────────

const bx = { tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│', lt: '├', rt: '┤' };

interface BoxOpts {
  width?: number;
  padding?: number;
  borderColor?: string;
  title?: string;
}

function drawBox(lines: string[], opts: BoxOpts = {}): string {
  const pad = opts.padding ?? 1;
  const bc = opts.borderColor ?? c.dim;
  const maxContent = Math.max(...lines.map(visLen), 0);
  const innerW = Math.min(opts.width ? opts.width - 2 : maxContent + pad * 2, termWidth() - 2);
  const w = innerW + 2;

  const out: string[] = [];

  // Top border with optional title
  if (opts.title) {
    const t = ` ${opts.title} `;
    const tLen = visLen(t);
    const remaining = Math.max(w - 2 - tLen - 1, 0);
    out.push(`${bc}${bx.tl}${bx.h}${c.reset}${c.white}${t}${c.reset}${bc}${bx.h.repeat(remaining)}${bx.tr}${c.reset}`);
  } else {
    out.push(`${bc}${bx.tl}${bx.h.repeat(w - 2)}${bx.tr}${c.reset}`);
  }

  // Content lines
  for (const line of lines) {
    const vl = visLen(line);
    const padRight = Math.max(innerW - pad - vl, 0);
    out.push(`${bc}${bx.v}${c.reset}${' '.repeat(pad)}${line}${' '.repeat(padRight)}${bc}${bx.v}${c.reset}`);
  }

  // Bottom border
  out.push(`${bc}${bx.bl}${bx.h.repeat(w - 2)}${bx.br}${c.reset}`);

  return out.join('\n');
}

// ─── Result Badges ──────────────────────────────────────────────────

function badge(type: ResultType): string {
  if (level < 1) {
    const labels: Record<ResultType, string> = { pass: '[PASS]', fail: '[FAIL]', warn: '[WARN]', info: '[INFO]' };
    return labels[type];
  }
  const badges: Record<ResultType, string> = {
    pass: `${bgRgb(34, 197, 94)}${c.white} PASS ${c.reset}`,
    fail: `${bgRgb(239, 68, 68)}${c.white} FAIL ${c.reset}`,
    warn: `${bgRgb(234, 179, 8)}${ESC}[30m WARN ${c.reset}`,
    info: `${bgRgb(107, 114, 128)}${c.white} INFO ${c.reset}`,
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

  const versionBadge = `${bgRgb(59, 130, 246)}${c.white} v${version} ${c.reset}`;

  console.log('');
  for (let i = 0; i < art.length; i++) {
    console.log(gradientLine(art[i], [0, 200, 255], [120, 80, 255], i, art.length));
  }
  console.log('');
  console.log(`  ${c.white}Universal npm Supply Chain Attack Scanner${c.reset}  ${versionBadge}`);
  console.log(`  ${c.dim}Detects ${ruleCount} known attacks ${bx.v} Zero dependencies${c.reset}`);
  console.log('');
  divider();
}

// ─── Divider ────────────────────────────────────────────────────────

export function divider(): void {
  const w = Math.min(termWidth(), 70);
  console.log(`${c.dim}${bx.h.repeat(w)}${c.reset}`);
}

// ─── Section Header ─────────────────────────────────────────────────

export function sectionHeader(num: number, total: number, title: string, icon: string): void {
  const w = Math.min(termWidth(), 70);
  const stepBadge = `${bgRgb(59, 130, 246)}${c.white} ${num}/${total} ${c.reset}`;
  const header = `${icon}  ${stepBadge} ${c.white}${title}${c.reset}`;
  const hLen = 6 + 5 + title.length + 2; // approximate visible length
  const fill = Math.max(w - hLen - 4, 0);
  console.log('');
  console.log(`${c.dim}${bx.tl}${bx.h}${c.reset} ${header} ${c.dim}${bx.h.repeat(fill)}${bx.tr}${c.reset}`);
}

// ─── Result Formatters ──────────────────────────────────────────────

export function result(type: ResultType, msg: string): void {
  console.log(`   ${badge(type)} ${type === 'fail' ? c.red : type === 'warn' ? c.yellow : type === 'pass' ? c.green : c.dim}${msg}${c.reset}`);
}

export function resultDetail(msg: string): void {
  console.log(`   ${c.dim}${bx.v}${c.reset}  ${c.red}→ ${msg}${c.reset}`);
}

// ─── Spinner ────────────────────────────────────────────────────────

const SPIN_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const SPIN_COLORS: [number, number, number][] = [
  [0, 200, 255], [30, 180, 255], [60, 160, 255], [90, 140, 255], [120, 120, 255],
  [90, 140, 255], [60, 160, 255], [30, 180, 255], [0, 200, 255], [0, 220, 240],
];

let spinnerTimer: ReturnType<typeof setInterval> | null = null;
let spinnerFrame = 0;

export function spinnerStart(msg: string): void {
  spinnerFrame = 0;
  process.stdout.write(`${ESC}[?25l`); // hide cursor
  spinnerTimer = setInterval(() => {
    const frame = SPIN_FRAMES[spinnerFrame % SPIN_FRAMES.length];
    const col = SPIN_COLORS[spinnerFrame % SPIN_COLORS.length];
    process.stdout.write(`\r${ESC}[2K   ${rgb(col[0], col[1], col[2])}${frame}${c.reset} ${c.dim}${msg}${c.reset}`);
    spinnerFrame++;
  }, 80);
}

export function spinnerStop(): void {
  if (spinnerTimer) {
    clearInterval(spinnerTimer);
    spinnerTimer = null;
    process.stdout.write(`\r${ESC}[2K${ESC}[?25h`); // clear + show cursor
  }
}

// ─── Progress Bar ───────────────────────────────────────────────────

export function progressBar(current: number, total: number, label: string): void {
  const width = 25;
  const pct = Math.round((current / total) * 100);
  const filled = Math.round((current / total) * width);
  const name = label.length > 20 ? label.slice(0, 17) + '...' : label;

  let bar = '';
  for (let i = 0; i < width; i++) {
    if (i < filled) {
      const t = i / width;
      const r = Math.round(34 + (0 - 34) * t);
      const g = Math.round(197 + (200 - 197) * t);
      const b = Math.round(94 + (255 - 94) * t);
      bar += `${rgb(r, g, b)}█`;
    } else {
      bar += `${c.dim}░`;
    }
  }
  bar += c.reset;

  process.stdout.write(`\r${ESC}[2K   ${bar} ${c.white}${String(pct).padStart(3)}%${c.reset} ${c.dim}${name}${c.reset}`);
}

export function progressClear(): void {
  process.stdout.write(`\r${ESC}[2K`);
}

// ─── Rule List ──────────────────────────────────────────────────────

export function printRuleList(rules: Rule[]): void {
  console.log('');
  const lines: string[] = [];
  lines.push(`${c.white}Available attack rules (${rules.length}):${c.reset}`);
  lines.push('');

  for (const rule of rules) {
    const pkgCount = Object.keys(rule.packages.compromised).length + Object.keys(rule.packages.malicious).length;
    lines.push(
      `  ${severityBadge(rule.severity)} ${c.white}${rule.id.padEnd(25)}${c.reset} ${c.dim}${rule.date}  (${pkgCount} pkgs)${c.reset}`
    );
    lines.push(`     ${c.dim}${rule.description}${c.reset}`);
  }
  lines.push('');

  console.log(drawBox(lines, { title: 'RULES', borderColor: c.cyan }));
  console.log('');
}

// ─── Summary ────────────────────────────────────────────────────────

export function printSummary(summary: ScanSummary): void {
  console.log('');

  // Stats card
  const statsLines: string[] = [
    '',
    `  ${c.dim}Projects scanned:${c.reset}   ${c.white}${summary.projectsScanned}${c.reset}`,
    `  ${c.dim}Rules checked:${c.reset}      ${c.white}${summary.rulesChecked}${c.reset}`,
    '',
    `  ${badge('pass')} ${c.green}${summary.passed}${c.reset}    ${badge('warn')} ${c.yellow}${summary.warnings}${c.reset}    ${badge('fail')} ${c.red}${summary.failed}${c.reset}`,
    '',
  ];

  // Status message
  if (summary.failed > 0) {
    statsLines.push(`  ${bgRgb(220, 38, 38)}${c.white}${c.bold}  ⛔ COMPROMISE DETECTED ⛔  ${c.reset}`);
    statsLines.push('');
    statsLines.push(`  ${c.red}${c.bold}Immediate Actions Required:${c.reset}`);
    statsLines.push('');
    statsLines.push(`  ${c.red}1.${c.reset} Disconnect from the network`);
    statsLines.push(`  ${c.red}2.${c.reset} Rotate ALL credentials, tokens, API keys, SSH keys`);
    statsLines.push(`  ${c.red}3.${c.reset} Remove compromised packages: ${c.white}npm install <pkg>@latest${c.reset}`);
    statsLines.push(`  ${c.red}4.${c.reset} Clean caches: ${c.white}npm cache clean --force${c.reset}`);
    statsLines.push(`  ${c.red}5.${c.reset} Review system for backdoors and persistence`);
    statsLines.push(`  ${c.red}6.${c.reset} Consider full system wipe if RAT/worm was executed`);

    if (summary.compromisedProjects.length > 0) {
      statsLines.push('');
      statsLines.push(`  ${c.red}${c.bold}Compromised Projects:${c.reset}`);
      for (const proj of summary.compromisedProjects) {
        statsLines.push(`    ${c.red}→ ${proj}${c.reset}`);
      }
    }

    // Failed results grouped by rule
    const failedByRule = new Map<string, CheckResult[]>();
    for (const r of summary.results.filter((r) => r.type === 'fail')) {
      const arr = failedByRule.get(r.rule) || [];
      arr.push(r);
      failedByRule.set(r.rule, arr);
    }
    for (const [rule, results] of failedByRule) {
      statsLines.push('');
      statsLines.push(`  ${c.red}${c.bold}${rule}:${c.reset}`);
      for (const r of results) {
        statsLines.push(`    ${c.red}→ ${r.message}${c.reset}`);
        if (r.details) statsLines.push(`      ${c.dim}${r.details}${c.reset}`);
      }
    }
  } else if (summary.warnings > 0) {
    statsLines.push(`  ${bgRgb(234, 179, 8)}${ESC}[30m${c.bold}  ⚠ WARNINGS FOUND — REVIEW RECOMMENDED ⚠  ${c.reset}`);
    statsLines.push('');
    statsLines.push(`  ${c.yellow}Some items need manual review. Check the warnings above.${c.reset}`);
  } else {
    statsLines.push(`  ${bgRgb(34, 197, 94)}${c.white}${c.bold}  ✨ ALL CLEAR — NO COMPROMISE DETECTED ✨  ${c.reset}`);
    statsLines.push('');
    statsLines.push(`  ${c.green}Your system appears clean from all known supply chain attacks.${c.reset}`);
    statsLines.push('');
    statsLines.push(`  ${c.dim}Prevention tips:${c.reset}`);
    statsLines.push(`  ${c.cyan}›${c.reset} Use lockfiles and verify package integrity`);
    statsLines.push(`  ${c.cyan}›${c.reset} Pin dependencies to exact versions`);
    statsLines.push(`  ${c.cyan}›${c.reset} Enable npm audit in your CI/CD pipeline`);
    statsLines.push(`  ${c.cyan}›${c.reset} Monitor for SLSA provenance on critical packages`);
  }

  statsLines.push('');
  statsLines.push(`  ${c.dim}${new Date().toISOString()}${c.reset}`);
  statsLines.push(`  ${c.dim}https://github.com/AsyrafHussin/supply-scan${c.reset}`);

  console.log(drawBox(statsLines, { title: 'SCAN COMPLETE', borderColor: summary.failed > 0 ? c.red : summary.warnings > 0 ? c.yellow : c.green }));
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
  // Fallback for non-TTY (CI, piped)
  if (!process.stdin.isTTY) {
    return opts.items.map((i) => i.value);
  }

  const items = opts.items;
  const hasAll = !!opts.allOption;
  const totalItems = hasAll ? items.length + 1 : items.length;
  let cursor = 0;
  const selected = new Set<number>(); // indices into items[]
  let allSelected = true; // default: all selected

  function render(initial = false): void {
    if (!initial) {
      process.stdout.write(`${ESC}[${totalItems + 2}A`); // move up
    }
    process.stdout.write(`${ESC}[2K  ${c.white}${opts.message}${c.reset}\n`);
    process.stdout.write(`${ESC}[2K  ${c.dim}(↑↓ navigate, space toggle, enter confirm)${c.reset}\n`);

    if (hasAll) {
      const isCurrent = cursor === 0;
      const marker = allSelected ? `${c.green}◉${c.reset}` : `${c.dim}○${c.reset}`;
      const pointer = isCurrent ? `${c.cyan}›${c.reset}` : ' ';
      const bg = isCurrent ? c.reverse : '';
      process.stdout.write(`${ESC}[2K ${pointer} ${marker}  ${bg}${c.green}${opts.allOption!.label}${c.reset}\n`);
    }

    for (let i = 0; i < items.length; i++) {
      const itemIdx = hasAll ? i + 1 : i;
      const isCurrent = cursor === itemIdx;
      const isSelected = allSelected || selected.has(i);
      const marker = isSelected ? `${c.green}◉${c.reset}` : `${c.dim}○${c.reset}`;
      const pointer = isCurrent ? `${c.cyan}›${c.reset}` : ' ';
      const hint = items[i].hint ? `  ${c.dim}${items[i].hint}${c.reset}` : '';
      const label = isCurrent ? `${c.white}${items[i].label}${c.reset}` : `${c.dim}${items[i].label}${c.reset}`;
      process.stdout.write(`${ESC}[2K ${pointer} ${marker}  ${label}${hint}\n`);
    }
  }

  return new Promise<T[]>((resolve) => {
    process.stdout.write(`${ESC}[?25l`); // hide cursor
    render(true);

    process.stdin.setRawMode(true);
    process.stdin.resume();

    const onData = (data: Buffer) => {
      const key = data.toString();

      if (key === '\x1b[A') { // up
        cursor = (cursor - 1 + totalItems) % totalItems;
        render();
      } else if (key === '\x1b[B') { // down
        cursor = (cursor + 1) % totalItems;
        render();
      } else if (key === ' ') { // space - toggle
        if (hasAll && cursor === 0) {
          allSelected = !allSelected;
          selected.clear();
        } else {
          const itemIdx = hasAll ? cursor - 1 : cursor;
          allSelected = false;
          if (selected.has(itemIdx)) {
            selected.delete(itemIdx);
          } else {
            selected.add(itemIdx);
          }
          // Check if all individually selected
          if (selected.size === items.length) {
            allSelected = true;
            selected.clear();
          }
        }
        render();
      } else if (key === '\r') { // enter - confirm
        cleanup();
        if (allSelected) {
          resolve(items.map((i) => i.value));
        } else {
          const result = [...selected].map((i) => items[i].value);
          resolve(result.length > 0 ? result : items.map((i) => i.value));
        }
      } else if (key === '\x03') { // Ctrl+C
        cleanup();
        process.exit(130);
      }
    };

    function cleanup() {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener('data', onData);
      process.stdout.write(`${ESC}[?25h`); // show cursor
    }

    process.stdin.on('data', onData);
  });
}

export async function interactiveSingleSelect<T>(opts: {
  message: string;
  items: SelectItem<T>[];
}): Promise<T> {
  // Fallback for non-TTY
  if (!process.stdin.isTTY) {
    return opts.items[0].value;
  }

  const items = opts.items;
  let cursor = 0;

  function render(initial = false): void {
    if (!initial) {
      process.stdout.write(`${ESC}[${items.length + 2}A`);
    }
    process.stdout.write(`${ESC}[2K  ${c.white}${opts.message}${c.reset}\n`);
    process.stdout.write(`${ESC}[2K  ${c.dim}(↑↓ navigate, enter select)${c.reset}\n`);

    for (let i = 0; i < items.length; i++) {
      const isCurrent = cursor === i;
      const pointer = isCurrent ? `${c.cyan}›${c.reset}` : ' ';
      const hint = items[i].hint ? `  ${c.dim}${items[i].hint}${c.reset}` : '';
      const label = isCurrent ? `${c.white}${items[i].label}${c.reset}` : `${c.dim}${items[i].label}${c.reset}`;
      process.stdout.write(`${ESC}[2K ${pointer}  ${label}${hint}\n`);
    }
  }

  return new Promise<T>((resolve) => {
    process.stdout.write(`${ESC}[?25l`);
    render(true);

    process.stdin.setRawMode(true);
    process.stdin.resume();

    const onData = (data: Buffer) => {
      const key = data.toString();

      if (key === '\x1b[A') {
        cursor = (cursor - 1 + items.length) % items.length;
        render();
      } else if (key === '\x1b[B') {
        cursor = (cursor + 1) % items.length;
        render();
      } else if (key === '\r') {
        cleanup();
        resolve(items[cursor].value);
      } else if (key === '\x03') {
        cleanup();
        process.exit(130);
      }
    };

    function cleanup() {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener('data', onData);
      process.stdout.write(`${ESC}[?25h`);
    }

    process.stdin.on('data', onData);
  });
}
