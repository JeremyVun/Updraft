// Promo shots for tools/promo-film.mjs. Each names where the story starts, how to reach its moment, how long to film
// and what the player's hand does. Pointer positions are viewport fractions; `null` means the hand is away.
// Snapshots carry projected anchors (child, cygnet, plane, boat, sail) as viewport fractions.

export const FORMATS = {
  landscape: { viewport: [1440, 810], scale: 2, output: [1920, 1080], ring: 40 },
  portrait: { viewport: [432, 768], scale: 3.75, output: [1080, 1920], ring: 34 },
};

const smooth = u => u * u * (3 - 2 * u);

function catmull(points, u) {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  const d = u * lengths.at(-1);
  let i = 1;
  while (i < points.length - 1 && lengths[i] < d) i++;
  const k = (d - lengths[i - 1]) / Math.max(1e-9, lengths[i] - lengths[i - 1]);
  const p0 = points[Math.max(0, i - 2)], p1 = points[i - 1], p2 = points[i], p3 = points[Math.min(points.length - 1, i + 1)];
  const c = (a, b, c2, d2) => 0.5 * (2 * b + (-a + c2) * k + (2 * a - 5 * b + 4 * c2 - d2) * k * k + (-a + 3 * b - 3 * c2 + d2) * k * k * k);
  return [c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])];
}

/**
 * One movement of the hand along a smooth curve through `points`, from `at` for `dur` seconds, quick in the middle
 * like a real flick. With an `anchor`, the points are offsets from where that thing stood when the stroke began.
 */
export function stroke({ at, dur, points, anchor = null, ease = smooth }) {
  let origin = null;
  return (t, s) => {
    if (t < at || t > at + dur) return null;
    origin ??= anchor ? s[anchor] ?? { x: 0, y: 0 } : { x: 0, y: 0 };
    const [x, y] = catmull(points, ease((t - at) / dur));
    return { x: origin.x + x, y: origin.y + y };
  };
}

/** The first stroke that is under way; strokes should not overlap. */
export const hand = (...strokes) => (t, s) => {
  for (const f of strokes) { const p = f(t, s); if (p) return p; }
  return null;
};

/**
 * Broad sweeps back and forth across the frame, one row after another down `rows`, each a shallow arc like a wrist
 * turning. `start` in seconds; returns the strokes and when they end.
 */
export function sweeps({ start, rows, dur = 0.8, gap = 0.25, x0 = 0.1, x1 = 0.9, sag = 0.04 }) {
  const list = rows.map((y, i) => {
    const [a, b] = i % 2 ? [x1, x0] : [x0, x1];
    return stroke({ at: start + i * (dur + gap), dur, points: [[a, y], [(a + b) / 2, y + sag], [b, y]] });
  });
  return list;
}

const onScreen = p => p && p.z < 1 && p.x > 0.03 && p.x < 0.97 && p.y > 0.05 && p.y < 0.95;

/**
 * Plays on its own the way tools/playthrough.mjs does, for scouting whole chapters: whenever the story asks for the
 * wind somewhere, one stroke there, then a rest.
 */
