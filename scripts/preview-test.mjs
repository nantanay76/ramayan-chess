// Smoke test against the PRODUCTION build (npm run preview must be running).
// Drives the real UI: picks level 500, plays as Lanka, and waits for the
// engine (as white) to make the first move — proving WASM works in prod.
import { chromium } from 'playwright-core';

const SHOTS = 'C:/Users/USER/AppData/Local/Temp/claude/C--Users-USER/bd0f6529-5895-4395-8b6a-8dbd61ea7c11/scratchpad/shots/';
const URL = process.argv[2] ?? 'http://localhost:4173/';

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.getByText('Vs Computer').waitFor({ timeout: 15000 });
await page.locator('.chip').first().click(); // 500 Shishya
await page.getByText("Lanka's Army").click();
await page.getByText('Begin the Battle').click();
await page.locator('.move-row').first().waitFor({ timeout: 90000 });
const firstMove = await page.locator('.move-row').first().innerText();
await page.waitForTimeout(1000);
await page.screenshot({ path: SHOTS + 'prod-smoke.png' });

console.log('PROD OK — engine opened with:', firstMove.replace(/\s+/g, ' ').trim());
console.log('page errors:', errors.length ? errors : 'none');
await browser.close();
process.exit(errors.length ? 1 : 0);
