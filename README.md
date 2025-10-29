# nextjs-indexing-pack

Submit every non-error route in your Next.js build to [IndexNow](https://www.indexnow.org/) and the search engines that support it.

## What it does

- 📄 Reads your Next.js build output and compiles a clean list of public URLs (excluding 404/error utilities).
- 🚀 Sends the URLs to IndexNow-compatible endpoints (IndexNow, Bing, Yandex, Naver) with one call.
- 🧪 Supports dry-run mode so you can verify which URLs will be submitted before notifying search engines.

## Installation

```bash
npm install nextjs-indexing-pack
```

The package ships as plain TypeScript utilities so it can be wired into any build or deployment workflow.

## Preparing IndexNow

1. Generate an IndexNow key (any random 8–128 character string).
2. Create a text file named `<key>.txt` in the public root of your site that contains the key value.
3. Deploy the file so it is accessible at `https://your-domain.com/<key>.txt`.

Refer to the official [IndexNow documentation](https://www.indexnow.org/documentation) for detailed requirements.

## Usage

### CLI (recommended)

Kick off your integration with the interactive init wizard:

```bash
npx nextjs-indexing-pack init
```

The wizard asks for your production URL, generates a compliant IndexNow key, creates the required `public/<key>.txt` file, and (optionally) stores the key in `.env.local`.

Once you are set up, trigger submissions directly from your build or deployment pipeline:

```bash
npx nextjs-indexing-pack --base-url "https://your-domain.com"
```

Optional flags:

- `--next-build-dir <dir>` – override the location of your Next.js build output (defaults to `.next`).
- `--dry-run` – collect URLs without notifying any endpoints.

If you do not pass `--key`, the CLI will automatically fall back to the `INDEXNOW_KEY` environment variable.

For example, run a dry run to inspect the URLs that will be submitted:

```bash
npx nextjs-indexing-pack --base-url "https://your-domain.com" --dry-run
```

Tip: wire it into your pipeline after `next build` finishes, for example `"postbuild": "INDEXNOW_KEY=$INDEXNOW_KEY npx nextjs-indexing-pack --base-url https://your-domain.com"`.

### Using the TypeScript API

Prefer to keep using the library? Create a small script (for example in `scripts/submit-indexnow.ts`) and run it after `next build` finishes.

```ts
import { submitToIndexNow } from 'nextjs-indexing-pack';

async function main() {
  const result = await submitToIndexNow({
    baseUrl: 'https://your-domain.com',
    key: process.env.INDEXNOW_KEY!,
    nextBuildDir: '.next',
  });

  console.log(`Submitted ${result.urls.length} URLs to IndexNow.`);
  console.log(result.responses);
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

## Requirements

- Next.js ≥ 12
- Node.js ≥ 18 (IndexNow submission relies on the built-in `fetch` API)

## License

MIT © nextjs-indexing-pack
