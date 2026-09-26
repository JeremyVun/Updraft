// Render promo text overlays as transparent PNGs in the game's serif, from HTML, without the GPU.
// Usage: node tools/promo-text.mjs <cards.json> <outDir>; the promo cards are tools/promo/cards.json.
//   cards.json: [{ "name": "wind", "size": [1920, 1080], "html": "<p class=line>You play the wind.</p>", "css": "..." }]
//   Classes: .title, .line, .small, .url; `top` in the card places the block's centre (fraction of height).
import fs from 'node:fs';
import { chromium } from 'playwright-core';

const [file, out] = process.argv.slice(2);
if (!file || !out) { console.error('usage: node tools/promo-text.mjs <cards.json> <outDir>'); process.exit(1); }
const cards = JSON.parse(fs.readFileSync(file, 'utf8'));
fs.mkdirSync(out, { recursive: true });
const BASE = `
  html, body { margin: 0; background: transparent; }
  .block { position: absolute; left: 0; right: 0; transform: translateY(-50%); text-align: center; color: #fff7ea;
    font-family: 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif;
    text-shadow: 0 0 calc(var(--u) * 28) rgba(20, 24, 30, .42), 0 calc(var(--u) * 1.5) calc(var(--u) * 4) rgba(20, 24, 30, .35); }
  p { margin: 0; }
  .title { font-size: calc(var(--u) * 132); letter-spacing: .07em; line-height: 1.1; }
  .line { font-size: calc(var(--u) * 46); letter-spacing: .025em; line-height: 1.35; }
  .small { font-size: calc(var(--u) * 38); font-style: italic; letter-spacing: .04em; line-height: 1.4; margin-top: calc(var(--u) * 26); }
  .url { font-size: calc(var(--u) * 34); letter-spacing: .09em; line-height: 1.4; margin-top: calc(var(--u) * 12); opacity: .92; }
  svg.mark { width: calc(var(--u) * 300); height: auto; display: block; margin: 0 auto calc(var(--u) * -6); fill: #fff7ea; opacity: .9;
    filter: drop-shadow(0 0 calc(var(--u) * 10) rgba(20, 24, 30, .35)); }
  .shade { position: absolute; inset: 0; background: radial-gradient(ellipse var(--sw, 34%) var(--sh, 30%) at 50% var(--at), rgba(16, 20, 26, var(--sa, .38)), rgba(16, 20, 26, 0) 100%); }
`;
const MARK = '<svg class="mark" viewBox="0 0 440 160"><path d="M32 96 C110 126 211 26 330 65 C229 30 121 130 32 96Z"/><path d="M95 116 C184 113 256 50 397 77 C266 54 187 117 95 116Z"/></svg>';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--disable-gpu'] });
try {
  for (const card of cards) {
    const [w, h] = card.size;
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    // Type is sized in units of a 1080-pixel short side, so a portrait card matches a landscape one on a phone.
    const unit = Math.min(w, h) / 1080 * (card.scale ?? 1);
    await page.setContent(`<!doctype html><style>${BASE} :root { --u: ${unit}px; } ${card.css ?? ''}</style>
      ${card.shade ? `<div class="shade" style="--at: ${(card.top ?? 0.5) * 100}%; ${card.shade === true ? '' : card.shade}"></div>` : ''}
      <div class="block" style="top: ${(card.top ?? 0.5) * 100}%">${card.html.replace('{mark}', MARK)}</div>`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${out}/${card.name}.png`, omitBackground: true });
    await page.close();
    console.log(`${out}/${card.name}.png`);
  }
} finally {
  await browser.close();
}
