/**
 * Interface for indexing configuration options
 */
export interface IndexingOptions {
  /**
   * The title of the page for search engine indexing
   */
  title?: string;
  
  /**
   * Meta description for search engines
   */
  description?: string;
  
  /**
   * Keywords for page indexing
   */
  keywords?: string[];
  
  /**
   * Canonical URL for the page
   */
  canonicalUrl?: string;
  
  /**
   * Whether to allow search engines to index this page
   */
  noIndex?: boolean;
  
  /**
   * Whether to allow search engines to follow links on this page
   */
  noFollow?: boolean;
}

/**
 * Generate meta tags for Next.js pages to improve SEO and indexing
 * 
 * @param options - Configuration options for page indexing
 * @returns Object containing meta tags for Next.js metadata
 * 
 * @example
 * ```tsx
 * import { generateIndexingMetadata } from 'nextjs-indexing-pack';
 * 
 * export const metadata = generateIndexingMetadata({
 *   title: 'My Page Title',
 *   description: 'A description of my page',
 *   keywords: ['nextjs', 'seo', 'indexing']
 * });
 * ```
 */
export function generateIndexingMetadata(options: IndexingOptions) {
  const {
    title,
    description,
    keywords,
    canonicalUrl,
    noIndex = false,
    noFollow = false,
  } = options;

  const robots: string[] = [];
  if (noIndex) robots.push('noindex');
  if (noFollow) robots.push('nofollow');

  const metadata: Record<string, any> = {};

  if (title) {
    metadata.title = title;
  }

  if (description) {
    metadata.description = description;
  }

  if (keywords && keywords.length > 0) {
    metadata.keywords = keywords.join(', ');
  }

  if (canonicalUrl) {
    metadata.alternates = {
      canonical: canonicalUrl,
    };
  }

  if (robots.length > 0) {
    metadata.robots = robots.join(', ');
  }

  return metadata;
}

/**
 * Generate robots meta tag value
 * 
 * @param noIndex - Whether to prevent indexing
 * @param noFollow - Whether to prevent following links
 * @returns Robots meta tag value
 */
export function generateRobotsTag(noIndex: boolean = false, noFollow: boolean = false): string {
  const directives: string[] = [];
  
  if (noIndex) directives.push('noindex');
  else directives.push('index');
  
  if (noFollow) directives.push('nofollow');
  else directives.push('follow');
  
  return directives.join(', ');
}
