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
