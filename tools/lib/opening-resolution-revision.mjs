// Resolve the wandering phrase before its returning motif. Earlier auditions stay reproducible.
import {studies as previous,studyState} from './opening-harmony-revision.mjs';
import {scheduleStudy as schedule,tempo} from './opening-summit-full-score.mjs';
export {studyState};
export const dependencies=['tools/lib/opening-harmony-revision.mjs','tools/lib/opening-summit-full-score.mjs'];
const step=4.25/tempo,arrival=85,base=previous.opening;
const shift=t=>t>=arrival?t+step:t;
export const studies={opening:{...base,
  seconds:base.seconds+step,
  intent:'The wandering Gm6 resolves softly to D/F#, held for a full harmonic step before the motif returns in B minor.',
  phases:base.phases.map(([t,label])=>[shift(t),label]),
  chords:[
    ...base.chords.slice(0,16),
    // G–F# and Bb–A settle downward; D stays; E lifts to F#. No new instrument or cadence accent.
    [arrival,step,[42,57,62,66],'the wandering phrase resolves'],
    ...base.chords.slice(16).map(([t,duration,chord,section])=>[shift(t),duration,chord,section]),
  ],
  // Preserve the earlier dynamics exactly, hold through the new chord, then resume with the motif.
  dynamics:[[0,1],[25,1],[42.5,.88],[63.75,.90],[85,1],[85+step,1],
    [106.25+step,1],[127.5+step,.92],[148.75+step,.84],[169+step,.82],[176+step,.78]],
}};
export function scheduleStudy(name,ctx,sound,piano){return schedule(name,ctx,sound,piano,studies[name]);}
