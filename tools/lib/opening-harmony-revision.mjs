// Listening revision only: retain the endorsed opening and repair its 0:48–1:30 passage.
import {studies as original, studyState, scheduleStudy as schedule} from './opening-summit-full-score.mjs';
export {studyState};
export const dependencies=['tools/lib/opening-summit-full-score.mjs'];
const replacement=[
  [43,57,62,66], // Gmaj9: bass falls while the upper answer rises.
  [42,57,62,67], // D(add4)/F#: keep A and D; G rubs gently against F#.
  [41,57,62,69], // Dm/F: the same D memory turns minor.
  [40,55,62,67], // Em7: three moving lines relax around the held D.
  [39,58,62,65], // Ebmaj9: borrowed colour, approached by a semitone in the bass.
  [38,57,62,65], // Dm: D and F remain while the bass finds its way down.
  [43,58,62,64], // Gm6: the endorsed minor-sixth colour, now reached from below.
  [47,54,62,66], // Bm: D still held; two semitone resolutions open a glimpse of warmth.
  [49,55,62,67], // C# under held D and G: a suspended leading harmony into the existing D voicing.
];
export const studies={opening:{...original.opening,
  intent:'The same question; a descending bass and shared D carry the wandering passage through borrowed minor harmony.',
  chords:original.opening.chords.map((row,i)=>i>=9&&i<=17?[row[0],row[1],replacement[i-9],row[3]]:row),
}};
export function scheduleStudy(name,ctx,sound,piano){return schedule(name,ctx,sound,piano,studies[name]);}
