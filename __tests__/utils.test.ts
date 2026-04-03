import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { FIXTURE_RULES, __tests_dir } from './helpers.js';
import {
  parseArgs,
  isVersionCompromised,
  expandPath,
  loadRules,
  readJSON,
  fileExists,
  dirExists,
  findProjects,
} from '../src/utils.js';

// ─── parseArgs ──────────────────────────────────────────────────────

describe('parseArgs', () => {
  it('returns defaults for empty argv', () => {
    const opts = parseArgs([]);
    expect(opts.all).toBe(false);
    expect(opts.list).toBe(false);
    expect(opts.ci).toBe(false);
    expect(opts.help).toBe(false);
    expect(opts.version).toBe(false);
    expect(opts.path).toBeNull();
    expect(opts.rules).toEqual([]);
  });

  it('parses --all / -a', () => {
    expect(parseArgs(['--all']).all).toBe(true);
    expect(parseArgs(['-a']).all).toBe(true);
  });

  it('parses --list / -l', () => {
    expect(parseArgs(['--list']).list).toBe(true);
    expect(parseArgs(['-l']).list).toBe(true);
  });

  it('parses --ci (also sets all)', () => {
    const opts = parseArgs(['--ci']);
    expect(opts.ci).toBe(true);
    expect(opts.all).toBe(true);
  });

  it('parses --help / -h', () => {
    expect(parseArgs(['--help']).help).toBe(true);
    expect(parseArgs(['-h']).help).toBe(true);
  });

  it('parses --version / -v', () => {
    expect(parseArgs(['--version']).version).toBe(true);
    expect(parseArgs(['-v']).version).toBe(true);
  });

  it('parses --rule with value', () => {
    const opts = parseArgs(['--rule', 'axios-2026']);
    expect(opts.rules).toEqual(['axios-2026']);
  });

  it('parses multiple --rule flags', () => {
    const opts = parseArgs(['--rule', 'axios-2026', '-r', 'node-ipc-2022']);
    expect(opts.rules).toEqual(['axios-2026', 'node-ipc-2022']);
  });

  it('parses --path with value', () => {
    const opts = parseArgs(['--path', '/tmp/test']);
    expect(opts.path).toContain('tmp/test');
  });

  it('ignores unknown flags', () => {
    const opts = parseArgs(['--unknown', '--foo']);
    expect(opts.all).toBe(false);
  });

  it('handles --rule at end of argv without value', () => {
    const opts = parseArgs(['--all', '--rule']);
    expect(opts.rules).toEqual([]);
    expect(opts.all).toBe(true);
  });
});

// ─── isVersionCompromised ───────────────────────────────────────────

describe('isVersionCompromised', () => {
  it('returns true for matching version', () => {
    expect(isVersionCompromised('1.14.1', ['1.14.1', '0.30.4'])).toBe(true);
  });

  it('returns false for non-matching version', () => {
    expect(isVersionCompromised('1.7.9', ['1.14.1', '0.30.4'])).toBe(false);
  });

  it('returns false for null version', () => {
    expect(isVersionCompromised(null, ['1.14.1'])).toBe(false);
  });

  it('returns false for empty bad versions', () => {
    expect(isVersionCompromised('1.0.0', [])).toBe(false);
  });
});

// ─── expandPath ─────────────────────────────────────────────────────

describe('expandPath', () => {
  it('expands tilde to home dir', () => {
    const result = expandPath('~/test');
    expect(result).toBe(join(homedir(), 'test'));
  });

  it('returns path as-is when no expansion needed', () => {
    expect(expandPath('/tmp/test')).toBe('/tmp/test');
  });
});

// ─── loadRules ──────────────────────────────────────────────────────

describe('loadRules', () => {
  it('loads rules from directory', () => {
    const rules = loadRules(FIXTURE_RULES);
    expect(rules).toHaveLength(1);
    expect(rules[0].id).toBe('test-rule-2024');
  });

  it('returns empty array for non-existent directory', () => {
    expect(loadRules('/nonexistent/path')).toEqual([]);
  });

  it('validates rule has id and packages', () => {
    const rules = loadRules(FIXTURE_RULES);
    for (const rule of rules) {
      expect(rule.id).toBeDefined();
      expect(rule.packages).toBeDefined();
    }
  });
});

// ─── readJSON ───────────────────────────────────────────────────────

describe('readJSON', () => {
  it('reads valid JSON file', () => {
    const data = readJSON<{ id: string }>(join(FIXTURE_RULES, 'test-rule.json'));
    expect(data).not.toBeNull();
    expect(data!.id).toBe('test-rule-2024');
  });

  it('returns null for non-existent file', () => {
    expect(readJSON('/nonexistent/file.json')).toBeNull();
  });
});

// ─── fileExists / dirExists ─────────────────────────────────────────

describe('fileExists', () => {
  it('returns true for existing file', () => {
    expect(fileExists(join(FIXTURE_RULES, 'test-rule.json'))).toBe(true);
  });

  it('returns false for non-existent file', () => {
    expect(fileExists('/nonexistent/file')).toBe(false);
  });
});

describe('dirExists', () => {
  it('returns true for existing directory', () => {
    expect(dirExists(FIXTURE_RULES)).toBe(true);
  });

  it('returns false for non-existent directory', () => {
    expect(dirExists('/nonexistent/dir')).toBe(false);
  });
});

// ─── findProjects ───────────────────────────────────────────────────

describe('findProjects', () => {
  it('finds projects with package.json', () => {
    const root = join(__tests_dir, '..');
    const projects = findProjects([root], 1);
    expect(projects.length).toBeGreaterThan(0);
  });

  it('returns empty for non-existent directory', () => {
    expect(findProjects(['/nonexistent'])).toEqual([]);
  });
});
