// Promo edits for tools/promo-edit.mjs. `at` places a clip on the edit's timeline (seconds); `from` is where it
// starts in the filmed shot. Each clip runs until the next one's `at` plus the crossfade. The trailer's timeline is
// the sea study's own, so cuts can land on its chord changes (0, 12, 24, 33, 44 and 53 s).

export const edits = {
  trailer: {
    format: 'landscape', crossfade: 0.6, end: 64.5,
    music: { file: 'sea.wav', from: 0.5, gain: 8, fadeIn: 0.2, fadeOut: 3 },
    // World gains put each shot's own sound about 6 dB under the music playing over it (3 dB for the opening
    // gusts, 10 dB for the closing mirror), measured with ebur128 on the filmed stems.
    clips: [
      { shot: 'island', from: 0.3, at: 0, world: 0.69 },
      { shot: 'island', from: 9.5, at: 5.5, world: 0.46 },
      { shot: 'island', from: 19.2, at: 12, world: 0.54 },
      { shot: 'island', from: 38.3, at: 16.5, world: 1.16 },
      { shot: 'island', from: 58.8, at: 20, world: 1.86 },
      { shot: 'crossing', from: 6, at: 24, world: 3.1 },
      { shot: 'washing', from: 14.5, at: 28.5, world: 2.3 },
      { shot: 'boats', from: 20, at: 33, world: 1.76 },
      { shot: 'meadow', from: 26.6, at: 36.5, world: 0.97 },
      { shot: 'birches', from: 21, at: 40.5, world: 0.55 },
      { shot: 'drowned', from: 27.5, at: 44, world: 2.8 },
      { shot: 'wood', from: 17, at: 48.5, world: 0.64, grade: 'eq=gamma=1.22:brightness=0.015' },
      { shot: 'sea', from: 24.6, at: 53, world: 2.26 },
      { shot: 'sea', from: 42.3, at: 57.5, world: 0.81 },
    ],
    text: [
      { png: 'wind-l', at: 1.6, dur: 3.6 },
      { png: 'home-l', at: 20.6, dur: 3.8 },
    ],
    card: { png: 'end-l', at: 59.2, blur: 6 },
  },
  /**
   * The short, on the sea study's last 20 seconds (44 s on): the wind wakes the island, it blooms as the melody
   * comes in, the child and the little swan on the lift into D, the sunset crossing, and the sky mirror to close.
   */
  short: {
    format: 'landscape', crossfade: 0.5, end: 20.8,
    music: { file: 'sea.wav', from: 44.5, gain: 10, fadeIn: 0.6, fadeOut: 2.5 },
    clips: [
      { shot: 'island', from: 0.9, at: 0, world: 0.6 },
      { shot: 'island', from: 19.4, at: 4.5, world: 0.6 },
      { shot: 'island', from: 58.8, at: 9, world: 0.9 },
      { shot: 'sea', from: 24.6, at: 12.8, world: 2.5 },
      { shot: 'sea', from: 42.3, at: 16.3, world: 2 },
    ],
    text: [
      { png: 'wind-l', at: 1.1, dur: 3.2 },
      { png: 'home-l', at: 9.4, dur: 3.2 },
    ],
    card: { png: 'end-l', at: 17.1, blur: 6 },
  },
  /** The short filmed upright for Reels and Stories: the same beats, each shot framed by the game for a phone. */
  shortP: {
    format: 'portrait', crossfade: 0.5, end: 20.8,
    music: { file: 'sea.wav', from: 44.5, gain: 10, fadeIn: 0.6, fadeOut: 2.5 },
    clips: [
      { shot: 'islandP', from: 0.9, at: 0, world: 0.6 },
      { shot: 'islandP', from: 25.5, at: 4.5, world: 0.6 },
      { shot: 'islandP', from: 57.5, at: 9, world: 0.9 },
      { shot: 'seaP', from: 25, at: 12.8, world: 2.5 },
      { shot: 'seaP', from: 41.5, at: 16.3, world: 2 },
    ],
    text: [
      { png: 'wind-p', at: 1.1, dur: 3.2 },
      { png: 'home-p', at: 9.4, dur: 3.2 },
    ],
    card: { png: 'end-p', at: 17.1, blur: 5 },
  },
  /** One unbroken take of the opening with the game's own mix: the island's score as it played, and its world. */
  gameplay: {
    format: 'landscape', end: 66,
    music: { path: '/tmp/updraft-promo-footage/landscape/island-score.wav', from: 0.3, gain: 1, fadeIn: 0.05, fadeOut: 2.5 },
    clips: [{ shot: 'island', from: 0.3, at: 0 }],
    // The game hushes its music as the swans pass and the little one falls; lifted 7 dB so it is not taken for a dropout.
    envelope: [[0, 0], [38, 0], [46, 7], [66, 7]],
    card: { png: 'end-l', at: 62 },
  },
};
