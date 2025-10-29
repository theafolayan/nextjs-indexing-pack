/**
 * nextjs-indexing-pack
 *
 * Utility helpers for collecting Next.js routes and submitting them to IndexNow-compatible search engines.
 */
export type {
  SubmitToIndexNowOptions,
  SubmitToIndexNowResult,
} from './indexnow';
export { collectIndexableRoutes, submitToIndexNow } from './indexnow';
export type { SubmitToGoogleIndexingOptions, SubmitToGoogleIndexingResult } from './google-indexing';
export { submitToGoogleIndexing } from './google-indexing';
