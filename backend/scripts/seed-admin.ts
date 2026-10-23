/**
 * Create (or reset the password of) a dashboard account. This CLI is the ONLY way accounts are created:
 * the API deliberately exposes no register endpoint.
 *
 *   npm run seed:admin -- --email admin@example.com --name "Admin"            (prompts for the password)
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run seed:admin                       (non-interactive / CI)
 *   npm run seed:admin -- --email viewer@example.com --role viewer
 *   npm run seed:admin -- --email admin@example.com --reset-password
 *
 * Passing the password as a CLI flag is supported but discouraged (shell history); prefer the prompt or env.
 */
import readline from 'node:readline';
import { connectDatabase, disconnectDatabase } from '../src/config/db';
import { User } from '../src/models/User';
import { assertStrongPassword, hashPassword } from '../src/utils/password';
import { emailSchema } from '../src/validators/common';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const write = (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput;
    let muted = false;
    (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s: string) => {
      if (!muted) write.call(rl, s);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
    muted = true;
  });
}

async function main() {
  const email = emailSchema.parse(arg('email') ?? process.env.ADMIN_EMAIL);
  const name = (arg('name') ?? process.env.ADMIN_NAME ?? 'Administrator').trim();
  const role = (arg('role') ?? 'admin') as 'admin' | 'viewer';
  if (role !== 'admin' && role !== 'viewer') throw new Error('--role must be "admin" or "viewer"');

  let password = arg('password') ?? process.env.ADMIN_PASSWORD;
  if (!password) {
    if (!process.stdin.isTTY) throw new Error('No password provided. Set ADMIN_PASSWORD or run interactively.');
    password = await promptHidden('Password (min 12 chars, upper+lower+digit): ');
  }
  assertStrongPassword(password);

  await connectDatabase();
  try {
    const existing = await User.findOne({ email });
    if (existing && !flag('reset-password')) {
      console.log(`A user with e-mail ${email} already exists. Use --reset-password to change the password.`);
      return;
    }
    const passwordHash = await hashPassword(password);
    if (existing) {
      existing.passwordHash = passwordHash;
      existing.tokenVersion += 1; // log out every existing session
      await existing.save();
      console.log(`Password reset for ${email}; existing sessions were revoked.`);
    } else {
      await User.create({ email, name, role, passwordHash });
      console.log(`Created ${role} account ${email}.`);
    }
  } finally {
    await disconnectDatabase();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
