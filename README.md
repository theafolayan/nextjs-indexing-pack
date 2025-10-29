# nextjs-indexing-pack

A lightweight utility package for managing SEO metadata and search engine indexing in Next.js applications.

## Features

- 🚀 Easy-to-use API for generating SEO metadata
- 📝 TypeScript support with full type definitions
- ⚡ Lightweight with zero dependencies
- 🎯 Designed specifically for Next.js 12+ (App Router compatible)
- 🔍 Control over search engine indexing and crawling

## Installation

```bash
npm install nextjs-indexing-pack
```

or with yarn:

```bash
yarn add nextjs-indexing-pack
```

or with pnpm:

```bash
pnpm add nextjs-indexing-pack
```

## Usage

### Basic Example (Next.js App Router)

```tsx
import { generateIndexingMetadata } from 'nextjs-indexing-pack';

// In your page.tsx or layout.tsx
export const metadata = generateIndexingMetadata({
  title: 'My Awesome Page',
  description: 'This is a description of my awesome page for search engines',
  keywords: ['nextjs', 'seo', 'indexing', 'react'],
  canonicalUrl: 'https://example.com/my-page',
});

export default function Page() {
  return <div>Your page content</div>;
}
```

### Preventing Indexing

```tsx
import { generateIndexingMetadata } from 'nextjs-indexing-pack';

export const metadata = generateIndexingMetadata({
  title: 'Admin Dashboard',
  description: 'Private admin area',
  noIndex: true,
  noFollow: true,
});
```

### Using Robots Tag Helper

```tsx
import { generateRobotsTag } from 'nextjs-indexing-pack';

const robotsValue = generateRobotsTag(false, false); // "index, follow"
const noIndexValue = generateRobotsTag(true, true);  // "noindex, nofollow"
```

## API Reference

### `generateIndexingMetadata(options: IndexingOptions)`

Generates metadata object for Next.js pages.

#### Parameters

- `options.title` (string, optional): Page title for search engines
- `options.description` (string, optional): Meta description
- `options.keywords` (string[], optional): Array of keywords
- `options.canonicalUrl` (string, optional): Canonical URL for the page
- `options.noIndex` (boolean, optional): Prevent search engine indexing (default: false)
- `options.noFollow` (boolean, optional): Prevent following links (default: false)

#### Returns

Object containing Next.js metadata properties.

### `generateRobotsTag(noIndex?: boolean, noFollow?: boolean)`

Generates a robots meta tag value.

#### Parameters

- `noIndex` (boolean, optional): Whether to prevent indexing (default: false)
- `noFollow` (boolean, optional): Whether to prevent following links (default: false)

#### Returns

String value for robots meta tag.

## Development

### Building the Package

```bash
npm run build
```

This will compile TypeScript files and generate type definitions in the `dist` folder.

### Project Structure

```
nextjs-indexing-pack/
├── src/
│   ├── index.ts          # Main entry point
│   └── indexing.ts       # Core indexing utilities
├── dist/                 # Compiled JavaScript and type definitions
├── package.json
├── tsconfig.json
├── LICENSE
└── README.md
```

## Requirements

- Next.js >= 12.0.0
- React >= 17.0.0
- Node.js >= 16.0.0

## License

MIT © nextjs-indexing-pack

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Issues

If you encounter any issues or have questions, please file an issue on the [GitHub repository](https://github.com/theafolayan/nextjs-indexing-pack/issues).