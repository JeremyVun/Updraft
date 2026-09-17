/**
 * The knobs that set how the game feels, in one place. Speeds are world units per second, the wind field's unit;
 * for scale, the prevailing breeze blows at `wind.breeze` and the hardest stroke makes `pointer.maxGust`.
 */
export const tuning = {
  pointer: {
    /** The wind speed a stroke can never exceed; faster strokes ease toward it. */
    maxGust: 26,
    /** Wind speed per unit of cursor speed over the ground, moving freely and with the button held. */
    hoverGain: 0.15,
    pressedGain: 0.19,
    /** Strokes slower than this make no wind at all. */
    minGust: 0.6,
    /**
     * Tracing circles with the cursor winds up an updraft in the middle of them. The turning rates, in radians per
     * second on screen (6.3 is one loop a second), at which it starts to build and at which it builds fastest.
     */
    twirlFrom: 4,
    twirlFull: 8,
    /** Updraft charge gained per second of full twirling, and lost per second once the twirling stops. */
    chargeRate: 0.55,
    dischargeRate: 1.2,
  },
  swirl: {
    /**
     * The ribbon the player's circling draws into the air. Every loop they draw lifts the air another `pitch`, so
     * winding harder stands a taller column however fast the hand goes round; when they stop it sinks instead.
     * A length of ribbon lasts `life` seconds, which is what limits how tall a column can stand.
     */
    pitch: 1.7,
    sink: 0.7,
    life: 2.4,
    alpha: 0.85,
    /** How thick the ribbon is drawn, as a share of how far away it is, so it is the same stroke at any distance. */
    pen: 0.006,
    /** Degrees the loops are stood up from the ground toward the camera: flat on the ground they read as marks. */
    tilt: 45,
    /** Narrowest and widest a column can be, whatever size circles are drawn on screen. */
    radiusMin: 0.35,
    radiusMax: 8,
    /** What a column's radius is drawn toward while it is being wound, and once the winding stops. */
    tighten: 0.72,
    flare: 1.7,
    /** Seconds after the colt's first failed try before the invitation begins, and over which it grows insistent. */
    coaxAfter: 4,
    coaxRamp: 22,
    /** The invitation's loops: turns a second, their radius, how high they climb, and how brightly they show. */
    coaxLoops: 0.62,
    coaxRadius: 0.9,
    coaxHeight: 2.2,
    coaxAlpha: 0.45,
    /** Seconds of winding in one invitation, and of quiet after it before it comes round again. */
    coaxWind: 3.4,
    coaxGap: 2.2,
    /** How near the invitation the player has to be circling for it to hand over to their own trace. */
    coaxNear: 18,
  },
  wind: {
    /** Prevailing breeze at a chapter's full `breeze`. */
    breeze: 2.6,
    /** How fast stirred air returns to the breeze, and how fast it loses speed, per second. */
    relax: 0.32,
    dissipation: 0.12,
    /** Decay per second of gust energy and of rising air. */
    energyDecay: 1.1,
    liftDecay: 0.8,
    /** Vorticity confinement: higher keeps eddies curling for longer. */
    swirliness: 9,
    /** The spring that leans the grass: stiffer snaps back faster, less damping overshoots more. */
    grassStiffness: 38,
    grassDamping: 3.2,
  },
  world: {
    /** North to south length of the meadow. It was sculpted 600 long and is shown as a scale model of that. */
    meadowLength: 400,
    /** Height of the dome in the middle of the island of lines, on top of about 4 of beach and lumps. */
    linesDome: 5.5,
  },
  crest: {
    /** How far ahead of the child the colt's family is wheeling, and how far to the east of the way ahead. */
    ahead: 34,
    aside: 8,
    /** How high off the meadow the column starts, how fast the thermal carries it up, and how it is shaped. */
    base: 2,
    climb: 1.1,
    radius: 12,
    spread: 9,
    /** How fast they glide away once they have turned north: slower than travelling, so the going is seen. */
    leaves: 11,
    /** Seconds in: the colt answers them, they string out and go north, and the child sets it down after them. */
    answers: 1.3,
    goes: 10.5,
    setsDown: 16,
    /** How far in front of the child the colt is put down, and how long it waits before its first try. */
    setDownAt: 2.8,
    firstTry: 2.2,
    /** Seconds it keeps its eyes on the sky they left by, after which they are out of sight for good. */
    watches: 5,
  },
  colt: {
    /**
     * How much of the gust energy brushed under the colt counts as rising air. It takes off above 0.5 of lift and
     * needs about 0.4 to stay up; energy tops out at 1.6 and fades in about a second, so it has to be kept up.
     */
    gustLift: 0.6,
    /** Seconds the colt is left trying in the meadow before the child gathers it up and walks on. */
    tryFor: 60,
  },
  washing: {
    /** Wind speed that lifts a sheet all the way to horizontal; the breeze alone lifts it `wind.breeze` / this. */
    fullSwingSpeed: 18,
  },
  petals: {
    /** Share of the 8192 petals alive on the still island, and in the short pasture past z = -600. */
    stillIslandShare: 0.7,
    pastureShare: 0.12,
    /** Wind speeds between which a bare gust, with no updraft, starts to lift resting petals. */
    liftFrom: 9,
    liftTo: 20,
  },
};

/** A number as a GLSL float literal. */
export const glsl = (x: number): string => x.toFixed(4);
