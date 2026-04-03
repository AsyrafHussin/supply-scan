import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const __filename = fileURLToPath(import.meta.url);
export const __tests_dir = dirname(__filename);
export const FIXTURES = join(__tests_dir, 'fixtures');
export const FIXTURE_RULES = join(FIXTURES, 'rules');

export function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'supply-scan-test-'));
}

export function removeTempDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

export function createProject(
  baseDir: string,
  opts: {
    compromisedPkg?: { name: string; version: string };
    maliciousPkg?: string;
    lockfileEntry?: string;
  } = {}
): string {
  const projectDir = join(baseDir, 'test-project');
  mkdirSync(projectDir, { recursive: true });
  writeFileSync(join(projectDir, 'package.json'), JSON.stringify({ name: 'test', version: '1.0.0' }));

  if (opts.compromisedPkg) {
    const pkgDir = join(projectDir, 'node_modules', opts.compromisedPkg.name);
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(
      join(pkgDir, 'package.json'),
      JSON.stringify({ name: opts.compromisedPkg.name, version: opts.compromisedPkg.version })
    );
  }

  if (opts.maliciousPkg) {
    const pkgDir = join(projectDir, 'node_modules', opts.maliciousPkg);
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(
      join(pkgDir, 'package.json'),
      JSON.stringify({ name: opts.maliciousPkg, version: '0.0.1' })
    );
  }

  if (opts.lockfileEntry) {
    writeFileSync(join(projectDir, 'package-lock.json'), opts.lockfileEntry);
  }

  return projectDir;
}
