import { createInterface } from 'readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { CONFIG_FILENAME, saveConfig } from './config';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function generateIndexNowKey(): string {
  // 16 random bytes yields a 32 character hex string which satisfies IndexNow requirements (8-128 chars).
  return randomBytes(16).toString('hex');
}

async function ensureDirectory(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

async function writeKeyFile(publicDir: string, key: string): Promise<string> {
  const filePath = path.join(publicDir, `${key}.txt`);
  await fs.writeFile(filePath, key, 'utf8');
  return filePath;
}

async function appendEnvLocalEntry(key: string, value: string): Promise<'created' | 'updated' | 'skipped'> {
  const envPath = path.join(process.cwd(), '.env.local');
  const line = `${key}=${value}`;
  const keyPattern = new RegExp(`^${escapeRegExp(key)}=`, 'm');

  try {
    const contents = await fs.readFile(envPath, 'utf8');
    if (keyPattern.test(contents)) {
      return 'skipped';
    }
    const updated = contents.endsWith('\n') ? `${contents}${line}\n` : `${contents}\n${line}\n`;
    await fs.writeFile(envPath, updated, 'utf8');
    return 'updated';
  } catch (error: any) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
    await fs.writeFile(envPath, `${line}\n`, 'utf8');
    return 'created';
  }
}

async function createDummyGoogleServiceAccount(filePath: string): Promise<'created' | 'skipped'> {
  try {
    await fs.access(filePath);
    return 'skipped';
  } catch (error: any) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }

  const dummy = {
    type: 'service_account',
    project_id: 'your-project-id',
    private_key_id: 'dummy-private-key-id',
    private_key: '-----BEGIN PRIVATE KEY-----\\nYOUR_PRIVATE_KEY_HERE\\n-----END PRIVATE KEY-----\\n',
    client_email: 'your-service-account@your-project-id.iam.gserviceaccount.com',
    client_id: '000000000000000000000',
    token_uri: 'https://oauth2.googleapis.com/token',
  };

  const contents = `${JSON.stringify(dummy, null, 2)}\n`;
  await fs.writeFile(filePath, contents, 'utf8');
  return 'created';
}

async function confirm(rl: ReturnType<typeof createInterface>, message: string, defaultValue = true): Promise<boolean> {
  while (true) {
    const suffix = defaultValue ? 'Y/n' : 'y/N';
    const answer = (await rl.question(`${message} (${suffix}) `)).trim().toLowerCase();
    if (!answer) {
      return defaultValue;
    }
    if (answer === 'y' || answer === 'yes') {
      return true;
    }
    if (answer === 'n' || answer === 'no') {
      return false;
    }
    console.log('Please answer with "y" or "n".');
  }
}

async function promptForBaseUrl(rl: ReturnType<typeof createInterface>): Promise<string> {
  while (true) {
    const answer = (await rl.question('What is the base URL of your deployed Next.js site? ')).trim();
    if (!answer) {
      console.log('Please provide a URL, for example https://www.example.com.');
      continue;
    }

    try {
      const url = new URL(answer);
      if (!url.protocol.startsWith('http')) {
        throw new Error('URL must use http or https.');
      }
      const pathname = url.pathname.endsWith('/') && url.pathname !== '/' ? url.pathname.slice(0, -1) : url.pathname;
      return `${url.origin}${pathname === '/' ? '' : pathname}`;
    } catch (error) {
      console.log('That does not look like a valid URL. Include the protocol, for example https://www.example.com.');
    }
  }
}

