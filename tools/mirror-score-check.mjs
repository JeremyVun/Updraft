// Supplied Sky Mirror recording, looping, mute and source cleanup. Vite on 5230, or BASE.
import { audioPage } from './lib/audio-render.mjs';
import { checkRecordedScore } from './lib/recorded-score-check.mjs';
const { browser, page } = await audioPage();
try {
  console.log(JSON.stringify({ checks: await checkRecordedScore(page, 'mirror') }, null, 2));
} finally { await browser.close(); }
