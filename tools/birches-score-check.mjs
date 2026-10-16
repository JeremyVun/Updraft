// Recorded Birches music, lifecycle and checkpoint phase selection. Vite on 5230, or BASE.
import { audioPage } from './lib/audio-render.mjs';
import { checkRecordedScore } from './lib/recorded-score-check.mjs';
const { browser, page } = await audioPage();
try {
  const checks = await page.evaluate(async () => {
    const { BirchesChapter } = await import('/src/story/birches.ts');
    const { takeCues } = await productionModule('/src/story/cues.ts');
    const passed = [], check = (ok, message) => { if (!ok) throw Error(message); passed.push(message); };
    const phase = Object.getOwnPropertyDescriptor(BirchesChapter.prototype, 'birchesScore').get;
    const scarf = { completed: 0, finished: false }, story = { beat: 'wonder', cast: { birches: { scarf } } };
    for (const beat of ['ashore','wonder','walk','toScarf','scarf']) {
      story.beat = beat; check(phase.call(story) === 'walk', `${beat}: the initial walk phase is retained`);
    }
    scarf.completed = 1;
    for (const beat of ['walk','swingOffer','toScarf','scarf','unravelling']) {
      story.beat = beat; check(phase.call(story) === 'scarf', `${beat}: later scarf work selects its story phase`);
    }
    for (const beat of ['toSwing','swinging']) {
      story.beat = beat; check(phase.call(story) === 'swing', `${beat}: an accepted swing selects its story phase`);
    }
    scarf.completed = 4; scarf.finished = true;
    story.beat = 'unravelling'; check(phase.call(story) === 'scarf', 'The last release retains the scarf phase');
    for (const beat of ['walk','gathering','toBoat']) {
      story.beat = beat; check(phase.call(story) === 'return', `${beat}: the completed sail selects the return phase`);
    }
    for (const beat of ['push','aboard']) {
      story.beat = beat; check(phase.call(story) === 'return', `${beat}: the return phase continues through departure`);
    }
    for (const count of [0,1,2,3,4]) {
      const restoredScarf = { active: -1, snags: [], restore(n) { this.completed = n; this.finished = n === 4; } };
      const restored = Object.assign(Object.create(BirchesChapter.prototype), { cast: {
        birches: { scarf: restoredScarf }, boat: { beach() {} }, child: { stop() {}, stowPlane() {} }, cygnet: { carried: false },
      }, squirrel: { release() {}, restore() {} }, cueNow: {} });
      takeCues(); restored.restoreCheckpoint(`scarf4-${count}`, [2,1,.65,count]);
      check(restored.birchesScore === (count === 0 ? 'walk' : count === 4 ? 'return' : 'scarf') && !takeCues().length,
        `Checkpoint with ${count} freed tangles resumes the right section without a reward`);
    }
    return passed;
  });
  checks.push(...await checkRecordedScore(page, 'birches'));
  console.log(JSON.stringify({ checks }, null, 2));
} finally { await browser.close(); }
