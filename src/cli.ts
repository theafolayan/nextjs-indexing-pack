#!/usr/bin/env node
import { submitToIndexNow } from './indexnow';

interface CliOptions {
  baseUrl?: string;
  key?: string;
  nextBuildDir?: string;
  dryRun?: boolean;
}

function printUsage(): void {
  console.log(`Usage: nextjs-indexing-pack --base-url <url> --key <key> [options]\n\n` +
    `Options:\n` +
    `  --base-url <url>        Fully qualified origin of your deployed Next.js site.\n` +
    `  --key <key>             IndexNow key value (must match the hosted key file).\n` +
    `  --next-build-dir <dir>  Location of the Next.js build output (defaults to .next).\n` +
    `  --dry-run               Collect URLs without submitting them to IndexNow.\n` +
    `  --help                  Show this message.\n`);
}

function toCamelCase(flag: string): keyof CliOptions {
  return flag.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase()) as keyof CliOptions;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help') {
      printUsage();
      process.exit(0);
    }

    if (!arg.startsWith('--')) {
      throw new Error(`Unexpected argument: ${arg}`);
    }

    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    const flagName = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      throw new Error(`Missing value for flag: ${arg}`);
    }

    const key = toCamelCase(flagName);
    options[key] = next as never;
    index += 1;
  }
  return options;
}

async function main(): Promise<void> {
  try {
    const options = parseArgs(process.argv.slice(2));
    const { baseUrl, key, nextBuildDir, dryRun } = options;

    if (!baseUrl) {
      throw new Error('Missing required flag: --base-url');
    }
    if (!key) {
      throw new Error('Missing required flag: --key');
    }

    const result = await submitToIndexNow({
      baseUrl,
      key,
      nextBuildDir,
      dryRun,
    });

    if (dryRun) {
      console.log(`Dry run: discovered ${result.urls.length} URL${result.urls.length === 1 ? '' : 's'}.`);
    } else {
      console.log(`Submitted ${result.urls.length} URL${result.urls.length === 1 ? '' : 's'} to IndexNow-compatible endpoints.`);
      for (const [endpoint, response] of Object.entries(result.responses)) {
        console.log(`- ${endpoint}: ${response.ok ? 'ok' : 'failed'} (status ${response.status}${response.body ? `, body: ${response.body}` : ''})`);
      }
    }
  } catch (error: any) {
    console.error(error?.message ?? error);
    process.exit(1);
  }
}

void main();
