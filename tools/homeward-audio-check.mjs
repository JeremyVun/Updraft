// Recorded Home music, lifecycle and the Mirror departure rest. Vite on 5230, or BASE.
import { audioPage } from './lib/audio-render.mjs';
import { checkRecordedScore } from './lib/recorded-score-check.mjs';
const { browser, page } = await audioPage();
try {
  const checks = await page.evaluate(async () => {
    const { ArrivalTransition } = await import('/src/audio/arrival-music.ts');
    const checks = [], check = (ok, message) => { if (!ok) throw Error(message); checks.push(message); };
    const mirror={...baseState,music:'mirror',mirrorScore:'depart',hush:.5,flockChatter:false};
    const leaving={...mirror,arrivalMusic:'home',homewardReady:true};
    const transition=new ArrivalTransition();transition.update(mirror,0);transition.update(leaving,1);
    check(transition.update(leaving,4).stage==='gap','Three-second mirror fade ends before the silence');
    check(transition.update(leaving,8.99).stage==='gap','Fast sailing cannot shorten the five-second rest');
    check(transition.update({...leaving,homewardReady:false},9).stage==='gap','An uncleared headland extends the rest');
    check(transition.update({...leaving,homewardReady:false},15).stage==='gap','Readiness is required even after the clock expires');
    check(transition.update(leaving,16).stage==='incoming','The first offshore turn releases the summit entrance');
    check(transition.update({...leaving,homewardReady:false},17).stage==='incoming','Sailing back cannot restart the silence');
    const stalled=new ArrivalTransition();stalled.update(mirror,0);stalled.update(leaving,1);
    check(stalled.update(leaving,30).stage==='gap'&&stalled.update(leaving,34.99).stage==='gap','A stalled frame still gets five full seconds after source retirement');
    check(Array.from({length:20},()=>stalled.update(leaving,34.99).stage).every(s=>s==='gap'),'Suspended audio time cannot consume the rest');
    check(stalled.update(leaving,35.01).stage==='incoming','The stalled transition can finish');

    return checks;
  });
  checks.push(...await checkRecordedScore(page, 'home'));
  console.log(JSON.stringify({ checks }, null, 2));
} finally { await browser.close(); }
