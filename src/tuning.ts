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
    /** Screen pixels per second under which a press counts as held still and starts an updraft. */
    holdScreenSpeed: 90,
    /** Updraft charge gained per second held, and lost per second once moving. */
    chargeRate: 0.55,
    dischargeRate: 1.2,
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
  colt: {
    /**
     * How much of the gust energy brushed under the colt counts as rising air. It takes off above 0.5 of lift and
     * needs about 0.4 to stay up; energy tops out at 1.6 and fades in about a second, so it has to be kept up.
     */
    gustLift: 0.6,
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
