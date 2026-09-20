import type { ChapterName } from './journey';

/** Numeric wire fields stay positional for v1 saves. This registry also types current checkpoint writers. */
export const CHECKPOINT_FIELDS = {
  empty: [],
  lines: ['gateOrLeg', 'doorOpened'],
  boats: ['progress'],
  meadow: ['leg', 'waveTo', 'waveSpeed', 'dusk', 'duskTarget'],
  birches: ['leg', 'swings', 'dusk', 'scarfCompleted'],
  legacyBirches: ['leg', 'swings', 'dusk'],
  drowned: ['leg'],
  wood: ['leg', 'chainAt'],
  crossing: ['leg', 'time'],
  mirror: ['completedMask', 'target'],
  legacyMirror: ['progress'],
} as const;

type NumericFields<T extends readonly string[]> = { -readonly [I in keyof T]: number };
export type CheckpointPayload<K extends keyof typeof CHECKPOINT_FIELDS> = NumericFields<(typeof CHECKPOINT_FIELDS)[K]>;

const F = CHECKPOINT_FIELDS;
const layouts = {
  island: { entry: F.empty, companion: F.empty },
  toLines: { entry: F.empty }, lines: { entry: F.empty, 'curtain-1': F.lines, 'curtain-2': F.lines, family: F.lines },
  toBoats: { entry: F.empty }, boats: { entry: F.empty, 'pool-1': F.boats, 'pool-2': F.boats },
  toMeadow: { entry: F.empty }, meadow: { entry: F.empty, piano: F.meadow, pond: F.meadow },
  toBirches: { entry: F.empty }, birches: {
    entry: F.empty, swing: F.legacyBirches, leaves: F.legacyBirches,
    'scarf-0-swing': F.birches, 'scarf-1': F.birches, 'scarf-1-swing': F.birches,
    'scarf-2': F.birches, 'scarf-2-swing': F.birches, 'scarf-3': F.birches, 'scarf-3-swing': F.birches,
    'scarf4-0-swing': F.birches, 'scarf4-1': F.birches, 'scarf4-1-swing': F.birches,
    'scarf4-2': F.birches, 'scarf4-2-swing': F.birches, 'scarf4-3': F.birches, 'scarf4-3-swing': F.birches,
    'scarf4-4': F.birches, 'scarf4-4-swing': F.birches,
  },
  drowned: { entry: F.empty, sail: F.drowned }, toWood: { entry: F.empty },
  wood: { entry: F.empty, found: F.wood, dry: F.wood }, toSleeping: { entry: F.empty },
  sleeping: { entry: F.empty, feather: F.empty, morning: F.empty },
  toMirror: { entry: F.empty, swim: F.crossing }, mirror: { entry: F.empty, stars: F.mirror, 'stars-0': F.mirror, 'stars-1': F.mirror, 'stars-2': F.mirror, 'stars-3': F.mirror, 'stars-4': F.mirror, 'stars-5': F.mirror, 'stars-6': F.mirror, 'stars-7': F.mirror, reflection: F.legacyMirror, window: F.legacyMirror, moon: F.legacyMirror, tide: F.legacyMirror, lantern: F.legacyMirror },
  toHarbour: { entry: F.empty }, toHome: { entry: F.empty, swim: F.crossing },
  home: { entry: F.empty, reunion: F.empty, drawing: F.empty, complete: F.empty },
} satisfies Partial<Record<ChapterName, Record<string, readonly string[]>>>;

/** Retain the public arity map used by existing validators and QA tools. */
export const CHECKPOINTS: Partial<Record<ChapterName, Record<string, number>>> = Object.fromEntries(
  Object.entries(layouts).map(([chapter, points]) => [chapter,
    Object.fromEntries(Object.entries(points).map(([point, fields]) => [point, fields.length]))]),
);
