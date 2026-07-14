import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const URL = 'http://localhost:5173/';
const OUT = (process.env.SHOTS_OUT || process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), '..', '.shots')) + '/';
mkdirSync(OUT, { recursive: true });

let browser;
for (const channel of ['chrome', 'msedge']) {
  try {
    browser = await chromium.launch({ channel, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    break;
  } catch {}
}
if (!browser) { console.log('NO BROWSER'); process.exit(1); }

const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__game, null, { timeout: 15000 });
await page.screenshot({ path: OUT + 's1-menu.png' });

await page.evaluate(() => window.__game.getState().startGame('local', 0, 'w'));
await page.waitForTimeout(4000);
await page.screenshot({ path: OUT + 's2-board.png' });

// select a piece to see highlights
await page.evaluate(() => window.__game.getState().clickSquare('e2'));
await page.waitForTimeout(400);
await page.screenshot({ path: OUT + 's3-selected.png' });

// flip: mid-animation and settled
await page.evaluate(() => { window.__game.getState().clearSelection(); window.__game.getState().flipBoard(); });
await page.waitForTimeout(380);
await page.screenshot({ path: OUT + 's4-flip-mid.png' });
await page.waitForTimeout(900);
await page.screenshot({ path: OUT + 's5-flipped.png' });
await page.evaluate(() => window.__game.getState().flipBoard());
await page.waitForTimeout(1200);

console.log('errors:', errs.length ? errs.slice(0, 8) : 'none');
await browser.close();

// portrait pass
const b2 = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p2 = await b2.newPage({ viewport: { width: 390, height: 844 } });
await p2.goto(URL, { waitUntil: 'domcontentloaded' });
await p2.waitForFunction(() => !!window.__game, null, { timeout: 15000 });
await p2.evaluate(() => window.__game.getState().startGame('local', 0, 'w'));
await p2.waitForTimeout(4000);
await p2.screenshot({ path: OUT + 's6-portrait.png' });
await b2.close();
console.log('DONE');
