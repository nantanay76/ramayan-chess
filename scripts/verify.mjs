import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const URL = 'http://localhost:5173/';
const SHOTS = 'C:/Users/USER/AppData/Local/Temp/claude/C--Users-USER/bd0f6529-5895-4395-8b6a-8dbd61ea7c11/scratchpad/shots/';
mkdirSync(SHOTS, { recursive: true });

const results = [];
const pass = (name) => { results.push(['PASS', name]); console.log('PASS', name); };
const fail = (name, why) => { results.push(['FAIL', name + ' — ' + why]); console.log('FAIL', name, '—', why); };

let browser;
for (const channel of ['chrome', 'msedge']) {
  try {
    browser = await chromium.launch({ channel, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    console.log('launched', channel);
    break;
  } catch (e) {
    console.log('cannot launch', channel, e.message.split('\n')[0]);
  }
}
if (!browser) { console.log('NO BROWSER'); process.exit(1); }

const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') pageErrors.push('console: ' + m.text()); });

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__game, null, { timeout: 15000 });

await page.evaluate(() => {
  window.__play = (from, to) => {
    const s = window.__game.getState();
    s.clickSquare(from);
    s.clickSquare(to);
  };
  window.__state = () => {
    const s = window.__game.getState();
    return {
      hist: s.history.length,
      sans: s.history.map((m) => m.san),
      over: s.gameOver,
      thinking: s.thinking,
      turn: s.turn,
      pieces: s.pieces.length,
      capW: s.capturedByWhite.length,
      capB: s.capturedByBlack.length,
      pending: !!s.promotionPending,
      err: s.engineError,
    };
  };
});

await page.screenshot({ path: SHOTS + '01-menu.png' });

// ---------- Test 1: local hotseat, scholar's mate ----------
await page.evaluate(() => window.__game.getState().startGame('local', 0, 'w'));
await page.waitForTimeout(1200);
await page.screenshot({ path: SHOTS + '02-board.png' });
await page.evaluate(() => {
  for (const [f, t] of [['e2','e4'],['e7','e5'],['f1','c4'],['b8','c6'],['d1','h5'],['g8','f6'],['h5','f7']]) window.__play(f, t);
});
{
  const s = await page.evaluate(() => window.__state());
  if (s.over && s.over.reason === 'checkmate' && s.over.winner === 'w' && s.hist === 7 && s.pieces === 31)
    pass('local scholar\'s mate → checkmate detected, capture tracked');
  else fail('local scholar\'s mate', JSON.stringify(s));
}
await page.waitForTimeout(900);
await page.screenshot({ path: SHOTS + '03-checkmate.png' });

// ---------- Test 2: castling ----------
await page.evaluate(() => {
  window.__game.getState().startGame('local', 0, 'w');
  for (const [f, t] of [['e2','e4'],['e7','e5'],['g1','f3'],['b8','c6'],['f1','c4'],['f8','c5'],['e1','g1']]) window.__play(f, t);
});
{
  const s = await page.evaluate(() => window.__state());
  if (s.sans[6] === 'O-O' && s.pieces === 32) pass('kingside castling (rook tracked)');
  else fail('castling', JSON.stringify(s));
}

// ---------- Test 3: en passant ----------
await page.evaluate(() => {
  window.__game.getState().startGame('local', 0, 'w');
  for (const [f, t] of [['e2','e4'],['a7','a6'],['e4','e5'],['d7','d5'],['e5','d6']]) window.__play(f, t);
});
{
  const s = await page.evaluate(() => window.__state());
  if (s.sans[4] === 'exd6' && s.capW === 1 && s.pieces === 31) pass('en passant capture tracked');
  else fail('en passant', JSON.stringify(s));
}

// ---------- Test 4: promotion via picker ----------
await page.evaluate(() => {
  window.__game.getState().startGame('local', 0, 'w');
  for (const [f, t] of [['a2','a4'],['b7','b5'],['a4','b5'],['a7','a6'],['b5','a6'],['b8','c6'],['a6','a7'],['a8','b8'],['a7','b8']]) window.__play(f, t);
});
{
  const s1 = await page.evaluate(() => window.__state());
  const pendingOk = s1.pending;
  await page.evaluate(() => window.__game.getState().choosePromotion('q'));
  const s2 = await page.evaluate(() => window.__state());
  if (pendingOk && /=Q/.test(s2.sans[8] || '')) pass('promotion picker → ' + s2.sans[8]);
  else fail('promotion', JSON.stringify({ s1, s2 }));
}

// ---------- Test 5: AI level 500 (engine load + blunder path) ----------
await page.evaluate(() => window.__game.getState().startGame('ai', 0, 'w'));
await page.waitForFunction(() => { const s = window.__game.getState(); return !s.thinking || s.engineError; }, null, { timeout: 60000 });
await page.evaluate(() => window.__play('e2', 'e4'));
try {
  await page.waitForFunction(() => {
    const s = window.__game.getState();
    return (s.history.length >= 2 && !s.thinking) || s.engineError;
  }, null, { timeout: 60000 });
  const s = await page.evaluate(() => window.__state());
  if (!s.err && s.hist === 2 && s.turn === 'w') pass('AI 500 replied: ' + s.sans[1]);
  else fail('AI 500', JSON.stringify(s));
} catch (e) {
  fail('AI 500', 'timeout waiting for engine reply');
}
await page.screenshot({ path: SHOTS + '04-ai500.png' });

// undo vs AI: should rewind both plies
await page.evaluate(() => window.__game.getState().undoMove());
{
  const s = await page.evaluate(() => window.__state());
  if (s.hist === 0 && s.turn === 'w') pass('undo vs AI rewinds full round');
  else fail('undo vs AI', JSON.stringify(s));
}

// ---------- Test 6: AI level 1700 (native UCI_Elo) ----------
await page.evaluate(() => window.__game.getState().startGame('ai', 4, 'w'));
await page.waitForFunction(() => !window.__game.getState().thinking, null, { timeout: 60000 });
await page.evaluate(() => window.__play('d2', 'd4'));
try {
  await page.waitForFunction(() => {
    const s = window.__game.getState();
    return (s.history.length >= 2 && !s.thinking) || s.engineError;
  }, null, { timeout: 60000 });
  const s = await page.evaluate(() => window.__state());
  if (!s.err && s.hist === 2) pass('AI 1700 (UCI_Elo) replied: ' + s.sans[1]);
  else fail('AI 1700', JSON.stringify(s));
} catch { fail('AI 1700', 'timeout'); }

// ---------- Test 7: AI level 3200 (full strength) ----------
await page.evaluate(() => window.__game.getState().startGame('ai', 9, 'w'));
await page.waitForFunction(() => !window.__game.getState().thinking, null, { timeout: 60000 });
await page.evaluate(() => window.__play('g1', 'f3'));
try {
  await page.waitForFunction(() => {
    const s = window.__game.getState();
    return (s.history.length >= 2 && !s.thinking) || s.engineError;
  }, null, { timeout: 90000 });
  const s = await page.evaluate(() => window.__state());
  if (!s.err && s.hist === 2) pass('AI 3200 (full Stockfish) replied: ' + s.sans[1]);
  else fail('AI 3200', JSON.stringify(s));
} catch { fail('AI 3200', 'timeout'); }
await page.screenshot({ path: SHOTS + '05-ai3200.png' });

// ---------- Test 8: AI plays white when player picks black ----------
await page.evaluate(() => window.__game.getState().startGame('ai', 1, 'b'));
try {
  await page.waitForFunction(() => {
    const s = window.__game.getState();
    return (s.history.length >= 1 && !s.thinking) || s.engineError;
  }, null, { timeout: 60000 });
  const s = await page.evaluate(() => window.__state());
  if (!s.err && s.hist >= 1 && s.turn === 'b') pass('player as black → AI opened with ' + s.sans[0]);
  else fail('AI opens as white', JSON.stringify(s));
} catch { fail('AI opens as white', 'timeout'); }
await page.screenshot({ path: SHOTS + '06-black-view.png' });

console.log('\npage errors:', pageErrors.length ? pageErrors.slice(0, 10) : 'none');
console.log('\n==== SUMMARY ====');
for (const [s, n] of results) console.log(s, '-', n);
const failed = results.filter(([s]) => s === 'FAIL').length;
console.log(failed === 0 ? 'ALL TESTS PASSED' : failed + ' TESTS FAILED');

await browser.close();
process.exit(failed === 0 ? 0 : 1);