export function autoplay({ rest = 0.6 } = {}) {
  let current = null, until = 0, n = 0;
  const sweep = (p, dx, dy, length, dur, at) => {
    const k = Math.hypot(dx, dy) || 1;
    return stroke({ at, dur, points: [[p.x - dx / k * length / 2, p.y - dy / k * length / 2], [p.x + dx / k * length / 2, p.y + dy / k * length / 2]] });
  };
  const circle = (p, r, dur, at) => stroke({ at, dur, ease: u => u, points: Array.from({ length: 17 }, (_, i) =>
    [p.x + Math.cos(i / 16 * Math.PI * 2) * r * 0.5625, p.y - Math.sin(i / 16 * Math.PI * 2) * r]) });
  return (t, s) => {
    if (current) { const p = current(t, s); if (p || t < until) return p; current = null; until = t + rest; return null; }
    if (t < until) return null;
    const dir = n++ % 2 ? -1 : 1;
    let next = null;
    if (s.chapter === 'island' && ['still', 'play'].includes(s.beat) && s.life < 0.99)
      next = sweep({ x: 0.5, y: 0.38 + (n % 8) * 0.055 }, dir, 0, 0.65, 1, t);
    else if (s.chapter === 'lines' && s.beat === 'curtain') next = sweep({ x: 0.5, y: 0.37 + (n % 3) * 0.08 }, dir, 0, 0.56, 0.7, t);
    else if (s.chapter === 'meadow' && s.piano && onScreen(s.piano.path[0]) && onScreen(s.piano.path[1])) {
      const forward = s.piano.expect.at(-1) > s.piano.expect[0], a = s.piano.path[forward ? 0 : 1], b = s.piano.path[forward ? 1 : 0];
      next = stroke({ at: t, dur: 1.6, ease: u => Math.max(0, (u - 0.12) / 0.88), points: [[a.x, a.y], [b.x, b.y]] });
      until = t + 2.5;
    } else if (s.chapter === 'boats' && s.beat === 'sailing' && onScreen(s.fleet)) next = sweep(s.fleet, 1, 0, 0.14, 0.6, t);
    else if (s.chapter === 'birches' && s.beat === 'scarf' && s.snag >= 0 && onScreen(s.scarf))
      next = s.snag === 1 ? circle(s.scarf, 0.078, 1, t) : sweep(s.scarf, s.snag === 0 ? 0 : dir, s.snag === 0 ? -1 : 0, 0.1, 0.5, t);
    else if (s.chapter === 'drowned' && s.beat === 'still' && onScreen(s.sail)) next = sweep(s.sail, 0, -1, 0.3, 0.6, t);
    else if (s.chapter === 'wood' && onScreen(s.wind)) next = sweep(s.wind, dir, 0, 0.15, 1.1, t);
    else if (s.chapter === 'sleeping' && ['asleep', 'snow', 'mist'].includes(s.beat) && onScreen(s.wind)) next = sweep(s.wind, 1, 0, 0.12, 0.7, t);
    else if (s.chapter === 'sleeping' && s.beat === 'climb' && onScreen(s.feather)) next = sweep(s.feather, 1, -0.3, 0.25, 0.7, t);
    else if (s.chapter === 'sleeping' && s.beat === 'hilltop' && onScreen(s.cygnet)) next = circle(s.cygnet, 0.06, 1.4, t);
    else if (s.chapter === 'mirror' && s.beat === 'play') {
      if (s.carried && onScreen(s.bubble)) next = circle(s.bubble, 0.035, 1.1, t);
      else if (onScreen(s.bubble) && s.target) next = sweep(s.bubble, s.target.x - s.bubble.x, s.target.y - s.bubble.y, 0.08, 0.55, t);
      else if (onScreen(s.wand)) next = sweep(s.wand, 1, 0, 0.1, 0.55, t);
    } else if (onScreen(s.coax)) next = circle(s.coax, 0.065, 1, t);
    if (!next) { until = t + 0.5; return null; }
    current = next; until = Math.max(until, t);
    return current(t, s);
  };
}

/** A small seeded generator, so a take can be filmed again exactly. */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/**
 * A person playing: strokes of varied length, angle and speed across `area` ([x0, y0, x1, y1]), each bowed a
 * little, with uneven pauses between and now and then a loop. From `start` to `end` seconds.
 */
export function playful({ start, end, area = [0.1, 0.3, 0.9, 0.8], seed = 7, pace = 1, loops = 0.12, aspect = 16 / 9 }) {
  const rand = seeded(seed), list = [];
  const [x0, y0, x1, y1] = area;
  for (let at = start; at < end;) {
    if (rand() < loops) {
      const c = [x0 + (x1 - x0) * (0.2 + rand() * 0.6), y0 + (y1 - y0) * (0.2 + rand() * 0.6)], r = 0.04 + rand() * 0.03, turns = 2 + Math.floor(rand() * 2);
      const dur = (0.55 + rand() * 0.2) * turns / pace, sign = rand() < 0.5 ? -1 : 1;
      list.push(stroke({ at, dur, ease: u => u, points: Array.from({ length: turns * 12 + 1 }, (_, i) =>
        [c[0] + Math.cos(sign * i / 12 * Math.PI * 2) * r / aspect, c[1] - Math.sin(sign * i / 12 * Math.PI * 2) * r]) }));
      at += dur + 0.2 + rand() * 0.5;
      continue;
    }
    const angle = (rand() - 0.5) * 0.9 + (rand() < 0.5 ? 0 : Math.PI), length = 0.25 + rand() * 0.35;
    const mid = [x0 + (x1 - x0) * rand(), y0 + (y1 - y0) * rand()];
    const dx = Math.cos(angle) * length / 2, dy = Math.sin(angle) * length / 2 * aspect * 0.5, bow = (rand() - 0.5) * 0.08;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const a = [clamp(mid[0] - dx, 0.03, 0.97), clamp(mid[1] - dy, 0.08, 0.92)], b = [clamp(mid[0] + dx, 0.03, 0.97), clamp(mid[1] + dy, 0.08, 0.92)];
    const dur = (0.55 + rand() * 0.6) / pace;
    list.push(stroke({ at, dur, points: [a, [(a[0] + b[0]) / 2 - dy * bow * 8, (a[1] + b[1]) / 2 + dx * bow * 8], b] }));
    at += dur + 0.12 + rand() * rand() * 0.9;
  }
  return list;
}

