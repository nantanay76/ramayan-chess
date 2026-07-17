// Rasterize public/icon.svg into the PNG set Chrome's install prompt wants.
// Run once (npm run icons) and commit the PNGs — not part of the build.
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const pub = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const svg = readFileSync(join(pub, 'icon.svg'), 'utf8');

let browser;
for (const channel of ['chrome', 'msedge']) {
  try {
    browser = await chromium.launch({ channel, headless: true });
    break;
  } catch {}
}
if (!browser) { console.log('NO BROWSER'); process.exit(1); }

// bg = null keeps the SVG's rounded corners transparent (purpose "any");
// maskable/apple get the icon's own plum so any mask shape crops cleanly.
async function shot(file, size, bg) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<style>html,body{margin:0;background:${bg ?? 'transparent'}}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  await page.screenshot({ path: join(pub, file), omitBackground: !bg });
  await page.close();
  console.log(file);
}

await shot('icon-192.png', 192, null);
await shot('icon-512.png', 512, null);
await shot('icon-maskable-512.png', 512, '#3a1120');
await shot('apple-touch-icon.png', 180, '#3a1120');
await browser.close();
console.log('DONE');
