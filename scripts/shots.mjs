import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const SHOTS = 'C:/Users/USER/AppData/Local/Temp/claude/C--Users-USER/bd0f6529-5895-4395-8b6a-8dbd61ea7c11/scratchpad/shots/';
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__game, null, { timeout: 15000 });

await page.evaluate(() => window.__game.getState().startGame('local', 0, 'w'));
await page.waitForTimeout(1500);
await page.screenshot({ path: SHOTS + 'v2-board.png' });

// a few moves for last-move highlight + selection state
await page.evaluate(() => {
  const s = window.__game.getState();
  s.clickSquare('e2');
  s.clickSquare('e4');
});
await page.waitForTimeout(300);
await page.evaluate(() => {
  const s = window.__game.getState();
  s.clickSquare('e7');
  s.clickSquare('e5');
});
await page.waitForTimeout(300);
await page.evaluate(() => window.__game.getState().clickSquare('g1'));
await page.waitForTimeout(900);
await page.screenshot({ path: SHOTS + 'v2-selection.png' });

// zoom-ish look: lower camera by scrolling (orbit zoom in)
await page.mouse.move(640, 400);
await page.mouse.wheel(0, -400);
await page.waitForTimeout(300);
await page.mouse.wheel(0, -400);
await page.waitForTimeout(800);
await page.screenshot({ path: SHOTS + 'v2-close.png' });

// mobile viewport check
await page.setViewportSize({ width: 390, height: 780 });
await page.waitForTimeout(800);
await page.screenshot({ path: SHOTS + 'v2-mobile.png' });

await browser.close();
console.log('shots done');
