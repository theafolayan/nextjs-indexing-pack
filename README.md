# nextjs-indexing-pack

Submit every non-error route in your Next.js build to [IndexNow](https://www.indexnow.org/) and the search engines that support it.

## Why nextjs-indexing-pack

- **Purpose-built for Next.js** – understands the `.next` build output structure so you can skip writing bespoke crawlers.
- **One command, multiple destinations** – notify IndexNow-compatible engines and the Google Indexing API in the same workflow.
- **Zero-guess setup** – the interactive wizard scaffolds keys, config files, and optional Google credentials for you.
- **CI friendly** – works anywhere Node.js runs and honours environment variables and config files.

## Table of contents

- [What it does](#what-it-does)
- [Quick start](#quick-start)
- [Installation](#installation)
- [Preparing IndexNow](#preparing-indexnow)
- [Usage](#usage)
  - [CLI (recommended)](#cli-recommended)
  - [Using the TypeScript API](#using-the-typescript-api)
  - [Customising submissions](#customising-submissions)
- [Configuration reference](#configuration-reference)
- [API](#api)
- [Troubleshooting](#troubleshooting)
- [Requirements](#requirements)
- [License](#license)

## What it does

- 📄 Reads your Next.js build output and compiles a clean list of public URLs (excluding 404/error utilities).
- 🚀 Sends the URLs to IndexNow-compatible endpoints (IndexNow, Bing, Yandex, Naver) with one call.
- 🌐 Optionally publishes the same URLs to the [Google Indexing API](https://developers.google.com/search/apis/indexing-api/v3/quickstart) using a service account.
- 🧪 Supports dry-run mode so you can verify which URLs will be submitted before notifying search engines.

## Quick start

1. **Install the package** in your Next.js project:

   ```bash
   npm install nextjs-indexing-pack
   ```

2. **Run the setup wizard** after your next build finishes locally:

   ```bash
   npx nextjs-indexing-pack init
   ```

   The wizard:

   - asks for your production URL and stores it in `nextjs-indexing-pack.config.json`;
   - generates a compliant IndexNow key and places `<key>.txt` in your `public/` directory;
   - optionally scaffolds Google Indexing credentials and updates `.env.local` for you.

3. **Commit the generated config and key file**, keep real secrets out of git, and expose `INDEXNOW_KEY` (and optionally `GOOGLE_APPLICATION_CREDENTIALS`) to your CI/CD environment.

4. **Trigger submissions** whenever `next build` completes, for example from `package.json`:

   ```json
   {
     "scripts": {
       "build": "next build",
       "postbuild": "INDEXNOW_KEY=$INDEXNOW_KEY npx nextjs-indexing-pack"
     }
   }
   ```

## Installation

The package ships as plain TypeScript utilities so it can be wired into any build or deployment workflow.

```bash
npm install nextjs-indexing-pack
```

## Preparing IndexNow

1. Generate an IndexNow key (any random 8–128 character string).
2. Create a text file named `<key>.txt` in the public root of your site that contains the key value.
3. Deploy the file so it is accessible at `https://your-domain.com/<key>.txt`.

Refer to the official [IndexNow documentation](https://www.indexnow.org/documentation) for detailed requirements. The init wizard (see [CLI](#cli-recommended)) can create and place the key file for you.

## Usage

### CLI (recommended)

Kick off your integration with the interactive init wizard:

```bash
npx nextjs-indexing-pack init
```

The wizard asks for your production URL, generates a compliant IndexNow key, creates the required `public/<key>.txt` file, writes `nextjs-indexing-pack.config.json`, and can optionally scaffold a dummy Google service account JSON credential file while storing the references in `.env.local`.

Once you are set up, trigger submissions directly from your build or deployment pipeline:

```bash
npx nextjs-indexing-pack
```

Optional flags:

- `--base-url <url>` – override the base URL stored in `nextjs-indexing-pack.config.json`.
- `--next-build-dir <dir>` – override the location of your Next.js build output (defaults to `.next`).
- `--dry-run` – collect URLs without notifying any endpoints.
- `--google-service-account <path>` – override the Google service account credentials path (defaults to `GOOGLE_APPLICATION_CREDENTIALS` env var or the config file).
- `--google-notification-type <type>` – switch between `URL_UPDATED` (default) and `URL_DELETED` notifications for the Google Indexing API.

If you do not pass `--key`, the CLI will automatically fall back to the `INDEXNOW_KEY` environment variable.

If `GOOGLE_APPLICATION_CREDENTIALS` (or `nextjs-indexing-pack.config.json`) points to a service account JSON file, the CLI will automatically notify the Google Indexing API as well. When the credentials are missing required fields or contain placeholder values, the CLI skips the Google submission and continues with IndexNow so your default workflow is not interrupted.

Need to drive everything non-interactively in CI? Pre-populate config values and rely on environment variables:

```bash
INDEXNOW_KEY=your-key GOOGLE_APPLICATION_CREDENTIALS=./google-service-account.json npx nextjs-indexing-pack \
  --base-url https://www.example.com \
  --next-build-dir .next
```

For example, run a dry run to inspect the URLs that will be submitted:

```bash
npx nextjs-indexing-pack --dry-run
```

Tip: wire it into your pipeline after `next build` finishes, for example `"postbuild": "INDEXNOW_KEY=$INDEXNOW_KEY npx nextjs-indexing-pack"`.

### Using the TypeScript API

Prefer to keep using the library? Create a small script (for example in `scripts/submit-indexnow.ts`) and run it after `next build` finishes.

```ts
import { submitToGoogleIndexing, submitToIndexNow } from 'nextjs-indexing-pack';

async function main() {
  const result = await submitToIndexNow({
    baseUrl: 'https://your-domain.com',
    key: process.env.INDEXNOW_KEY!,
    nextBuildDir: '.next',
  });

  console.log(`Submitted ${result.urls.length} URLs to IndexNow.`);
  console.log(result.responses);

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const googleResult = await submitToGoogleIndexing({
      baseUrl: 'https://your-domain.com',
      serviceAccountPath: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      nextBuildDir: '.next',
    });
    console.log(`Submitted ${googleResult.urls.length} URLs to the Google Indexing API.`);
    console.log(googleResult.responses);
  }
}

main().catch((error) => {
  console.error('IndexNow submission failed:', error);
  process.exit(1);
});
```

Add a script entry so you can call it easily:

```json
{
  "scripts": {
    "build": "next build",
    "postbuild": "tsx scripts/submit-indexnow.ts"
  }
}
```

> 💡 Prefer to test first? Pass `dryRun: true` to only list the URLs without notifying any endpoint.

### Customising submissions

```ts
import { submitToIndexNow } from 'nextjs-indexing-pack';

await submitToIndexNow({
  baseUrl: 'https://your-domain.com',
  key: process.env.INDEXNOW_KEY!,
  nextBuildDir: '.next',
  endpoints: ['https://www.bing.com/indexnow'], // override the default list
  urlFilter: (url) => !url.includes('/drafts'),   // exclude URLs you do not want to submit
});
```

## Configuration reference

### `nextjs-indexing-pack.config.json`

The CLI automatically creates this file when you run `npx nextjs-indexing-pack init`. It lives in your project root and stores non-secret defaults that work in all environments.

| Field | Type | Description |
| --- | --- | --- |
| `baseUrl` | `string` | Production origin used to build absolute URLs (e.g. `https://www.example.com`). |
| `googleServiceAccountPath` | `string` | Relative or absolute path to the Google service account JSON file. |

Commit the file so your CI environment inherits the same defaults. Secrets such as the actual service account JSON should **not** be committed—store the file in a secure secret manager or deployment bucket and reference it from the config.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `INDEXNOW_KEY` | Required IndexNow key. Used automatically by the CLI and TypeScript helpers. |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to the Google service account credentials used for the Indexing API (optional). |
| `NEXTJS_INDEXING_PACK_BASE_URL` | Optional override if you cannot edit the config file in the current environment. |

Environment variables always take precedence over config file values when you pass the corresponding CLI flags (for example `--base-url`). This makes it easy to test changes temporarily without editing the committed config.

### Google Indexing API prerequisites

1. Create a Google Cloud project and enable the **Indexing API**.
2. Generate a service account with the `Indexing API` scope and download the JSON credentials.
3. Share the verified Search Console property with the service account email address.
4. Point `GOOGLE_APPLICATION_CREDENTIALS` (or the config file) at the JSON credentials.

The init wizard can scaffold a dummy JSON file so you can wire everything up before obtaining real credentials.

## API

### `submitToIndexNow(options)`

Collects URLs from the Next.js build directory and notifies IndexNow-compatible endpoints.

| Option | Type | Description |
| --- | --- | --- |
| `baseUrl` | `string` | Fully qualified origin to prepend to each discovered route. |
| `nextBuildDir` | `string` | Location of the `.next` build directory (defaults to `.next`). |
| `key` | `string` | IndexNow key value. |
| `keyLocation` | `string` | Absolute URL pointing to the key file (defaults to `${baseUrl}/${key}.txt`). |
| `endpoints` | `string[]` | Endpoints to notify (defaults to IndexNow, Bing, Yandex, Naver). |
| `urlFilter` | `(url: string) => boolean` | Optional filter callback for excluding URLs from submission. |
| `dryRun` | `boolean` | When `true`, URLs are collected but **not** submitted. |

Returns a promise resolving to:

```ts
{
  urls: string[]; // URLs that were collected from the Next.js build output
  responses: Record<string, { status: number; ok: boolean; body?: string }>;
}
```

### `collectIndexableRoutes(nextBuildDir?)`

Utility helper that returns the raw list of routes (without base URL) discovered in the specified `.next` directory. This can be used if you want to roll your own submission logic.

### `submitToGoogleIndexing(options)`

Publishes URLs to the Google Indexing API using a service account.

| Option | Type | Description |
| --- | --- | --- |
| `baseUrl` | `string` | Fully qualified origin to prepend to each discovered route. |
| `serviceAccountPath` | `string` | Path to the Google service account JSON credentials. |
| `nextBuildDir` | `string` | Location of the `.next` build directory (defaults to `.next`). |
| `urlFilter` | `(url: string) => boolean` | Optional filter callback for excluding URLs from submission. |
| `dryRun` | `boolean` | When `true`, URLs are collected but **not** submitted. |
| `notificationType` | `'URL_UPDATED' | 'URL_DELETED'` | Notification type sent to the Indexing API (defaults to `URL_UPDATED`). |

Returns a promise resolving to:

```ts
{
  urls: string[]; // URLs that were collected from the Next.js build output
  responses: Array<{ url: string; status: number; ok: boolean; body?: string }>;
}
```

## Troubleshooting

- **No URLs are submitted** – ensure `next build` was run and the `.next` directory exists before running the CLI or scripts.
- **IndexNow rejects the key** – verify the `<key>.txt` file is deployed at `https://your-domain.com/<key>.txt` and contains the exact key value.
- **Google Indexing API requests fail** – confirm the service account has access to your Search Console property and that the JSON credentials path is valid.
- **CI cannot find the config file** – commit `nextjs-indexing-pack.config.json` and double-check the working directory in your pipeline before running the CLI.

## Requirements

- Next.js ≥ 12
- Node.js ≥ 18 (IndexNow submission relies on the built-in `fetch` API)

## License

MIT © nextjs-indexing-pack
