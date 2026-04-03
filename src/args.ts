import { resolve } from 'node:path';
import type { CLIOptions } from './types.js';

export function parseArgs(argv: string[]): CLIOptions {
  const opts: CLIOptions = {
    rules: [],
    all: false,
    list: false,
    path: null,
    ci: false,
    help: false,
    version: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--all':
      case '-a':
        opts.all = true;
        break;
      case '--list':
      case '-l':
        opts.list = true;
        break;
      case '--ci':
        opts.ci = true;
        opts.all = true;
        break;
      case '--help':
      case '-h':
        opts.help = true;
        break;
      case '--version':
      case '-v':
        opts.version = true;
        break;
      case '--rule':
      case '-r':
        if (i + 1 < argv.length) {
          opts.rules.push(argv[++i]);
        }
        break;
      case '--path':
      case '-p':
        if (i + 1 < argv.length) {
          opts.path = resolve(argv[++i]);
        }
        break;
    }
  }

  return opts;
}
