import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FIXTURE_RULES, createTempDir, removeTempDir, createProject } from './helpers.js';
import { checkPackages } from '../src/checks/packages.js';
import { loadRules } from '../src/utils.js';
import type { Rule } from '../src/types.js';

let testRule: Rule;
let tempDir: string;

beforeEach(() => {
  const rules = loadRules(FIXTURE_RULES);
  testRule = rules[0];
  tempDir = createTempDir();
});

afterEach(() => {
  removeTempDir(tempDir);
});

describe('checkPackages', () => {
  it('detects compromised package version', () => {
    const projectDir = createProject(tempDir, {
      compromisedPkg: { name: 'bad-pkg', version: '1.0.0' },
    });
    const results = checkPackages([testRule], [projectDir]);
    const fails = results.filter((r) => r.type === 'fail');
    expect(fails).toHaveLength(1);
    expect(fails[0].message).toContain('bad-pkg@1.0.0');
    expect(fails[0].message).toContain('COMPROMISED');
  });

  it('detects malicious package directory', () => {
    const projectDir = createProject(tempDir, {
      maliciousPkg: 'evil-pkg',
    });
    const results = checkPackages([testRule], [projectDir]);
    const fails = results.filter((r) => r.type === 'fail');
    expect(fails).toHaveLength(1);
    expect(fails[0].message).toContain('evil-pkg');
    expect(fails[0].message).toContain('Malicious');
  });

  it('detects compromised version in lockfile', () => {
    const projectDir = createProject(tempDir, {
      lockfileEntry: `{"dependencies": {"bad-pkg": "1.0.0"}}`,
    });
    const results = checkPackages([testRule], [projectDir]);
    const warns = results.filter((r) => r.type === 'warn');
    expect(warns).toHaveLength(1);
    expect(warns[0].message).toContain('bad-pkg@1.0.0');
  });

  it('returns empty for clean project', () => {
    const projectDir = createProject(tempDir);
    const results = checkPackages([testRule], [projectDir]);
    expect(results).toEqual([]);
  });

  it('returns empty for safe package version', () => {
    const projectDir = createProject(tempDir, {
      compromisedPkg: { name: 'bad-pkg', version: '2.0.0' },
    });
    const results = checkPackages([testRule], [projectDir]);
    const fails = results.filter((r) => r.type === 'fail');
    expect(fails).toEqual([]);
  });

  it('returns empty for empty rules', () => {
    const projectDir = createProject(tempDir);
    expect(checkPackages([], [projectDir])).toEqual([]);
  });

  it('returns empty for empty project dirs', () => {
    expect(checkPackages([testRule], [])).toEqual([]);
  });

  it('detects both compromised and malicious in same project', () => {
    const projectDir = createProject(tempDir, {
      compromisedPkg: { name: 'bad-pkg', version: '1.0.0' },
      maliciousPkg: 'evil-pkg',
    });
    const results = checkPackages([testRule], [projectDir]);
    const fails = results.filter((r) => r.type === 'fail');
    expect(fails).toHaveLength(2);
  });
});
