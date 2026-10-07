import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openBrowser } from './lib/browser.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const rooms = ['island', 'washing', 'boats', 'meadow', 'birches', 'stairs', 'drowned', 'wood', 'sleeping', 'sea', 'mirror', 'home'];
const output = process.argv[2] ?? `${root}assets/promo/updraft-chapter-collage-share.jpg`;
const before = fs.existsSync(output) ? fs.readFileSync(output) : null;
const images = rooms.map(room => {
  const png = fs.readFileSync(`${root}assets/art-direction/continue/remade/masters/${room}-port.png`);
  return `<img alt="${room}" src="data:image/png;base64,${png.toString('base64')}">`;
});
const { browser, close } = await openBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 2340, height: 1688 }, deviceScaleFactor: 1 });
  await page.setContent(`<style>
    html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; }
    body { display: grid; grid-template-columns: repeat(6, 1fr); grid-template-rows: repeat(2, 1fr); }
    img { display: block; width: 100%; height: 100%; min-height: 0; object-fit: cover; }
  </style>${images.join('')}`);
  await page.evaluate(() => Promise.all([...document.images].map(image => image.decode())));
  const jpg = await page.screenshot({ type: 'jpeg', quality: 94 });
  if (before ? !fs.readFileSync(output).equals(before) : fs.existsSync(output)) {
    throw new Error(`Output changed during capture: ${output}`);
  }
  fs.writeFileSync(output, jpg);
  console.log(output);
} finally {
  await close();
}
