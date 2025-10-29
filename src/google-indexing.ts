import { createSign } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { collectIndexableRoutes } from './indexnow';

const GOOGLE_INDEXING_SCOPE = 'https://www.googleapis.com/auth/indexing';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_INDEXING_ENDPOINT = 'https://indexing.googleapis.com/v3/urlNotifications:publish';

type GoogleNotificationType = 'URL_UPDATED' | 'URL_DELETED';

export interface SubmitToGoogleIndexingOptions {
  /**
   * Fully qualified base URL of your Next.js application (e.g. https://example.com)
   */
  baseUrl: string;
  /**
   * Absolute or relative path to the Google service account JSON credentials.
   */
  serviceAccountPath: string;
  /**
   * Directory that contains the compiled Next.js output. Defaults to `.next`.
   */
  nextBuildDir?: string;
  /**
   * Optional filter that can be used to remove URLs from the submission payload.
   */
  urlFilter?: (url: string) => boolean;
  /**
   * When true, URLs are collected but not submitted. Useful for testing locally.
   */
  dryRun?: boolean;
  /**
   * Notification type sent to the Indexing API. Defaults to `URL_UPDATED`.
   */
  notificationType?: GoogleNotificationType;
  /**
   * Optional explicit list of URLs to submit instead of discovering them from the Next.js build output.
   */
  urls?: string[];
}

export interface SubmitToGoogleIndexingResult {
  /** URLs that were discovered in the Next.js build output */
  urls: string[];
  /** Result of the submission attempt for each URL */
  responses: Array<{ url: string; status: number; ok: boolean; body?: string }>;
}

interface ServiceAccount {
  clientEmail: string;
  privateKey: string;
  tokenUri: string;
}

function base64UrlEncode(input: Buffer | string): string {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function normalizeBaseUrl(baseUrl: string): string {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error(`\`baseUrl\` must be a fully qualified URL (for example, https://example.com). Received: ${baseUrl}`);
  }
  const pathname = url.pathname.endsWith('/') && url.pathname !== '/' ? url.pathname.slice(0, -1) : url.pathname;
  return `${url.origin}${pathname === '/' ? '' : pathname}`;
}

async function readServiceAccount(filePath: string): Promise<ServiceAccount> {
  const resolvedPath = path.resolve(filePath);
  const contents = await fs.readFile(resolvedPath, 'utf8');
  let parsed: any;
  try {
    parsed = JSON.parse(contents);
  } catch (error) {
    throw new Error(`Failed to parse Google service account JSON at ${resolvedPath}: ${(error as Error).message}`);
  }

  const clientEmail = parsed?.client_email;
  const privateKey = parsed?.private_key;
  const tokenUri = parsed?.token_uri ?? GOOGLE_TOKEN_URL;

  if (typeof clientEmail !== 'string' || !clientEmail) {
    throw new Error(`Google service account JSON at ${resolvedPath} is missing "client_email".`);
  }
  if (typeof privateKey !== 'string' || !privateKey) {
    throw new Error(`Google service account JSON at ${resolvedPath} is missing "private_key".`);
  }
  if (typeof tokenUri !== 'string' || !tokenUri) {
    throw new Error(`Google service account JSON at ${resolvedPath} is missing "token_uri".`);
  }

  return { clientEmail, privateKey, tokenUri };
}

async function createAccessToken(serviceAccount: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.clientEmail,
    scope: GOOGLE_INDEXING_SCOPE,
    aud: serviceAccount.tokenUri,
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const message = `${encodedHeader}.${encodedPayload}`;

  const signer = createSign('RSA-SHA256');
  signer.update(message);
  signer.end();
  const signature = signer.sign(serviceAccount.privateKey);
  const encodedSignature = base64UrlEncode(signature);
  const assertion = `${message}.${encodedSignature}`;

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });

  const response = await fetch(serviceAccount.tokenUri, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Google OAuth token request failed with status ${response.status}: ${text || 'no response body'}`);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`Failed to parse Google OAuth token response: ${(error as Error).message}`);
  }

  const accessToken = parsed?.access_token;
  if (typeof accessToken !== 'string' || !accessToken) {
    throw new Error('Google OAuth token response did not include an "access_token".');
  }

  return accessToken;
}

export async function submitToGoogleIndexing(
  options: SubmitToGoogleIndexingOptions,
): Promise<SubmitToGoogleIndexingResult> {
  const {
    baseUrl,
    serviceAccountPath,
    nextBuildDir = '.next',
    urlFilter,
    dryRun,
    notificationType = 'URL_UPDATED',
    urls: explicitUrls,
  } = options;

  if (!baseUrl) {
    throw new Error('`baseUrl` must be provided.');
  }
  if (!serviceAccountPath) {
    throw new Error('`serviceAccountPath` must be provided.');
  }

  const normalizedBase = normalizeBaseUrl(baseUrl);

  let urls: string[];
  if (explicitUrls?.length) {
    const seen = new Set<string>();
    urls = [];
    for (const urlToSubmit of explicitUrls) {
      if (!urlToSubmit) continue;
      let parsed: URL;
      try {
        parsed = new URL(urlToSubmit);
      } catch {
        throw new Error(`Invalid URL provided to submitToGoogleIndexing: ${urlToSubmit}`);
      }
      const normalizedUrl = parsed.toString();
      if (urlFilter && !urlFilter(normalizedUrl)) {
        continue;
      }
      if (seen.has(normalizedUrl)) {
        continue;
      }
      seen.add(normalizedUrl);
      urls.push(normalizedUrl);
    }
  } else {
    const routes = await collectIndexableRoutes(nextBuildDir);
    urls = routes
      .map((route) => (route === '/' ? normalizedBase : `${normalizedBase}${route}`))
      .filter((routeUrl) => (urlFilter ? urlFilter(routeUrl) : true));
  }

  const result: SubmitToGoogleIndexingResult = {
    urls,
    responses: [],
  };

  if (dryRun) {
    return result;
  }

  const serviceAccount = await readServiceAccount(serviceAccountPath);
  const accessToken = await createAccessToken(serviceAccount);

  for (const urlToNotify of urls) {
    try {
      const response = await fetch(GOOGLE_INDEXING_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          url: urlToNotify,
          type: notificationType,
        }),
      });
      const bodyText = await response.text();
      result.responses.push({
        url: urlToNotify,
        status: response.status,
        ok: response.ok,
        body: bodyText || undefined,
      });
    } catch (error: any) {
      result.responses.push({
        url: urlToNotify,
        status: 0,
        ok: false,
        body: error?.message,
      });
    }
  }

  return result;
}