/** Plays `f` until `done(snapshot)` holds, lets the stroke under way finish, then the hand stays away. */
export function stopWhen(done, f) {
  let stopping = false, stopped = false;
  return (t, s) => {
    if (stopped) return null;
    stopping ||= done(s);
    const p = f(t, s);
    if (stopping && !p) { stopped = true; return null; }
    return p;
  };
}

/** Only between `from` and `to` seconds. */
export const during = (from, to, f) => (t, s) => (t >= from && t <= to ? f(t, s) : null);

/**
 * The opening as a person would play it: a slow first sweep over the grass above the child, a quicker one back,
 * then play all over the island until it is whole, and hands off so the child can catch the plane and go on.
 */
const openingHand = stopWhen(s => s.islandLife > 0.65, hand(
  stroke({ at: 2, dur: 1.7, points: [[0.83, 0.43], [0.62, 0.47], [0.4, 0.46], [0.16, 0.5]] }),
  stroke({ at: 4.2, dur: 1.1, points: [[0.12, 0.62], [0.45, 0.58], [0.88, 0.6]] }),
  ...playful({ start: 5.8, end: 120, area: [0.28, 0.14, 0.95, 0.72], seed: 11, loops: 0.08 }),
));

/** The first hand that is moving; for a story's own asks alongside some play of our own. */
export const either = (...hands) => (t, s) => {
  for (const f of hands) { const p = f(t, s); if (p) return p; }
  return null;
};

/**
 * A player waking the island: each stroke sweeps through a part of it that is still grey, at a slant and a pace
 * that vary, with uneven rests between. Strokes are chosen as they start, from what is on screen then.
 */
export function aimed({ start, end, seed = 17, length = [0.22, 0.4], aspect = 16 / 9 }) {
  const rand = seeded(seed);
  let current = null, next = start;
  return (t, s) => {
    if (t < start || t > end) return null;
    if (current) { const p = current(t, s); if (p) return p; current = null; }
    if (t < next || !s.grey?.length) return null;
    const [mx, my] = s.grey[Math.floor(rand() * s.grey.length)];
    const angle = (rand() - 0.5) * 1.2 + (rand() < 0.5 ? 0 : Math.PI), len = length[0] + rand() * (length[1] - length[0]);
    const dx = Math.cos(angle) * len / 2, dy = Math.sin(angle) * len / 2 * aspect * 0.5, bow = (rand() - 0.5) * 0.6;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const a = [clamp(mx - dx, 0.03, 0.97), clamp(my - dy, 0.06, 0.94)], b = [clamp(mx + dx, 0.03, 0.97), clamp(my + dy, 0.06, 0.94)];
    const dur = 0.55 + rand() * 0.55;
    current = stroke({ at: t, dur, points: [a, [mx - dy * bow, my + dx * bow], b] });
    next = t + dur + 0.12 + rand() * rand() * 0.8;
    return current(t, s);
  };
}

/** The same opening played on a phone held upright: the island sits in a narrower, taller frame. */
const openingHandPortrait = stopWhen(s => s.islandLife > 0.65, hand(
  stroke({ at: 2, dur: 1.5, points: [[0.9, 0.44], [0.6, 0.47], [0.32, 0.46], [0.08, 0.5]] }),
  stroke({ at: 4, dur: 1, points: [[0.08, 0.58], [0.5, 0.55], [0.92, 0.57]] }),
  aimed({ start: 5.5, end: 120, seed: 11, length: [0.3, 0.55], aspect: 9 / 16 }),
));

