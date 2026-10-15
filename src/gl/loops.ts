import { LINES_CLEARINGS } from '../world/lines-layout';

// Uniform bounds keep Windows shader compilation from expanding noise loops at every call site.
export const noiseLoopUniforms = {
  uNoiseOctaves: Object.freeze({ value: 4 }),
  uHeightOctaves: Object.freeze({ value: 6 }),
  uNoiseCorners: Object.freeze({ value: 4 }),
  uLinesClearings: Object.freeze({ value: LINES_CLEARINGS }),
  // The sea mist's passes: the whole bank, less the clearing round the tower, plus that clearing at its low height.
  uMistPasses: Object.freeze({ value: 3 }),
};
