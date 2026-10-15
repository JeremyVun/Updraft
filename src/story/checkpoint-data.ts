import type { ChapterName } from './journey';
import { MIRROR_STAR_MASK } from '../world/sky-mirror-layout';

/** Numeric wire fields stay positional for v1 saves. This registry also types current checkpoint writers. */
export const CHECKPOINT_FIELDS = {
  empty: [],
  lines: ['gateOrLeg', 'doorOpened'],
  boats: ['progress'],
  meadow: ['leg', 'waveTo', 'waveSpeed', 'dusk', 'duskTarget'],
  birches: ['leg', 'swings', 'dusk', 'scarfCompleted', 'squirrelRounds'],
  scarfBirches: ['leg', 'swings', 'dusk', 'scarfCompleted'],
  legacyBirches: ['leg', 'swings', 'dusk'],
  drowned: ['leg'],
  stairs: ['docked'],
  wood: ['leg', 'chainAt'],
  crossing: ['leg', 'time'],
  mirror: ['completedMask', 'target'],
  legacyMirror: ['progress'],
} as const;

type NumericFields<T extends readonly string[]> = { -readonly [I in keyof T]: number };
export type CheckpointPayload<K extends keyof typeof CHECKPOINT_FIELDS> = NumericFields<(typeof CHECKPOINT_FIELDS)[K]>;

/** The birches' point after `rounds` of the squirrel's game and `tangles` of the scarf's, and the swing if ridden. */
export const birchesPoint = (rounds: number, tangles: number, swing: boolean): `squirrel${number}-scarf${number}${'' | '-swing'}` =>
  `squirrel${rounds}-scarf${tangles}${swing ? '-swing' : ''}`;

const F = CHECKPOINT_FIELDS;
const layouts = {
  island: { entry: F.empty, companion: F.empty },
  toLines: { entry: F.empty }, lines: { entry: F.empty, 'curtain-1': F.lines, rotary: F.lines, 'curtain-2': F.lines, family: F.lines },
  toBoats: { entry: F.empty }, boats: { entry: F.empty, 'pool-1': F.boats, 'pool-2': F.boats },
  toMeadow: { entry: F.empty }, meadow: { entry: F.empty, piano: F.meadow, 'echoes-1': F.meadow, 'echoes-2': F.meadow, pond: F.meadow },
  toBirches: { entry: F.empty }, birches: {
    entry: F.empty, swing: F.legacyBirches, leaves: F.legacyBirches,
    'scarf-0-swing': F.scarfBirches, 'scarf-1': F.scarfBirches, 'scarf-1-swing': F.scarfBirches,
    'scarf-2': F.scarfBirches, 'scarf-2-swing': F.scarfBirches, 'scarf-3': F.scarfBirches, 'scarf-3-swing': F.scarfBirches,
    'scarf4-0-swing': F.scarfBirches, 'scarf4-1': F.scarfBirches, 'scarf4-1-swing': F.scarfBirches,
    'scarf4-2': F.scarfBirches, 'scarf4-2-swing': F.scarfBirches, 'scarf4-3': F.scarfBirches, 'scarf4-3-swing': F.scarfBirches,
    'scarf4-4': F.scarfBirches, 'scarf4-4-swing': F.scarfBirches,
    ...Object.fromEntries([0, 1, 2, 3].flatMap((rounds) => [0, 1, 2, 3, 4].flatMap((tangles) => ['', '-swing'].map((swing) =>
      [birchesPoint(rounds, tangles, swing !== ''), F.birches])))) as Record<`squirrel${number}-scarf${number}${'' | '-swing'}`, typeof F.birches>,
  },
  toStairs: { entry: F.empty }, stairs: { entry: F.empty, 'flight-1': F.stairs, 'flight-2': F.stairs, 'flight-3': F.stairs, cloud: F.stairs },
  drowned: { entry: F.empty, sail: F.drowned, roofs: F.drowned, church: F.drowned, belfry: F.drowned, storm: F.drowned }, toWood: { entry: F.empty },
  wood: { entry: F.empty, found: F.wood, dry: F.wood }, toSleeping: { entry: F.empty },
  sleeping: { entry: F.empty, feather: F.empty, morning: F.empty },
  toMirror: { entry: F.empty, swim: F.crossing, 'whale-rest': F.crossing, 'whale-breath': F.crossing, 'whale-eye': F.crossing, 'whale-line': F.crossing, 'whale-heave': F.crossing, 'whale-flipper': F.crossing, 'whale-gone': F.crossing }, mirror: {
    entry: F.empty,
    ...Object.fromEntries(Array.from({ length: MIRROR_STAR_MASK + 1 }, (_, mask) => [`stars4-${mask}`, F.mirror])) as Record<`stars4-${number}`, typeof F.mirror>,
    stars: F.mirror, 'stars-0': F.mirror, 'stars-1': F.mirror, 'stars-2': F.mirror, 'stars-3': F.mirror, 'stars-4': F.mirror, 'stars-5': F.mirror, 'stars-6': F.mirror, 'stars-7': F.mirror, reflection: F.legacyMirror, window: F.legacyMirror, moon: F.legacyMirror, tide: F.legacyMirror, lantern: F.legacyMirror },
  toHarbour: { entry: F.empty }, toHome: { entry: F.empty, swim: F.crossing },
  home: { entry: F.empty, reunion: F.empty, drawing: F.empty, complete: F.empty },
} satisfies Partial<Record<ChapterName, Record<string, readonly string[]>>>;

/** Retain the public arity map used by existing validators and QA tools. */
export const CHECKPOINTS: Partial<Record<ChapterName, Record<string, number>>> = Object.fromEntries(
  Object.entries(layouts).map(([chapter, points]) => [chapter,
    Object.fromEntries(Object.entries(points).map(([point, fields]) => [point, fields.length]))]),
);