export const shots = {
  /** Portrait: the opening, first frame to the child gathering up the little swan. */
  islandP: { seconds: 110, lead: 3, pointer: openingHandPortrait },
  /** Portrait: the long crossing's sunset, dolphins and the sky mirror. */
  seaP: { chapter: 'sea', lead: 0, from: 28, seconds: 54 },
  /** Sailing away from the island into the sun: the crossing's first seconds, the boat on its own. */
  crossing: { chapter: 'crossing', seconds: 14, lead: 2 },
  /** The washing: sheets moving in the hand's wind, the family's shirts and the doorway standing in the grass. */
  washing: { chapter: 'washing', lead: 0, from: 44, seconds: 22,
    pointer: either(autoplay(), during(47, 57, hand(...playful({ start: 47, end: 57, area: [0.15, 0.12, 0.85, 0.42], seed: 3, pace: 0.8 })))) },
  /** The little boats: the hand blows the toy fleet down the river under the bath plug. */
  boats: { chapter: 'boats', lead: 0, from: 25, seconds: 40, pointer: autoplay() },
  /** The piano: the hand runs along the keys and the hills turn green from it. */
  meadow: { chapter: 'meadow', lead: 0, from: 88, seconds: 42, pointer: autoplay() },
  /** The birches: gusts through the gold canopy take leaves off the branches; the scarf gets freed along the way. */
  birches: { chapter: 'birches', lead: 0, from: 18, seconds: 32,
    pointer: either(autoplay(), during(20, 50, hand(...playful({ start: 20, end: 50, area: [0.1, 0.08, 0.9, 0.45], seed: 5, pace: 0.9, loops: 0.2 })))) },
  /** The drowned village at sunset; when the sail goes slack the hand fills it. */
  drowned: { chapter: 'drowned', lead: 0, from: 8, seconds: 44, pointer: autoplay() },
  /** The dark wood: the embers the wind makes, lighting the child. */
  wood: { chapter: 'wood', lead: 0, from: 8, seconds: 24, pointer: autoplay() },
  /** The long crossing: sunset and the dolphins, then gliding onto the sky mirror. */
  sea: { chapter: 'sea', lead: 0, from: 28, seconds: 54 },
  /** The opening, first frame to the child gathering up the little swan: the gameplay take and the trailer's first act. */
  island: { seconds: 100, lead: 3, pointer: openingHand },
  ...Object.fromEntries(['crossing', 'washing', 'boats', 'meadow', 'birches', 'drowned', 'wood', 'sleeping', 'sea', 'mirror']
    .map(chapter => [`scout-${chapter}`, { chapter, seconds: 150, lead: 0, pointer: autoplay() }])),
  'scout-island': { seconds: 200, lead: 0, pointer: autoplay() },
  'scout-meadow2': { chapter: 'meadow', seconds: 240, lead: 0, pointer: autoplay() },
  /** Scouting: the gameplay take's hand, to see how soon a person-like hand brings the island back. */
  'scout-take': { seconds: 70, lead: 0, pointer: hand(...playful({ start: 2.2, end: 70 })) },
  debugCursor: { seconds: 2, lead: 0, pointer: hand(stroke({ at: 0.2, dur: 1.5, points: [[0.2, 0.5], [0.8, 0.5]] })) },
  /** Scouting: how fast rows of sweeps over the whole island bring it back. */
  scoutBloom: {
    seconds: 70, lead: 0,
    pointer: hand(...sweeps({ start: 1.5, rows: [0.34, 0.42, 0.5, 0.58, 0.66, 0.74, 0.3, 0.38, 0.46, 0.54, 0.62, 0.7, 0.78,
      0.34, 0.42, 0.5, 0.58, 0.66, 0.74, 0.3, 0.38, 0.46, 0.54, 0.62, 0.7, 0.78, 0.34, 0.42, 0.5, 0.58, 0.66, 0.74,
      0.3, 0.38, 0.46, 0.54, 0.62, 0.7, 0.78, 0.34, 0.42, 0.5, 0.58, 0.66, 0.74, 0.3, 0.38, 0.46, 0.54, 0.62, 0.7, 0.78,
      0.34, 0.42, 0.5, 0.58, 0.66, 0.74, 0.3, 0.38, 0.46, 0.54, 0.62, 0.7, 0.78] })),
  },
  /** Scouting: the opening from the first frame, the island woken by broad sweeps as the playthrough does it. */
  scoutIsland: {
    seconds: 60, lead: 0,
    pointer: (t) => {
      if (t < 2) return null;
      const n = Math.floor((t - 2) / 1.6), u = ((t - 2) % 1.6) / 1.2;
      if (u > 1) return null;
      const dir = n % 2 ? -1 : 1, y = 0.38 + (n % 8) * 0.055;
      return { x: 0.5 + dir * (smooth(u) - 0.5) * 0.65, y };
    },
  },
};
