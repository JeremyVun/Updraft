// Recorded Lines music and checkpoint phase selection. Vite on 5230, or BASE.
import { audioPage } from './lib/audio-render.mjs';
import { checkRecordedScore } from './lib/recorded-score-check.mjs';
const { browser, page } = await audioPage();
try {
  const checks = await page.evaluate(async () => {
    const { LinesChapter } = await import('/src/story/lines.ts');
    const { door } = await productionModule('/src/world/lines.ts');
    const { takeCues } = await productionModule('/src/story/cues.ts');
    const passed = [], check = (ok, message) => { if (!ok) throw Error(message); passed.push(message); };
    const phase=Object.getOwnPropertyDescriptor(LinesChapter.prototype,'linesScore').get;
    const quiet=Object.getOwnPropertyDescriptor(LinesChapter.prototype,'linesMelodyQuiet').get;
    const story={beat:'wonder',gate:0};door.open=0;
    for(const [gate,want] of [[0,'first'],[1,'second'],[2,'third']]) {
      story.gate=gate;
      for(const beat of ['approach','curtain','birdThrough','childThrough']) {
        story.beat=beat;check(phase.call(story)===want,`${want}/${beat}: passage progress owns the musical section`);
        check(quiet.call(story)===(beat==='birdThrough'||beat==='childThrough'),`${want}/${beat}: melody space follows the bird leading`);
      }
    }
    for(const beat of ['familyApproach','family']) { story.beat=beat;check(phase.call(story)==='family',`${beat}: warmth begins at the family clothes`); }
    door.open=1;story.beat='family';check(phase.call(story)==='door','Opening the door gives completion its accompaniment-only section');
    for(const beat of ['throughDoor','shore','walk','toBoat','ashore','push','aboard']) {
      story.beat=beat;
      const want=beat==='throughDoor'?'door':['shore','walk','toBoat','push','aboard'].includes(beat)?'shore':'third';
      check(phase.call(story)===want,`${beat}: doorway, beach and original sailing transitions retain their places`);
    }
    // Exercise actual restoration; no cue or family reveal may replay from an existing save.
    const THREE=await import('/node_modules/three/build/three.module.js');
    for(const point of ['curtain-1','curtain-2','family']) {
      const restored=Object.assign(Object.create(LinesChapter.prototype),{
        cast:{child:{position:new THREE.Vector3(300,0,0),stop(){},walkTo(){}},
          cygnet:{follow(){},watch(){}},plane:{hold(){}},boat:{position:new THREE.Vector3(),beach(){}}},
        now:0,beatStart:0,boatAt:new THREE.Vector3(),
      });
      takeCues();restored.restoreCheckpoint(point,point==='family'?[0,1]:[Number(point.slice(-1)),0]);
      check(restored.linesScore===(point==='family'?'shore':point==='curtain-1'?'second':'third')&&!takeCues().length,
        `${point}: restoration selects the right music without a reward`);
    }

    return passed;
  });
  checks.push(...await checkRecordedScore(page, 'lines'));
  console.log(JSON.stringify({ checks }, null, 2));
} finally { await browser.close(); }
