// Uniform bounds keep Windows shader compilation from expanding noise loops at every call site.
export const noiseLoopUniforms = {
  uNoiseOctaves: Object.freeze({ value: 4 }),
  uHeightOctaves: Object.freeze({ value: 6 }),
  uNoiseCorners: Object.freeze({ value: 4 }),
};
