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
    /** How near on screen (in screen heights) circles have to be drawn to something the story asks to have lifted for the column to stand there. */
    anchorNear: 0.32,
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
    coaxAfter: 2.2,
    coaxRamp: 10,
    /** The invitation's loops: turns a second, their radius, how high they climb, and how brightly they show. */
    coaxLoops: 0.85,
    coaxRadius: 1.0,
    coaxHeight: 2.6,
    coaxAlpha: 0.72,
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
    /** The family resting on the pond beyond the crest: how many of them, and how wide the raft is spread. */
    family: 15,
    raft: 6.5,
    /**
     * How far the air is allowed to see at the crest. The reveal looks out over falling ground and open water
     * now, so the veil has to stand between the swans and the next island in the chain, which is behind them.
     */
    haze: 0.86,
    /** Seconds in: the cygnet answers them; seconds on the rise looking down before the child goes on to the water. */
    answers: 1.3,
    looks: 11,
    /** How far back from the waterline the child stops, and how long they stand there before the family goes. */
    standOff: 3.6,
    goes: 3.2,
    /** How fast the family goes once it is up, and how hard it climbs out: the going has to be seen. */
    leaves: 12,
    leaveClimb: 3.4,
    /** Seconds after the family has gone before the child kneels and sets the cygnet down after them. */
    setsDown: 8.5,
    /** How far in front of the child the cygnet is put down, and how long it waits before its first try. */
    setDownAt: 2.6,
    firstTry: 2,
    /** Seconds it keeps its eyes on the sky they left by, after which they are out of sight for good. */
    watches: 7,
  },
  colt: {
    /**
     * How much of the gust energy brushed under the colt counts as rising air. It takes off above 0.5 of lift, and
     * energy tops out at 1.6, so a bare gust makes it hope and open its wings but never lifts it: the lift is the
     * spiral the wind shows them, and the player draws it. Nothing is failed if they never do.
     */
    gustLift: 0.25,
    /** How far round itself it also feels for wind, so the player's circles do not have to be dead centre on a moving bird. */
    reach: 2,
    /** Seconds the colt is left trying in the meadow before the child gathers it up and walks on. */
    tryFor: 60,
  },
  summit: {
    /**
     * The last lift is the whole gesture, not a flick: the updraft under it has to stand this tall (a bare gust
     * brushes about 1.4 at most, a wound column about 4) and be kept there this long before it goes. Nothing
     * times it out; the family only comes over calling now and then to show what is being asked.
     */
    liftToFly: 2.2,
    liftFor: 3,
    promptAt: 55,
    promptEvery: 70,
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
    /** Seconds the child sits with the player playing nothing before they walk on, and the longest they ever stay. */
    listenFor: 20,
    stayFor: 90,
    /** The lullaby: seconds between its notes, how long it waits for an answer before saying a phrase again. */
    phraseSpacing: 0.42,
    sayAgain: 8,
    /** How much less wind than a run normally takes counts as an answer while the piano is waiting for one. */
    answerEase: 0.2,
    /** How often a phrase is said to nobody before the piano stops waiting and plays the whole tune by itself. */
    saysTwice: 3,
    /** The cygnet on the keys: how long it takes to walk them, and how far along them it starts and finishes. */
    walkKeys: 6.5,
    walkFrom: 0.46,
    walkTo: 0.95,
    /** How far the room's music pulls back while they are sitting at it: all the way, so the tune is heard alone. */
    hush: 1,
    /** How loud it is against everything else, once the listener is near enough to hear it fully. */
    loudness: 3,
    /**
     * The wind line the phrase is shown with: how far over the keys it runs, how fast it chases the key that is
     * sounding, how long after the last note it holds on, and how it floats off — slowly while it waits, and away
     * altogether once the player has played the phrase back.
     */
    lineOver: 0.1,
    lineChases: 11,
    lineHolds: 0.85,
    lineRise: 0.3,
    lineBlown: 2.6,
    /** How thick the streak is drawn, in world units, and how strongly it shows. */
    linePen: 0.085,
    lineAlpha: 0.8,
    /**
     * The one frame the whole duet is played in: how far round from square on the keyboard the camera stands (so
     * left and right on screen is along the keys and the child's head is off them), how far back and how high
     * above the keys, how much further out it waits while they are still walking to it, and how much nearer it
     * comes while the cygnet is walking the keys.
     */
    frameTurn: 0.34,
    frameBack: 11,
    frameUp: 3.4,
    frameLook: 0.5,
    frameWide: 9,
    frameHigh: 1.8,
    frameCreep: 2.4,
    framePace: 0.32,
    /**
     * And the one move out of it, when the tune is whole and the island goes green: how long the rise takes, how
     * far back and how high it comes to rest, how far along the way north its eye travels, how fast the camera
     * follows the move, and how much less of all of it a wake nobody answered gets.
     */
    riseFor: 9,
    riseBack: 30,
    riseUp: 13,
    riseOn: 18,
    risePace: 0.6,
    riseQuiet: 0.72,
  },
  wood: {
    /** How fast a coal in the litter catches under the player's breath: 1 is a coal taken by about one good gust. */
    catchRate: 2.2,
    /** Seconds a coal burns from a full catch if nobody fans it again. */
    burnFor: 46,
    /** How high fanning can run a burning coal up, and how much of that rush is thrown as light. */
    flareMax: 2.2,
    flareLight: 1.2,
    /** How much light a coal makes, against the light the child will walk by (`ENOUGH` in the chapter, 1.2). */
    coalLight: 3.1,
    /** Heat a gust turns up out of bare wet litter where there is no coal: cinders, and an answer to every gust. */
    stir: 2.2,
    /** How far up the path the next coal is laid, and how far off the middle of it, so the chain is a walk. */
    chainStep: 15,
    chainOffset: 2.6,
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
    /** Wind speed, in units a second, that takes a leaf of average weight off the floor and sends it skittering. */
    litterTakes: 4.4,
    /** How fast a gust sweeps the floor bare where it blows, and the share of the wind speed the swept litter travels at. */
    litterSweep: 1.35,
    litterCarry: 0.6,
    /** How fast leaves heaped steeper than they will stand run off sideways, and the slope they will stand at. */
    litterSlump: 3.0,
    litterRepose: 0.95,
    /** How high a heap of leaves stands, per unit of depth. */
    pileHeight: 0.34,
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
  /**
   * The fledging over the summit: the first flight it makes of its own, flown round the child. The circuit starts
   * small, low, fast-beating and thrown about, and opens out into long strokes and a held bank by the last lap.
   */
  fledge: {
    /** Seconds of the circuit, of coming out of it toward the child, and of hanging in front of them before it goes. */
    loopFor: 12,
    swingFor: 2.4,
    hangFor: 3.4,
    /** How wide the circuit is on the first lap and on the last, and how far it is squashed toward the camera. */
    radiusFrom: 4.2,
    radiusTo: 7.8,
    squash: 0.62,
    /** How far toward the camera the circuit's centre stands, so it passes nearer the lens than anything else flying. */
    offset: 2.5,
    /** How high above the child's ground it flies on the first lap and on the last. */
    heightFrom: 3.2,
    heightTo: 8,
    /** How fast it goes round, in units a second, on the first lap and on the last. */
    speedFrom: 4.2,
    speedTo: 8.2,
    /** Wingbeats a second: too many at first, and a swan's own long stroke by the end. */
    beatFrom: 3.3,
    beatTo: 2.1,
    /** A lurch: units of height it loses, radians of heading it is thrown off, radians of wing it drops. */
    sag: 1.8,
    yawThrow: 0.45,
    wingDrop: 0.6,
    /** The bank it holds by the last lap, in radians, and the seconds it spends leaning over to look down at the child. */
    bank: 0.55,
    looksFor: 2.8,
    /** Where it comes round to hang in front of the child's face, and how high above their feet: clear of the hill. */
    hangAt: 4.2,
    hangHigh: 4.5,
    /** Nose-up of the flare it stops on, and of the hang it holds while it calls. */
    flare: 0.72,
    /** Wingbeats a second of the flutter that holds it there. */
    hangBeat: 3.6,
    /** Seconds into the flight to its family at which the last over-correction comes, and how long it lasts. */
    wonkAt: 1.3,
    wonkFor: 1.2,
    /** How far it bobs in the last place of the V once it has it: a station held, but not the way its family holds one. */
    joinBob: 0.32,
  },
  /** The pod that runs with the boat on the long crossing, and the two set-pieces it plays. */
  dolphins: {
    /** A grown one, beak to fluke notch, in world units; the boat it runs with is 4.8 long. */
    length: 3.3,
    /** Seconds into the crossing for the first leap over the bow, and for the first shove on the quarter. */
    leapAt: 26,
    pushAt: 68,
    /** The wait before either comes round again, and how much of that is chance. */
    restLeast: 40,
    restSpread: 25,
    /** How fast the leap leaves the water, in units a second: it clears the bow and falls back on the far side. */
    leapLift: 7.4,
    /** What a shove does to the hull: radians of heel away from it, radians a second of yaw, and units of surge. */
    shoveHeel: 0.17,
    shoveYaw: 0.38,
    shoveSurge: 1.9,
    /** Seconds after a shove at which it is felt hardest; it is gone about six times that later. */
    shovePeak: 0.32,
  },
  petals: {
    /** Share of the 8192 petals alive on the still island, and in the short pasture past z = -600. */
    stillIslandShare: 0.7,
    pastureShare: 0.12,
    /** Wind speeds between which a bare gust, with no updraft, starts to lift resting petals. */
    liftFrom: 9,
    liftTo: 20,
  },
  water: {
    /** Extra normal slope a gust ruffles into the sea it crosses. */
    ruffle: 0.085,
    /** How far a gust darkens that water, as a share of its colour. */
    darken: 0.13,
    /** Height of the small chop a gust lays over the swell, in world units. */
    chop: 0.12,
    /** Gust energy at which a sail starts to luff, and the seconds a luff takes to die away. */
    luffFrom: 0.12,
    luffFade: 0.55,
  },
  /**
   * The sleeping island: the fog pooled in the hollow, the frost coming in across it, and the bedroom the bed
   * stands in. The story drives `fog`, `frost`, `dawn`, `curtains` and `blanket`; these are what those mean.
   */
  sleeping: {
    /** How thick the pooled fog is at full `fog`, and how far out from the hollow it reaches. */
    fogThickness: 0.32,
    fogReach: 34,
    /** The height its top surface lies at, and how softly it gives out there: the hill has to stand out of it. */
    fogTop: 4.6,
    fogSoft: 1.5,
    /** How far the top surface drifts up and down, and how fast the noise in it moves with the breeze. */
    fogSwell: 0.7,
    fogDrift: 0.02,
    /** How hard a gust cuts a lane in the fog, how wide the cut is, and the seconds a lane takes to close again. */
    carveStrength: 4.2,
    carveWidth: 4.2,
    carveCloses: 8,
    /** Wind speed at which a stroke carves at full strength. */
    carveSpeed: 9,
    /** How far out the frost starts and how near the bed it comes, from `frost` 0 to 1. */
    frostFrom: 30,
    frostTo: 2,
    /** The bedside lamp, the one warm thing in the blue, and how far the dawn puts it out of business. */
    lamp: 2.4,
    lampDawn: 0.55,
    /** Seconds the driven values take to ease to what the story asks for, so a switch never pops. */
    ease: 1.6,
    /** How high a gust lifts the blanket by itself, the wind speed that does it, and the seconds it settles over. */
    blanketGust: 0.35,
    blanketSpeed: 7,
    blanketSettles: 2.2,
    /** How far the blanket is thrown back at `blanket` 1, in bed lengths. */
    blanketLift: 0.62,
    /** How wide the curtains are drawn back at `curtains` 1, as a share of the window, and how much they gather. */
    curtainOpen: 0.78,
    curtainGather: 0.45,
    /** The puff of down off the pillow: how many, how fast they leave it, and how long they hang about. */
    downCount: 34,
    downThrow: 1.6,
    downLife: 9,
  },
};

/** A number as a GLSL float literal. */
export const glsl = (x: number): string => x.toFixed(4);
