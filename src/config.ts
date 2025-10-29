import path from 'node:path';
import { promises as fs } from 'node:fs';

export const CONFIG_FILENAME = 'nextjs-indexing-pack.config.json';

export interface NextjsIndexingPackConfig {
  baseUrl?: string;
}

export function getConfigPath(): string {
  return path.join(process.cwd(), CONFIG_FILENAME);
}

export async function loadConfig(): Promise<NextjsIndexingPackConfig | undefined> {
  try {
    const contents = await fs.readFile(getConfigPath(), 'utf8');
    const parsed = JSON.parse(contents);
    if (!parsed || typeof parsed !== 'object') {
      console.warn('Ignoring malformed nextjs-indexing-pack config (expected an object).');
      return undefined;
    }
    const config: NextjsIndexingPackConfig = {};
    if (typeof parsed.baseUrl === 'string') {
      config.baseUrl = parsed.baseUrl;
    } else if (parsed.baseUrl !== undefined) {
      console.warn('Ignoring invalid "baseUrl" in nextjs-indexing-pack config (expected a string).');
    }
    return config;
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return undefined;
    }
    console.warn('Unable to load nextjs-indexing-pack config:', error?.message ?? error);
    return undefined;
  }
}

export async function saveConfig(config: NextjsIndexingPackConfig): Promise<'created' | 'updated'> {
  const configPath = getConfigPath();
  let status: 'created' | 'updated' = 'created';
  try {
    await fs.access(configPath);
    status = 'updated';
  } catch (error: any) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }

  const contents = `${JSON.stringify(config, null, 2)}\n`;
  await fs.writeFile(configPath, contents, 'utf8');
  return status;
}
