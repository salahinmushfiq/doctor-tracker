/**
 * Captures screenshots of the running app at phone/tablet/desktop widths and checks for horizontal overflow.
 *
 *   npx playwright install chromium        (once)
 *   BASE_URL=http://localhost:3000 EMAIL=you@example.com PASSWORD='...' node scripts/capture-screenshots.mjs
 *
 * Output: ../screenshots/<width>/<page>.png and a console report. Run it against a database that holds ONLY synthetic data
 * (npm run seed:demo). Exit code is 1 if any page overflows horizontally or a step fails.
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
const EMAIL = process.env.EMAIL;
const PASSWORD = process.env.PASSWORD;
const OUT = path.resolve(process.env.OUT_DIR ?? '../screenshots');
const EXECUTABLE = process.env.CHROMIUM_PATH || undefined;
if (!EMAIL || !PASSWORD) {
  console.error('Set EMAIL and PASSWORD (an account created with `npm run seed:admin`).');
  process.exit(2);
}

const WIDTHS = [
  { name: '375-phone', width: 375, height: 812 },
  { name: '768-tablet', width: 768, height: 1024 },
  { name: '1280-desktop', width: 1280, height: 800 },
];
const problems = [];
const rows = [];

const browser = await chromium.launch({ executablePath: EXECUTABLE });

async function run({ name, width, height: viewportHeight }) {
  const context = await browser.newContext({ viewport: { width, height: viewportHeight }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const consoleErrors = [];
  // The 401 from the signed-out /auth/me probe on the login page is expected; anything else is reported.
  let signedIn = false;
  page.on('console', (m) => m.type() === 'error' && !(m.text().includes('401') && !signedIn) && consoleErrors.push(m.text()));
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  await mkdir(path.join(OUT, name), { recursive: true });

  const shot = async (label, { fullPage = true } = {}) => {
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(400);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    rows.push({ viewport: name, page: label, overflowPx: overflow });
    if (overflow > 1) problems.push(`${name} / ${label}: horizontal overflow of ${overflow}px`);
    if (fullPage) {
      // Resize the window to the page height instead of using Playwright's fullPage mode: that mode resizes the viewport
      // mid-capture, which leaves Recharts charts half-animated and tiny.
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      await page.setViewportSize({ width, height: Math.min(Math.max(height, viewportHeight), 6000) });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(OUT, name, `${label}.png`) });
      await page.setViewportSize({ width, height: viewportHeight });
    } else {
      await page.screenshot({ path: path.join(OUT, name, `${label}.png`) });
    }
  };

  try {
    // login page (also: validation state)
    await page.goto(`${BASE}/login`);
    await page.getByRole('button', { name: 'Sign in' }).waitFor();
    await shot('01-login');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByText('Enter your email address').waitFor();
    await shot('02-login-validation');

    await page.getByLabel(/email/i).fill(EMAIL);
    await page.getByLabel(/password/i).fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('**/dashboard', { timeout: 60_000 });
    signedIn = true;
    await page.getByRole('heading', { name: 'Dashboard' }).waitFor({ timeout: 60_000 });
    await shot('03-dashboard');

    // session must survive a reload (cookie + /auth/me)
    await page.reload();
    await page.getByRole('heading', { name: 'Dashboard' }).waitFor({ timeout: 60_000 });
    rows.push({ viewport: name, page: 'session-survives-reload', overflowPx: 0 });

    await page.goto(`${BASE}/doctors`);
    await page.getByRole('heading', { name: 'Doctors' }).waitFor();
    await shot('04-doctors');
    await page.getByLabel('Search doctors').fill('dr');
    await page.waitForURL(/search=dr/, { timeout: 10_000 });
    await shot('05-doctors-search');

    await page.goto(`${BASE}/doctors`);
    await page.locator('a[href^="/doctors/"]:not([href="/doctors/new"])').locator('visible=true').first().click();
    await page.waitForURL(/\/doctors\/[0-9a-f]{24}$/);
    await page.getByRole('heading', { level: 1 }).waitFor();
    await shot('06-doctor-detail');

    await page.goto(`${BASE}/patients`);
    await page.getByRole('heading', { name: 'Patients' }).waitFor();
    await shot('07-patients');
    await page.locator('a[href^="/patients/"]:not([href="/patients/new"])').locator('visible=true').first().click();
    await page.waitForURL(/\/patients\/[0-9a-f]{24}$/);
    await page.getByRole('heading', { level: 1 }).waitFor();
    await shot('08-patient-detail');

    await page.goto(`${BASE}/patients/new`);
    await page.getByRole('button', { name: /save|add|create/i }).first().click();
    await shot('09-patient-form-validation');

    await page.goto(`${BASE}/doctors?search=zzzzzz-no-match`);
    await page.getByText('No doctors match your search').waitFor();
    await shot('10-empty-state');
  } catch (err) {
    problems.push(`${name}: ${err.message.split('\n')[0]}`);
    await page.screenshot({ path: path.join(OUT, name, 'FAILED.png'), fullPage: true }).catch(() => {});
  }
  if (consoleErrors.length) problems.push(`${name}: ${consoleErrors.length} console error(s), first: ${consoleErrors[0].slice(0, 160)}`);
  await context.close();
}

for (const v of WIDTHS) await run(v);
await browser.close();

console.log('\nviewport / page / horizontal overflow (px)');
for (const r of rows) console.log(`${r.viewport.padEnd(14)} ${r.page.padEnd(28)} ${r.overflowPx}`);
console.log(problems.length ? `\nPROBLEMS (${problems.length}):\n- ${problems.join('\n- ')}` : '\nAll pages captured; no horizontal overflow; no console errors.');
console.log(`Screenshots: ${OUT}`);
process.exit(problems.length ? 1 : 0);
