import { createInterface } from 'readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { promises as fs } from 'node:fs';

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

async function appendEnvLocal(key: string): Promise<'created' | 'updated' | 'skipped'> {
  const envPath = path.join(process.cwd(), '.env.local');
  const line = `INDEXNOW_KEY=${key}`;

  try {
    const contents = await fs.readFile(envPath, 'utf8');
    if (contents.includes('INDEXNOW_KEY=')) {
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
  console.log('This wizard will help you generate an IndexNow key and prepare your project.\n');

  const rl = createInterface({ input, output });
  try {
    const baseUrl = await promptForBaseUrl(rl);

    const publicDir = path.join(process.cwd(), 'public');
    await ensureDirectory(publicDir);

    const key = generateIndexNowKey();
    const keyFilePath = await writeKeyFile(publicDir, key);

    const shouldUpdateEnv = await confirm(rl, 'Would you like to store the key in .env.local?', true);
    let envStatus: 'created' | 'updated' | 'skipped' | 'declined' = 'declined';
    if (shouldUpdateEnv) {
      envStatus = await appendEnvLocal(key);
    }

    console.log('\n✅ All set!');
    console.log(`• Base URL: ${baseUrl}`);
    console.log(`• Generated IndexNow key: ${key}`);
    console.log(`• Key file created at: ${keyFilePath}`);
    if (shouldUpdateEnv) {
      if (envStatus === 'created') {
        console.log('• Created .env.local with INDEXNOW_KEY.');
      } else if (envStatus === 'updated') {
        console.log('• Updated .env.local with INDEXNOW_KEY.');
      } else {
        console.log('• .env.local already contained INDEXNOW_KEY – no changes made.');
      }
    } else {
      console.log('• Skipped updating .env.local.');
    }

    console.log('\nNext steps:');
    console.log(`1. Ensure ".env.local" (or your secrets store) exposes INDEXNOW_KEY=${key} to your CI/deployment environment.`);
    console.log(`2. After "next build", run: npx nextjs-indexing-pack --base-url "${baseUrl}" --key "$INDEXNOW_KEY"`);
    console.log('   (You can add this as a postbuild script in package.json).');
    console.log(`3. Deploy ${path.relative(process.cwd(), keyFilePath) || `${key}.txt`} so it is publicly accessible at ${baseUrl}/${key}.txt.`);
  } finally {
    rl.close();
  }
}
