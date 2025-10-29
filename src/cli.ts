#!/usr/bin/env node
import { submitToIndexNow } from './indexnow';
import { runInit } from './init';
import { loadConfig } from './config';
import { submitToGoogleIndexing } from './google-indexing';

interface CliOptions {
  baseUrl?: string;
  key?: string;
  nextBuildDir?: string;
  dryRun?: boolean;
  googleServiceAccount?: string;
  googleNotificationType?: string;
}

function printUsage(): void {
  console.log(`Usage: nextjs-indexing-pack [command] [options]\n\n` +
    `Commands:\n` +
    `  init                   Interactive wizard that prepares your project for IndexNow.\n` +
    `  (default)              Submit URLs immediately using the flags below.\n\n` +
    `Options:\n` +
    `  --base-url <url>        Fully qualified origin of your deployed Next.js site (defaults to config).\n` +
    `  --key <key>             IndexNow key value (defaults to INDEXNOW_KEY env var).\n` +
    `  --next-build-dir <dir>  Location of the Next.js build output (defaults to .next).\n` +
    `  --google-service-account <path>  Path to Google service account JSON credentials.\n` +
    `  --google-notification-type <type> Notification type for Google Indexing (URL_UPDATED or URL_DELETED).\n` +
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
    const argv = process.argv.slice(2);

    if (argv[0] === 'init') {
      if (argv.includes('--help')) {
        printUsage();
        return;
      }
      await runInit();
      return;
    }

    const config = await loadConfig();
    const options = parseArgs(argv);
    const { nextBuildDir, dryRun } = options;
    const baseUrl = options.baseUrl ?? config?.baseUrl;
    const key = options.key ?? process.env.INDEXNOW_KEY;
    const googleServiceAccount =
      options.googleServiceAccount ?? process.env.GOOGLE_APPLICATION_CREDENTIALS ?? config?.googleServiceAccountPath;

    let googleNotificationType: 'URL_UPDATED' | 'URL_DELETED' | undefined;
    if (options.googleNotificationType) {
      if (options.googleNotificationType === 'URL_UPDATED' || options.googleNotificationType === 'URL_DELETED') {
        googleNotificationType = options.googleNotificationType;
      } else {
        throw new Error('Invalid value for --google-notification-type. Expected URL_UPDATED or URL_DELETED.');
      }
    }

    if (!baseUrl) {
      throw new Error('Missing base URL. Pass --base-url <url> or run "npx nextjs-indexing-pack init" to create a config file.');
    }
    if (!key) {
      throw new Error('Missing IndexNow key. Pass --key <value> or set INDEXNOW_KEY in your environment.');
    }

    const indexNowResult = await submitToIndexNow({
      baseUrl,
      key,
      nextBuildDir,
      dryRun,
    });

    if (dryRun) {
      console.log(`Dry run: discovered ${indexNowResult.urls.length} URL${indexNowResult.urls.length === 1 ? '' : 's'}.`);
    } else {
      console.log(`Submitted ${indexNowResult.urls.length} URL${indexNowResult.urls.length === 1 ? '' : 's'} to IndexNow-compatible endpoints.`);
      for (const [endpoint, response] of Object.entries(indexNowResult.responses)) {
        console.log(`- ${endpoint}: ${response.ok ? 'ok' : 'failed'} (status ${response.status}${response.body ? `, body: ${response.body}` : ''})`);
      }
    }

    if (googleServiceAccount) {
      const googleResult = await submitToGoogleIndexing({
        baseUrl,
        serviceAccountPath: googleServiceAccount,
        nextBuildDir,
        dryRun,
        notificationType: googleNotificationType,
      });

      if (dryRun) {
        console.log(
          `Google Indexing dry run: discovered ${googleResult.urls.length} URL${googleResult.urls.length === 1 ? '' : 's'}.`,
        );
      } else {
        console.log(
          `Submitted ${googleResult.urls.length} URL${googleResult.urls.length === 1 ? '' : 's'} to the Google Indexing API.`,
        );
        for (const response of googleResult.responses) {
          console.log(
            `- ${response.url}: ${response.ok ? 'ok' : 'failed'} (status ${response.status}${
              response.body ? `, body: ${response.body}` : ''
            })`,
          );
        }
      }
    } else {
      console.log('Skipped Google Indexing submission (no service account credentials configured).');
    }
  } catch (error: any) {
    console.error(error?.message ?? error);
    process.exit(1);
  }
}

void main();
