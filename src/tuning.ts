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
    twirlFrom: 3,
    twirlFull: 6.5,
    /** Updraft charge gained per second of full twirling, and lost per second once the twirling stops. */
    chargeRate: 0.8,
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
    /** Height of the crest the birches stand on, on top of about 3 of beach and lumps. */
    birchesCrest: 5.2,
  },
  crest: {
    /** How far ahead of the child the colt's family is wheeling, and how far to the east of the way ahead. */
    ahead: 46,
    aside: 10,
    /**
     * Swans do not ride thermals. The family flies a low heavy circuit over the meadow: `base` is how high it is
     * held, `spread` the whole depth of it, `climb` the little it gains while it waits for the last of them.
     */
    base: 15,
    climb: 0.4,
    radius: 16,
    spread: 6,
    /** How fast they go once they have turned north, and how hard they climb out: the going has to be seen. */
    leaves: 15,
    leaveClimb: 3.4,
    /** Seconds in: the colt answers them, they string out and go north, and the child sets it down after them. */
    answers: 1.3,
    goes: 9.5,
    setsDown: 17.5,
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
    gustLift: 0.9,
    /** How far round itself it also feels for wind, so the player's circles do not have to be dead centre on a moving bird. */
    reach: 2,
    /** Seconds the colt is left trying in the meadow before the child gathers it up and walks on. */
    tryFor: 60,
  },
  piano: {
    /** Gust energy over the keys that starts a run of notes, and the energy that makes the longest, loudest one. */
    gustFrom: 0.2,
    gustFull: 0.75,
    /** Notes in a run, from a breath to a full gust, and the seconds between them at each. */
    runLeast: 3,
    runMost: 9,
    spaceSlow: 0.2,
    spaceFast: 0.075,
    /** Rising air held over the keys that rolls a chord, and how often it rolls another while it is held. */
    liftFrom: 0.45,
    chordEvery: 3.4,
    /** Seconds between the single notes the prevailing breeze alone finds, and the wind speed it needs. */
    breezeLeast: 7,
    breezeMost: 15,
    breezeSpeed: 1.3,
    /** How far a key dips as it sounds, and how long it takes to come back up. */
    dip: 0.045,
    dipRelease: 0.3,
    /** How near the camera has to be for the piano to sound at all, and where it is loudest. */
    heardWithin: 62,
    heardFully: 16,
    /** Seconds the child sits with nothing played before they walk on, and the longest they ever stay. */
    listenFor: 8,
    stayFor: 45,
    /** How far the room's music pulls back while they are sitting at it. */
    hush: 0.5,
  },
  birches: {
    /** Gust energy and wind speed at which a leaf with an average grip on it lets go of the branch. */
    gripEnergy: 0.28,
    gripSpeed: 5.5,
    /** Leaves shed per second by the prevailing breeze alone, as a share of what is left on the tree. */
    trickle: 0.0016,
    /** How fast a tree goes bare: per second of a full gust standing in it, and per second of breeze. */
    stripRate: 0.55,
    stripTrickle: 0.0016,
    /** Wind speed at which stripping is in full flood; below `gripSpeed` the breeze only trickles. */
    stripSpeed: 15,
    /** How wide a fallen leaf is, in world units. */
    leafSize: 0.22,
    /** How hard the swing is pushed by the air along its travel, and by a gust however it is blowing. */
    swingPush: 0.8,
    swingGust: 3.8,
    /** How long a swing takes to die away when nobody is pushing it (seconds to lose most of it). */
    swingDamping: 0.13,
  },
  washing: {
    /** Wind speed that lifts a sheet all the way to horizontal; the breeze alone lifts it `wind.breeze` / this. */
    fullSwingSpeed: 18,
  },
  /** The kite over the far beach and the pinwheels along the walk: the child nobody has seen. */
  linesToys: {
    /** How much string is out. The kite flies at three quarters of it in the breeze and nearly all of it in a gust. */
    stringLength: 34,
    /** How high the kite rides in the island's own breeze, in radians above the horizon from its tie-off. */
    flyAngle: 0.42,
    /** How wide it swings its figure of eight, in radians, and how fast that turns over, in radians a second. */
    swoop: 0.42,
    swoopRate: 0.26,
    /** Radians of climb per unit of gust energy reaching the kite, and the spring that answers it. */
    gustClimb: 0.16,
    climbSpring: 2.4,
    climbDamping: 2.2,
    /** Pinwheels: radians a second of spin per unit of wind through the wheel. */
    spinPerSpeed: 1.55,
    /** How fast a wheel takes the wind up and how slowly it gives it back, per second. A gust has to linger. */
    spinUp: 3.2,
    spinDown: 0.6,
    /** How quickly a wheel turns on its stick to face the wind. */
    veerRate: 1.2,
    /** Seconds of turning a spinning wheel smears over: what makes a gust visible running down a row. */
    smearSeconds: 0.075,
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