export async function runInit(): Promise<void> {
  console.log('🛠️  nextjs-indexing-pack init');
  console.log('This wizard will help you generate an IndexNow key, prepare Google Indexing credentials, and configure your project.\n');

  const rl = createInterface({ input, output });
  try {
    const baseUrl = await promptForBaseUrl(rl);

    const publicDir = path.join(process.cwd(), 'public');
    await ensureDirectory(publicDir);

    const key = generateIndexNowKey();
    const keyFilePath = await writeKeyFile(publicDir, key);

    const googleServiceAccountPath = path.join(process.cwd(), 'google-service-account.json');
    const googleServiceAccountStatus = await createDummyGoogleServiceAccount(googleServiceAccountPath);

    const relativeGooglePath = path.relative(process.cwd(), googleServiceAccountPath);
    const normalizedGooglePath = relativeGooglePath
      ? relativeGooglePath.startsWith('.')
        ? relativeGooglePath
        : `./${relativeGooglePath}`
      : `./${path.basename(googleServiceAccountPath)}`;

    const configStatus = await saveConfig({ baseUrl, googleServiceAccountPath: normalizedGooglePath });

    const shouldUpdateEnv = await confirm(rl, 'Would you like to store the key in .env.local?', true);
    let envStatuses: Record<string, 'created' | 'updated' | 'skipped'> | 'declined' = 'declined';
    if (shouldUpdateEnv) {
      envStatuses = {
        INDEXNOW_KEY: await appendEnvLocalEntry('INDEXNOW_KEY', key),
        GOOGLE_APPLICATION_CREDENTIALS: await appendEnvLocalEntry('GOOGLE_APPLICATION_CREDENTIALS', normalizedGooglePath),
      };
    }

    console.log('\n✅ All set!');
    console.log(`• Base URL: ${baseUrl}`);
    console.log(`• Generated IndexNow key: ${key}`);
    console.log(`• Key file created at: ${keyFilePath}`);
    if (googleServiceAccountStatus === 'created') {
      console.log(`• Created dummy Google service account credentials at: ${googleServiceAccountPath}`);
    } else {
      console.log(`• Re-used existing Google service account credentials at: ${googleServiceAccountPath}`);
    }
    if (configStatus === 'created') {
      console.log(`• Created ${CONFIG_FILENAME} with your base URL.`);
    } else {
      console.log(`• Updated ${CONFIG_FILENAME} with your base URL and Google credentials path.`);
    }
    if (shouldUpdateEnv) {
      const indexNowStatus = (envStatuses as Record<string, 'created' | 'updated' | 'skipped'>).INDEXNOW_KEY;
      if (indexNowStatus === 'created') {
        console.log('• Created .env.local with INDEXNOW_KEY.');
      } else if (indexNowStatus === 'updated') {
        console.log('• Updated .env.local with INDEXNOW_KEY.');
      } else {
        console.log('• .env.local already contained INDEXNOW_KEY – no changes made.');
      }

      const googleStatus = (envStatuses as Record<string, 'created' | 'updated' | 'skipped'>).GOOGLE_APPLICATION_CREDENTIALS;
      if (googleStatus === 'created') {
        console.log('• Added GOOGLE_APPLICATION_CREDENTIALS to .env.local.');
      } else if (googleStatus === 'updated') {
        console.log('• Updated GOOGLE_APPLICATION_CREDENTIALS in .env.local.');
      } else {
        console.log('• .env.local already contained GOOGLE_APPLICATION_CREDENTIALS – no changes made.');
      }
    } else {
      console.log('• Skipped updating .env.local.');
    }

    console.log('\nNext steps:');
    console.log(`1. Ensure ".env.local" (or your secrets store) exposes INDEXNOW_KEY=${key} to your CI/deployment environment.`);
    console.log(`2. Ensure ".env.local" (or your secrets store) exposes GOOGLE_APPLICATION_CREDENTIALS=${normalizedGooglePath}.`);
    console.log('3. After "next build", run: npx nextjs-indexing-pack');
    console.log('   (The CLI reads INDEXNOW_KEY and Google credentials from your environment and your base URL from the config file).');
    console.log(`4. Deploy ${path.relative(process.cwd(), keyFilePath) || `${key}.txt`} so it is publicly accessible at ${baseUrl}/${key}.txt.`);
    console.log('5. Replace the dummy Google service account file with real credentials that have access to the Indexing API.');
  } finally {
    rl.close();
  }
}
