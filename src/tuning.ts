/**
 * The knobs that set how the game feels, in one place. Speeds are world units per second, the wind field's unit;
 * for scale, the prevailing breeze blows at `wind.breeze` and the hardest stroke makes `pointer.maxGust`.
 */
export const tuning = {
  cinematography: {
    /** Radians either side of the story's preferred view; never an unsolicited reverse angle. */
    freedom: 0.18, reviewEvery: 0.5, holdFor: 6, confirmFor: 1.5, improvement: 0.045,
    authoredPreference: 0.16, compositionResponse: 0.35,
    /** A turn eases into motion as well as out; orbiting preserves foreground distance. */
    turnResponse: 2, maxTurnSpeed: 0.3, reversalBand: 0.12,
    /** Ease focus, dolly and height into motion too. Two poles retain the old walking-follow lag. */
    framingResponse: 2, maxResponse: 1.4,
    primarySafetyMargin: 0.9,
    /** Carry motion is separate from gaze, with a speed bound to reject placement/teleport changes. */
    maxCarrySpeed: 40,
    /** Start clearing scenery before it crosses the child, then settle back slowly. */
    obstacleAhead: 3, obstacleMaxRise: 12, obstacleMaxElevation: 0.3,
    obstacleRise: 2, obstacleRelease: 0.7, obstacleSpeed: 3,
    /** Ease beside a foreground roof while staying on the travelling side of the boat. */
    obstacleSide: 8, obstacleSideResponse: 1, obstacleSideCost: 0.2, obstacleSideImprovement: 0.25,
  },
  audio: {
    /** Keep the ending cue and material implementations available for comparison. */
    homeEndingSounds: false,
    /** Let the Home composition carry the story without extra attenuation for cues. */
    homeMusicDucking: false,
    /** Begin near shore, leaving time for a fade, a real musical rest, and the incoming phrase. */
    arrivalMusicLead: 12, arrivalShoreAllowance: 25, arrivalMusicRouteShare: .65,
    arrivalEntranceLead: 4, arrivalEntranceRouteShare: .4,
    arrivalFadeOut: 3, arrivalQuiet: 3, arrivalFadeIn: 2.5,
    sleepingArrivalQuiet: 3.5, mirrorArrivalQuiet: 4,
    homewardFadeOut: 3, homewardQuiet: 5, homewardFadeIn: 3,
    homewardClearDistance: 30,
    /** Playtest corrections: the opening drone sits 12 dB forward, home 8 dB. */
    openingScoreDb: 12,
    summitScoreLevel: .06555 * 10 ** (8 / 20),
    arrivalPhraseWait: 4.5, phraseReleaseLead: .8,
    openingHandoffSettle: 2.2,
    /** Opening-island and forest chimes gain 6 dB; player wind elsewhere loses 3 dB. */
    laterWindDb: -3,
    /** Reduce how far cursor wind opens its filters, keeping strong gestures less shrill. */
    playerWindFilterRange: .8,
    gestureLevel: .7 * 10 ** (6 / 20), gestureAttack: .006, gestureTailRelease: .3,
    /** Minimum spacing between attacks, including both notes of a glider answer. */
    gesturePulses: 2, forestChimePulses: 4,
    /** Sparse, soft encouragement while guiding the feather uphill. */
    sleepingChimeLevel: .7, sleepingChimePulses: 4,
    authoredCueDuck: .32, authoredCueAttack: .45, authoredCueRelease: 1.3,
    /** A cue raised while a call or Siri interrupts audio still plays if the interruption ends within this. */
    heldCueLife: 3,
    /** Wind can warm the background slightly without making the whole score surge. */
    padActivityLevel: 0.015,
    /** Matches the approved Little Boats preview's music gain, before common playback normalization. */
    boatsScoreLevel: 3.67, boatsCueDuck: 0.28, boatsCueSpace: 3.8,
    /** Approved sea revision: +9.7 dB reference gain and +6.3 dB loudness match, without preview playback gain. */
    seaScoreLevel: 6.31,
    /** Approved Sleeping study's +16.9 dB music match, excluding its playback normalization. */
    sleepingScoreLevel: 7,
    /** Approved Meadow study's +17.9 dB music match, excluding common playback normalization. */
    meadowScoreLevel: 7.85,
    /** Approved Birches revision: +20.3 dB music match, excluding the audition playback boost. */
    birchesScoreLevel: 10.35,
    /** Approved Lines balance (+17.6 dB), excluding preview playback gain; a separate, small melody trim. */
    linesScoreLevel: 7.5858, linesMelodyDb: -1.5, linesCueSpace: 4,
    /** Approved revised study gains, excluding listening-file normalization; the mirror 4 dB up after playtest. */
    mirrorScoreLevel: 10 ** (4 / 20), drownedScoreLevel: 1.8, dreamPhaseFade: 2.8, forestMusicBlend: 4,
    /** Approved distant foghorn; source gain excludes the listening export boost. */
    foghorn: { midi:50, level:.036, pan:.24, attack:1.1, duration:4.6,
      hold:2.65, dryLevel:.22, reverbSend:.35, predelay:.18, diffuseLevel:.8, diffuseSeconds:4.4,
      partials:[[1,.8],[2,.72],[3,.6],[4,.85],[5,.3],[6,.4],
        [7,.18],[8,.08],[9,.22],[10,.055],[11,.035],[12,.025]] },
    careChimeLevel: 0.28, careChimeAttack: 0.035,
    cygnetFullDistance: 30, flockDistance: 320,
    /** Give an authored call and its answer a gap in the incidental flock chatter. */
    callSpace: 4,
    shoreNear: 20, shoreFar: 260, shoreRefresh: 0.75,
    materialLevel: 0.7, materialNear: 20, materialFar: 120,
    /** Close paper handling stays beneath the wind and the recognition melody. */
    paperLevel: 0.35,
    /** Sparse close physical detail: child and bird share one leaf budget, with no wind/particle triggers. */
    leafScuffLevel: 0.4, leafScuffEvery: 1.4, leafCoverMin: 0.55,
    swingCreakLevel: 0.5, swingCreakEvery: 2.4, swingCreakAngle: 0.16,
    birchesFoleyNear: 20, birchesFoleyFar: 65,
    materialEvery: 0.2, waterEvery: 0.42, splashEvery: 0.4,
    /** Distinct sail-tension changes, never a repeated sound for sustained flutter. */
    sailRise: 0.2, sailEvery: 2.4, sailLevel: 0.35,
    /** One quiet fold at full droop; a meaningful refill must re-arm it. */
    sailSettleAt: 0.995, sailSettleRearm: 0.8, sailSettleLevel: 1.13,
    sailSettleBoostDb: 7,
    /** Soft water displacement; separate pod budgets for emergence and re-entry. */
    dolphinSurfaceEvery: 0.6, dolphinLevel: 0.65, dolphinAttack: 0.065,
    /** The whale breathes ahead of the boat; keep its scale audible across that stretch of water. */
    whaleLevel: 0.65, whaleAttack: 0.2, whaleNear: 35, whaleFar: 190,
    clothSources: 3, clothReach: 60, clothLevel: 0.35,
  },
  cygnetMotion: {
    /** Running balance should not become wingbeats during a deliberately slow walk. */
    wingBalanceSpeed: 1.5,
  },
  mirrorCompanion: {
    exploreRadius: 7, bubbleStandOff: 2.2, starStandOff: 1.7,
    /** Keep pace on walks with the child; investigate the reflected lights on planted feet. */
    pace: 1.12, explorePace: 0.3, chooseEvery: 0.55, inspectEvery: 6, stretchFor: 2.4,
  },
  homeLight: {
    /** Keep the drawing in daylight; begin dusk before the walk so the door opens into night. */
    daylight: 0.25, doorstep: 2, response: 0.4, fadeLead: 5, fadeFor: 7.5,
    /** The low sun sits to the left of the cottage, as it does on the unfolded drawing. */
    sunAzimuth: 52, sunElevation: 3.5,
  },
  homeApproach: {
    /** Broad, light distance haze offshore; clear the shore early, then ease out during the jetty walk. */
    haze: 1.04, falloff: 0.35, dockHaze: 0.96, clearFrom: 150, clearAt: 45, clearHaze: 0.5, clearBy: 24,
    /** A shared optical depth lets the whole home hillside emerge together. */
    landDepth: 40,
    /** A low seaward arc discovers the landing, then settles on the existing docking view. */
    departureBearing: -1.12, turnFrom: 0.42, turnTo: 0.96,
    distance: 23, height: 3.4, lookAhead: 8, lookShare: 0.2, noticeFrom: 140, noticeAt: 40, response: 0.5,
    dockFrom: 32, dockAt: 3, dockEyeX: 16, dockEyeY: 3.8, dockEyeZ: 14,
    /** The small waiting lantern stays warm through the returning daylight. */
    lanternDay: 1.6, lanternNight: 3.4, lanternReach: 70,
  },
  homeGrass: {
    /** Retain more blades on home when quality thins the grass; capped at the full population. */
    density: 1.0,
    /** Pasture-height multiplier for the home island. */
    height: 2.16,
  },
  homeReveal: {
    /** A slight angle keeps the real cottage natural while echoing the drawing's front. */
    cottageTurn: -0.12,
    /** Stop beyond the convex shoulder, where the whole cottage clears the foreground grass. */
    stopAfter: 24,
    /** House first; a short look, hands up, then the unchanged 4.2-second physical unfold. */
    noticeFor: 1, handsFrom: 0.3, raiseFor: 2.2,
    /** Let recognition settle, then refold while the melody continues. */
    recogniseFor: 8,
    lookUpFrom: 1.2, lookUpUntil: 2.4, relaxFrom: 2.4, relaxUntil: 4, relaxDrop: 0.16,
    /** After refolding, offer the plane briefly before the wind takes it. */
    releaseFor: 2,
    /** Hold the near edge within reach; the higher shoulder view keeps the drawn sun clear. */
    paperHeight: 2.15, paperForward: 1.7, paperSide: 0, paperTilt: 32,
    /** A little larger when open so the crayon landmarks read clearly. */
    paperScale: 1.1,
    /** One shoulder composition holds both the paper and the distant house. */
    shoulderArc: 0.42, portraitShoulderArc: 0.37, shoulderBack: 6.8, shoulderRise: 5.55, portraitShoulderRise: 7.9,
    shoulderClearance: 1.5, skyLookUp: 0.17,
    /** Let the move develop through the hands coming up and the first folds opening. */
    approachFor: 4.4,
    /** A restrained drift keeps the child, drawing and real house together throughout recognition. */
    readingRise: 0, readingForward: 0.35, readingArc: 0, portraitReadingArc: 0,
    readingFrom: 1.5, readingUntil: 7, readingPaperWeight: 0.65,
    portraitBack: 9.5, narrowPortraitBack: 9.5, paperWeight: 0.65, portraitPaperWeight: 0.6,
    walkArc: 0.2, walkBack: 8, walkRise: 4.6,
    /** Settle at the crest, then stay there as our gaze pans to the house and finally the credits. */
    crestBack: 12, crestRise: 18, homePanFor: 8, descentFit: 3, descentHouseWeight: 0.2,
    returnFrom: 3,
  },
  homeWashing: {
    /** Behind the left side of the cottage, with the far end turned gently away. */
    left: -11.5, right: -5.3, forward: -4, turn: 0.28,
    height: 3.2, scale: 0.62, sag: 0.12, flutter: 0.1,
  },
  swanDeparture: {
    /** Fractions of the travelling speed; ahead birds make room while stragglers gain only a little. */
    slow: 0.65, catchUp: 1.15,
    acceleration: 3, turnRate: 0.9, response: 1.5,
    forwardGain: 0.75, sideGain: 0.65, sideSpeed: 6,
    riseGain: 0.6, riseSpeed: 3, sinkSpeed: 2,
    /** Leave vertical room when two turning paths are about to cross. */
    avoidAhead: 1.25, avoidRadius: 5, avoidRise: 5,
    /** Lay out the V around where their turns will finish, with room for the front birds to ease back. */
    turnAhead: 3, setback: 7,
    /** The small one takes its tail station while the adults are still gathering. */
    cygnetJoin: 8,
  },
  planeGuide: {
    speed: 6, approach: 1.4, response: 6,
    gustFrom: 0.04, gustFull: 0.3,
    travelHeight: 3, sinkSpeed: 5,
    pickupAhead: 1.4,
    returnMargin: 12, returnSpeed: 5,
  },
  meadowPlane: {
    /** Lead the child toward each discovery, then wheel nearby until they catch up. */
    lead: 24, waitAt: 34, resumeAt: 24, brakeFrom: 28, reach: 42,
    returnSpeed: 5, turnRate: 2.5, turnWidth: 8, outwardSpeed: 30,
    height: 28, heightBrake: 18, riseSpeed: 24,
    chaseFrom: 10, chaseNear: 5, retargetEvery: 0.6,
    cameraLead: 6, cameraRise: 6, cameraBack: 44, cameraExtra: 22,
    cameraMargin: 0.78, cameraPace: 0.8,
  },
  planeIndicator: {
    /** Screen pixels beyond the edge to reach full visibility; fade time stays independent of frame rate. */
    edgeFade: 24, fadeRate: 8, opacity: 0.86,
  },
  skyMirror: {
    waterInner: 75, waterOuter: 145, reflectionPrepare: 230,
    /** From on the flat the open sea turns to glass this far from the camera, so the mirror runs on to the horizon. */
    horizonGlassFrom: 40, horizonGlassTo: 110,
    /** How far the camera may be from the flat's centre before the open sea is ordinary again. */
    horizonOnFlat: 160, horizonOffFlat: 320,
    arrivalBlendFor: 10,
    rippleSpeed: 3.6, rippleStrength: 0.06, settleRate: 0.55,
    bubbleRadius: 1.55, bubbleGrow: 1.25, bubbleSpeed: 6.5, bubbleResponse: 28, bubbleStrokeSpeed: 0.4,
    bubbleDrag: 1.4, bubbleFilledDrag: 2.6, bubbleVerticalDrag: 2.6,
    bubbleLift: 4.5, bubbleRelease: 8.5, bubbleReach: 19,
    bubbleHitPadding: 0.055, captureRadius: 2.1, wandRadius: 0.62,
    liftFrom: 0.2, liftFull: 0.65, starRise: 3.2, starHeight: 18,
    boatDriftSpeed: 6, duskFrom: 1.27, duskTo: 1.72, stroll: 1,
    cameraDistance: 27, cameraPortraitDistance: 29, cameraHeight: 8,
    cameraPortraitHeight: 10, cameraLiftFollow: 0.28, constellationReveal: 6,
    cameraRevealExtra: 48, cameraRiseExtra: 35,
    cameraRiseDistance: 32, cameraPortraitRiseDistance: 40,
  },
  littleBoats: {
    /** Small toy sails respond to local gust energy, not the prevailing breeze. */
    windFrom: 0.012, windFull: 0.18, speed: 2.9,
    /** Each toy's best speed as a share of `speed`: hulls sail a little differently, and the child's own (first) is the quickest. */
    pace: [1, 0.93, 0.88, 0.95, 0.9, 0.86, 0.92],
    /** How fast a filled sail brings the hull up to speed, and how slowly still water takes that speed away (per second). */
    drive: 1.7, drag: 0.5,
    fleetReach: 14, childLead: 6.5, bankOffset: 2.2,
    /** Ease the child's toy toward its companion limit instead of hitting it at full speed. */
    followEase: 1.5,
    /** The child hurries along the bank by up to this share of a walk while its toy sails away from it. */
    childHurry: 0.35,
    /** How far the child's toy may sail ahead of the swimming cygnet. */
    swimLead: 7.5,
    /** Nearby wind carries the fleet; each directly blown sail can move independently. */
    fleetCarry: 0.85, outletCurrent: 1.55, offshoreSpeed: 2.1, offshoreEnd: 210,
    /** Carried toys drop that wind between these distances ahead of the child's toy, so the fleet stays in its company. */
    carryAhead: 0, carryAheadEnd: 6,
    /** While the travellers catch up, gathered toys sail no further than this beyond where the child's toy may go. */
    fleetLead: 3,
    /** Course spacing between toys in one lane, and the share more they keep through the offshore turn, which compresses travel. */
    hullSpacing: 3.4, turnRoom: 0.3,
    /**
     * The other toys sail either side of the child's centre lane, never nearer to it than `outletLane` even in the
     * narrow outlet. Hulls this far apart across the stream begin to pass, and pass freely at the second.
     */
    sideLane: 1.75, outletLane: 1.6, passFrom: 1.2, passClear: 1.5,
    /** A hull this close behind a toy it cannot pass hands its own gust on to it; carried along, it keeps this much water spare. */
    nudge: 0.8, berth: 0.3,
    brushSpeed: 1.5, brushRadius: 0.085, brushWindRadius: 3.5, brushEnergyScale: 22,
    inviteAfter: 4, revealFor: 4.5,
    rippleHeight: 0.065, toyDraft: 0.025, sailFillRate: 2.8, sailEmptyRate: 1.4,
    sailSag: 0.48, sailFold: 0.1, sailFlutter: 0.045, sailShake: 0.13,
    heel: 0.13, rollSpring: 13, rollDamping: 3.8, drift: 0.5,
    swimSpeed: 3.15, swimWeave: 0.15, swimPlay: 0.8,
  },
  veil: {
    /** Sparse ambient ribbons; pointer strokes only nudge the broad colour field. */
    maxRibbons: 3,
    maxPoints: 76,
    pointSpacing: 3,
    drift: 78,
    ambientLife: 5.8,
    ambientEvery: 3.2,
    colourTravel: 16,
    tapTravel: 12,
  },
  opening: {
    /** Soft ground footprint under flying paper; strength is life per second, alongside the player's wind. */
    planeBloomRadius: 4.5,
    planeBloomStrength: 1.4,
    /** Ground speed below which the paper has all but stopped and no longer greens what it passes over. */
    planeBloomFrom: 0.3,
    /** A held view of the sea, then one clear recovery before the small bird loses the V. */
    outlook: 3.5,
    flight: 5,
    fall: 5,
    flockSpeed: 6.5,
    flockHeight: 19,
    /** The landing stays this far ahead after the approach, plus any distance lost while struggling. */
    fallTravel: 18,
    /** Give the kneeling hands a clear foreground while keeping the lost bird hidden before the rescue. */
    careGrassRadius: 7.5,
    careCameraHeight: 4.1,
    /** Sheltered cloth hangs deeper; the cove releases its shelter once the boat is afloat. */
    sailGather: 0.48,
    sailSag: 1.65,
    departureRate: 0.42,
    departureGustFor: 2.2,
    departureGustSpeed: 3.2,
    departureGustEnergy: 0.018,
  },
  boarding: {
    /** Plant against the hull, then keep one continuous step over the gunwale and down onto the thwart. */
    push: 0.72,
    launch: 0.66,
    rail: 1.42,
    inside: 1.92,
    seated: 2.36,
    settle: 2.82,
    /** Places in the boat's own frame: just above the gunwale, then safely inside it. */
    railIn: 0.78,
    railHeight: 0.66,
    insideIn: 0.28,
    insideHeight: 0.3,
    stepArc: 0.24,
  },
  cygnetCalls: {
    /** Three cream strokes accompany the cygnet's voice throughout the journey. */
    height: 2.1,
    size: 1.05,
  },
  paperCarry: {
    /** Small enough to carry against the bag; the larger airborne silhouette remains easy to follow. */
    scale: 0.5,
    sizeRate: 9,
    /** The arc around the shoulder when the paper moves between the mitten and the satchel. */
    transferArc: 0.95,
    transferRate: 3,
    /** A released plane levels into flight rather than snapping out of the carry angle. */
    releaseSeconds: 0.22,
  },
  pointer: {
    /** The wind speed a stroke can never exceed; faster strokes ease toward it. */
    maxGust: 26,
    /** Wind speed per unit of cursor speed over the ground, moving freely and with the button held. */
    hoverGain: 0.15,
    pressedGain: 0.19,
    /** Strokes slower than this make no wind at all. */
    minGust: 0.6,
    minLift: 0.01,
    /**
     * Tracing circles with the cursor winds up an updraft in the middle of them. The turning rates, in radians per
     * second on screen (6.3 is one loop a second), at which it starts to build and at which it builds fastest.
     */
    twirlFrom: 2.2,
    twirlFull: 5.2,
    /** Updraft charge gained per second of full twirling, and lost per second once the twirling stops. */
    chargeRate: 0.8,
    dischargeRate: 1.2,
    /** How near on screen (in screen heights) circles have to be drawn to something the story asks to have lifted for the column to stand there. */
    anchorNear: 0.6,
  },
  invitation: {
    /** Readable air at game distance, including the unlit wood. Widths are CSS pixels. */
    minPixels: 6, maxPixels: 10, lightFloor: 0.8,
    tail: 0.48, curl: 0.12, spread: 0.045,
    handover: 12, resumeAfter: 1.4,
    screenMargin: 0.08,
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
    /**
     * What a hanging thing feels (cloth, a sail, a kite, a leaf on its twig). A stroke moves the air a long way
     * off at once, because air cannot pile up; only the gust itself, carried downwind, counts as wind arriving.
     * Air moving without gust energy in it is felt no harder than `calm` times the prevailing breeze, and a gust
     * is felt in full once its energy has risen from `arriveFrom` to `arriveFull`.
     */
    calm: 1.35,
    arriveFrom: 0.02,
    arriveFull: 0.35,
    /** The spring hanging things swing on: soft enough to arrive late, overshoot and swing back. */
    swayStiffness: 26,
    swayDamping: 4.2,
  },
  world: {
    /** Seconds to cover an incoming shore before enabling it, then release it into the ordinary distance fog. */
    arrivalFogCover: 1.2,
    arrivalFogClear: 6,
    /** Coast-relative radii: land and props sit inside the opaque centre; the outer edge dissolves over water. */
    arrivalFogInner: 1.2,
    arrivalFogOuter: 1.32,
    /**
     * The island ahead lies in mist beyond `clear` to `hidden` units from the eye: the wood past its farthest trees,
     * the sleeping island everywhere but the shore the boat lands on. The bank thins away over the water by `edge`
     * coast radii. It lifts at `isleMistLift` once they are ashore.
     */
    woodMist: { clear: 110, hidden: 165, edge: 1.32 },
    sleepingMist: { clear: 40, hidden: 72, edge: 2.4 },
    isleMistLift: 0.45,
    /** Birches-style distance veil near Lines; the first island farewell keeps the original clear haze. */
    linesCrossingHaze: 1.03,
    /** Metres from the arrival berth over which the stronger haze develops as the farewell camera releases. */
    linesHazeFrom: 330,
    linesHazeTo: 270,
    /** Soften the meadow's bare distant bank while preserving the nearby Little Boats departure. */
    meadowCrossingHaze: 0.98,
    /** North to south length of the meadow. It was sculpted 600 long and is shown as a scale model of that. */
    meadowLength: 400,
    /** Offshore veil in multiples of the meadow's coastline radii; opaque before the neighbouring islands. */
    meadowVeilFrom: 1.08,
    meadowVeilTo: 1.3,
    /** Lower the ridge between the beach crest and the piano's patch of colour. */
    meadowPianoSaddle: 6,
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
    haze: 0.96,
    /** Seconds in: the cygnet answers them; seconds on the rise looking down before the child goes on to the water. */
    answers: 1.3,
    looks: 5,
    /** The family starts its journey while the child is still standing on the rise. */
    migrationLeadFor: 2.8,
    /** How far back from the waterline the child stops; the flock reacts this far before they reach that spot. */
    standOff: 1.6,
    startleFrom: 10,
    /** Short grass at the water's edge gives the child's hands and the little swimmer a readable shore. */
    bankGrass: 0.18,
    bankCropFrom: 1.18,
    bankCropTo: 1.55,
    /** Come round onto the water after the flock leaves, then keep both companions inside the frame. */
    pondView: 2.15,
    pondPortraitView: 2.7,
    pondCameraBack: 9,
    pondCameraUp: 5.5,
    /** Hold the child and the whole departing family, allowing more room for the V on a phone. */
    departureToward: 0.55,
    departureCameraBack: 20,
    departureCameraReach: 0.35,
    departureCameraUp: 14,
    departureCameraExtra: 80,
    /** The nearest birds raise their heads and paddle away before running; the reaction spreads through the raft. */
    startlePause: 0.7,
    startleStagger: 0.24,
    startlePaddle: 0.65,
    /** How fast the family goes once it is up, and how hard it climbs out: the going has to be seen. */
    leaves: 12,
    leaveClimb: 3.4,
    /** Watch the startle, staggered runs and climb before turning back to the child's hands. */
    setsDown: 8.5,
    pondReturn: 3.5,
    /** Seconds it keeps its eyes on the sky they left by, after which they are out of sight for good. */
    watches: 7,
  },
  wingCare: {
    dressFor: 4.8,
    lookBackFor: 2.2,
    openFor: 2.8,
    unwindFor: 3.2,
    /** Pond: a small separation, then a deliberate return to the child's hands. */
    pondOut: 5,
    pondWatchFor: 3.5,
    pondReturnAfter: 12,
    pondEntryLimit: 18,
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
  },
  swanArrival: {
    turnRate: 0.72, acceleration: 2.4, response: 1.6,
    radialGain: 0.7, radialSpeed: 7, speedSpread: 2,
  },
  summit: {
    /** A tangent approach, then a readable circuit before the small one asks to join. */
    arriveAt: 1.5, turnAt: 5, callAt: 14, setDownAt: 17,
    wheelRadius: 22, wheelAhead: 38, wheelHeight: 13,
    arrivalBack: 32, portraitBack: 64, arrivalRise: 7, arrivalLookAhead: 22,
    flightSide: -7, flightBack: 20, flightEye: 4, flightLookUp: 2.6, flightLookAhead: 5,
    /**
     * The last lift is the whole gesture, not a flick. A column of `liftToFly` gets it off the ground (a bare gust
     * brushes about 0.4 at most, a wound column 1.5 to 2.5), and then it climbs only as fast as the player keeps
     * winding (`gain` height a second per unit of updraft, at most `rise`) and sinks at `sink` the moment they stop.
     * The family comes down for it once it has been held up `liftTo` above the grass. Nothing times it out; they
     * wheel in sight to the north and call every `callEvery` seconds to say what is being asked.
     */
    liftToFly: 0.6,
    gain: 1.6,
    sink: 1.4,
    rise: 0.9,
    liftTo: 5.5,
    callEvery: 9,
  },
  piano: {
    initialRadius: 13, initialSoft: 4,
    /** The visible sweep is the hit target, measured in screen heights rather than terrain distance. */
    guideSpan: 1.65, guideOver: 1.35, guideTolerance: 0.045,
    guideCycle: 3.2, guideSweep: 1.8, answerVelocity: 0.6,
    phraseRest: 9, finaleWaveAfter: 0.35, completionRest: 1.2,
    /** Each completed sweep sends music across a larger stretch of the visible meadow. */
    responseReach: [45, 85, 125], responseSpeed: [12, 19, 26],
    responseLift: 2.2, responseHold: 5.4, responseReturn: 8,
    responseBack: [34, 46, 58], responseUp: [19, 30, 41], responseOn: [13, 16, 21],
    waveWidth: 0.65, waveAlpha: 0.55, waveOver: 1.3,
    growthRoughness: 14, growthSoftness: 6,
    traceCurl: 0.9, traceOrbit: 0.9, traceDrift: 0.55,
    waveCurl: 0.075, waveCurlRadius: 11, waveSwirl: 0.55,
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
    /** The lullaby: seconds between its notes, how long it waits for an answer before saying a phrase again. */
    phraseSpacing: 0.42,
    sayAgain: 8,
    /** The cygnet on the keys: how long it takes to walk them, and how far along them it starts and finishes. */
    walkKeys: 6.5,
    walkFrom: 0.46,
    walkTo: 0.95,
    /** How far the room's music pulls back while they are sitting at it: all the way, so the tune is heard alone. */
    hush: 1,
    /** Fade from sitting through the first key, reaching silence before the demonstration phrase. */
    fadeOut: 2.2, fadeIn: 3.2, mixResponse: 0.12,
    /** How loud it is against everything else, once the listener is near enough to hear it fully. */
    loudness: 3.8,
    /** How thick the streak is drawn, in world units, and how strongly it shows. */
    linePen: 0.085,
    /**
     * What every note does to the meadow: the trace it lifts off its key and runs up the hill behind the piano.
     * How long it takes to lift clear of the case and how fast it climbs while it does; how fast it runs and how
     * long it lives (longer for low notes); how high it rides over the grass at the bottom and the top of the
     * keyboard; how readily it bends with the wind that is blowing; its width; and the colour it plants as it
     * goes, as a radius and a rate of life per second.
     */
    traceLift: 0.45,
    traceClimb: 4.5,
    traceSpeed: 11,
    traceFor: 6,
    traceLonger: 1.4,
    traceLow: 1.2,
    traceHigh: 0.8,
    traceBends: 0.025,
    /** How far the traces fan across the hill from the bottom of the keyboard to the top, in radians. */
    traceFan: 2.5,
    traceWidth: 0.15,
    bloomRadius: 10,
    bloomRate: 3,
    /**
     * The one frame the whole duet is played in: how far round from square on the keyboard the camera stands (so
     * left and right on screen is along the keys and the child's head is off them), how far back and how high
     * above the keys, how much further out it waits while they are still walking to it, and how much nearer it
     * comes while the cygnet is walking the keys.
     */
    frameTurn: 0.28,
    frameBack: 19,
    frameUp: 4,
    frameLook: 1.2,
    frameOn: 6,
    frameWide: 3,
    frameHigh: 1.8,
    framePace: 0.32,
    approachShare: 0.65, approachBack: 0.45, approachMargin: 0.84, approachExtra: 35,
    /**
     * And the one move out of it, when the tune is whole and the island goes green: how long the rise takes, the
     * bearing it spirals round to, how far back and how high it comes to rest, how far along the way north its
     * eye travels, how fast the camera follows the move, how long it rests before the child gets up, and how much
     * less of all of it a wake nobody answered gets.
     */
    riseFor: 10,
    riseTo: -0.12,
    riseBack: 65,
    riseUp: 46,
    riseOn: 24,
    risePace: 0.6,
    restFor: 9,
    riseQuiet: 0.72,
  },
  wood: {
    lightningScale: 0.28,
    /** Cool silhouettes remain between embers; the player supplies the warm, revealing light. */
    ambientScale: 0.28,
    moonScale: 0.85,
    skyScale: 0.4,
    grassDensity: 0.25,
    grassBaseCrop: 0.15,
    grassTuftCrop: 0.70,
    grassPatchScale: 0.22,
    /** Ignition gained per screen-height unit brushed directly across the ember. */
    catchRate: 1.8,
    /** A deliberate sweep must cross the ember itself; residual wind cannot finish the gesture. */
    brushRadius: 0.2,
    brushTravelMin: 0.001,
    brushStepMax: 0.06,
    wakeCool: 0.045,
    inviteAfter: 5,
    inviteSweep: 1.8,
    invitePause: 1.5,
    inviteSpan: 3.8,
    inviteAlpha: 0.65,
    inviteWidth: 0.065,
    /** Cosmetic only: recovered paper lightens during the walk, without holding up departure. */
    paperRecoverSeconds: 2,
    /** The approved orb breathes above the litter, with veils that yield to the live wind. */
    orbSize: 1.35,
    orbRestScale: 0.38,
    orbRestAlpha: 0.24,
    orbLightResponse: 2.8,
    orbHover: 0.95,
    orbBob: 0.055,
    orbResponse: 5,
    orbWindLean: 0.08,
    /** Sheltered fireflies gather closer under the trees than in open grass. */
    fireflyCount: 240,
    fireflyRange: 25,
    fireflyPresence: 0.85,
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
    chainStep: 20.25,
    chainOffset: 2.6,
    /** Bring the next light closer after pickup and keep it beside the child's silhouette. */
    rescueChainStep: 12,
    afterRescueCameraSide: 2.8,
    cameraBack: 13,
    cameraUp: 2.8,
    cameraLead: 0.36,
    cameraPace: 0.65,
    cameraFitResponse: 1.2,
    /** A nearby separation: the child and bird share the frame throughout. */
    shelterDistance: 12,
    frightThunderDelay: 0.16,
    frightStrength: 1.45,
    frightCompose: 2.2,
    frightJumpAfter: 1.65,
    frightJumpDuration: 1.3,
    frightLandingPause: 0.3,
    scrambleGain: 0.12,
    frightJumpDistance: 2.3,
    frightJumpArc: 0.45,
    rescueResolve: 1.4,
    coaxWait: 2.2,
    refugePause: 1.2,
    frightenedPace: 0.65,
    planeSnagHeight: 4.6,
    planeStrokeDistance: 0.95,
    planeTugResponse: 9,
    planeFallSeconds: 1.8,
    planeEmberHold: 0.55,
    planeTreeSway: 0.11,
    planeSwayRate: 0.7,
    planeIdleRock: 0.055,
  },
  birches: {
    scarf: {
      width: 0.9,
      brushRadius: 0.2,
      brushSpeed: 1.4,
      strokeDistance: 0.5,
      circleDistance: 6.5,
      circleChargeFrom: 0.12, circleChargeFull: 0.55,
      bowDistance: 0.2,
      slipDistance: 0.28,
      gestureResponse: 10,
      inviteAfter: 0.8,
      inviteResume: 0.8,
      inviteAlpha: 0.9,
      inviteWidth: 0.085,
      inviteSweep: 1.6,
      invitePause: 0.45,
      inviteSpan: 4,
      inviteBowSpan: 5,
      inviteCircleRadius: 1.65,
      swingOfferSeconds: 12,
      releaseSeconds: 2.6,
      gatherSeconds: 8,
      windResponse: 2.8,
      flutter: 0.1,
      clothGravity: 8.5,
      clothDrag: 1.1,
      clothBend: 0.018,
      clothWind: 0.22,
      clothLift: 12,
      clothClearance: 0.1,
      clothIterations: 14,
      clothSlideResponse: 10,
      clothSlipSpeed: 1.1,
      clothSlipSeconds: 1.2,
      clothSlipReach: 2,
      clothSlipDrop: 1.1,
      arriveWithin: 9.5,
      quietToLeaveSwing: 2.6,
      swingBrake: 3.2,
      swingMountSeconds: 0.8,
    },
    /** The companion explores within sight of the child and responds to local gusts. */
    playRadius: 9,
    playWind: 0.12,
    playPause: 2.5,
    playScuffEvery: 0.3,
    playHopNear: 7,
    playHopReach: 1.6,
    playHopPause: 0.9,
    playChaseReach: 4,
    playDryHeight: 0.8,
    playRummageFor: 1.2,
    playRummageNear: 6,
    playScuffRadius: 0.85,
    playScuffStrength: 0.65,
    swingInvitation: 0.22,
    /** Shed clusters keep their own velocity for this many seconds, then fade. */
    shedFlight: 3.2,
    shedDrag: 1.5,
    /** Seconds for a gust to start carrying the ground litter, and its top transport speed. */
    litterResponse: 0.65,
    litterMaxSpeed: 7,
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
    /** Airborne leaves stay sparse and small enough to see the child and the puzzle through them. */
    airborneKeep: 0.42,
    airborneSize: 0.8,
    leafEyeClear: 3,
    leafEyeFull: 9,
    shedClusterKeep: 0.4,
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
    /** How much later than its pegs the hem takes the wind, in seconds, so a gust runs down the cloth. */
    hemLag: 0.12,
    /** How much of the swing the cloth has already at the pegs; the rest is the belly it fills down its drop. */
    belly: 0.35,
    /** The felt wind at which the cloth begins to shake rather than breathe, and at which it shakes hardest. */
    flutterFrom: 4,
    flutterFull: 15,
    /** How much of the swing the ripple is, breathing in a breeze and shivering in a gust. */
    rippleQuiet: 0.03,
    rippleFull: 0.075,
  },
  /** Making a way through the washing: forgiving wind gestures, an invitation, and the view from below. */
  linesPassage: {
    /** Local gusts count in any direction, and several small sweeps add up. */
    energyFrom: 0.025, energyFull: 0.22,
    speedFrom: 0.4, speedFull: 3,
    fillSeconds: 1.8,
    billowSpeed: 6, rise: 3.5, settle: 1.2,
    brushFrom: 0.8, brushRadius: 0.27,
    /** A warm sideways trace on the first sheet demonstrates a sweep, without generating any wind. */
    inviteAfter: 1.2, inviteSweep: 1.8, invitePause: 1.1, inviteResume: 2.2,
    inviteWidth: 0.11, inviteAlpha: 0.85, inviteSpan: 0.66,
    /** Let the little bird try first, then the child follows beneath the raised hem. */
    birdLead: 1.4, lookBack: 1.5,
    revealFill: 2.8, revealHold: 4.5,
    doorApproach: 5.5, doorCross: 7, shorePause: 4,
    portalScale: 0.75,
    shorePlaneInset: 14, shorePlaneRadius: 5,
    walkDistance: 16, walkHeight: 1.4,
    curtainDistance: 17, curtainHeight: 0.9,
    viewClearanceAhead: 31, viewClearanceRadius: 5.5,
  },
  family: {
    /** Soft fullness and shoulder movement, as fractions of the piece's width. */
    chest: 0.07,
    shoulders: 0.02,
    /** Small cuff movements: keep the fabric below its pegs and avoid long, pointed arms. */
    reachUp: 0.13,
    reachOut: 0.16,
    /** Delay per garment within the gesture; the small jumper answers both parents. */
    answerDelay: 0.14,
    childLift: 0.15,
    /** Open the door once the sleeves have nearly met. */
    doorAt: 0.96,
  },
  /** The kite over the far beach and the pinwheels along the walk: the child nobody has seen. */
  linesToys: {
    /** The last bend reveals the little-boats departure marker, after the first two pools. */
    boatKiteRevealAt: 85,
    /** A shorter tether keeps the kite beside the boat in the narrower departure views. */
    shoreKiteStringLength: 22,
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
  crossingCamera: {
    /** One journey through the shot: open departure, near companions, then room for the approaching shore. */
    departureUntil: 0.32, arrivalFrom: 0.68,
    nearDistance: 16, departureDistance: 23, arrivalDistance: 24,
    nearHeight: 4.5, departureHeight: 5, arrivalHeight: 5.8,
    /** Travel behind the boat; the small offset keeps the mast from bisecting the companions. */
    nearBearing: 0.12, departureBearing: 0.18, arrivalBearing: 0.08,
    nearLead: 1.5, departureLead: 3, arrivalLead: 5,
    /** Look back past the open side of the sail, with enough lateral room to see the waving child. */
    farewellBearing: 0.45, farewellWeight: 0.3, farewellEstablish: 6, farewellRelease: 14,
    farewellBoatExtent: 3.2, farewellMastHeight: 4.8,
    sideResponse: 1.2, childTurn: 0.7,
    whaleWeight: 0.38, whaleBack: 6, whaleRise: 1.2, whaleExtent: 10,
  },
  seaPassage: {
    speed: 10,
    arrivalSpeed: 3.5,
    /** The most the boat makes while the cygnet is swimming: ordinary sailing sails on, only a strong gust is trimmed. */
    swimSpeed: 5,
    /** How much of the boat's way the wave along its side gives the swimming cygnet, and how fast the swim's cap comes in. */
    swimCarry: 0.75,
    swimEase: 0.5,
    swimFor: 12,
    swimAnticipation: 2,
    swimDecision: 3,
    swimAt: 0.2,
    /** Let the pod arrive and its featured leap finish even when the player fills the sail. */
    swimNotBefore: 18,
    dolphinsAfter: 5,
    waypointRadius: 10,
    /**
     * How far along the route the first leap may begin: the sleeping island's night lifts only once it is well
     * astern (its palette clears 110 to 150 units from the hollow), and the leap belongs to the first light.
     */
    leapFrom: 0.28,
    /**
     * Where along the route the pod says goodbye, and about how long its play takes from `leapFrom`: the leap, the
     * swim and the nudge. A boat ahead of that is eased toward it, never below `leastSpeed`. Only a pod still
     * playing past `farewellAt` slows it further, to `holdSpeed` by `holdAt`. The cap eases down at `limitEase` a second.
     */
    farewellAt: 0.8,
    playFor: 41,
    /** The most the boat makes as it leaves the island, from which it settles by `leapFrom` into the pod's pace. */
    openSpeed: 5.5,
    leastSpeed: 3,
    holdSpeed: 1,
    holdAt: 0.92,
    limitEase: 0.6,
    swimBeside: 2.4,
    cameraDistance: 23,
    cameraHeight: 5.1,
    swimCameraDistance: 16,
    swimCameraHeight: 4.6,
    cameraBearing: 0.16,
    /** Open a little beside the boat only while the cygnet is swimming. */
    swimCameraBearing: 0.65,
    childTurn: 0.7,
    haze: 0.94,
  },
  /** The pod that runs with the boat on the long crossing, and the two set-pieces it plays. */
  dolphins: {
    /** A grown one, beak to fluke notch, in world units; the boat it runs with is 4.8 long. */
    length: 4.35,
    girth: 1.22,
    quietLead: 8,
    quietEase: 0.22,
    /** Most the lanes open ahead or fall back while the swim has the boat, in units a second on top of its speed. */
    leadRate: 1.6,
    /** Quiet swimming between breaths, with only occasional low porpoises. */
    breathLeast: 3.5,
    breathSpread: 5.5,
    leapChance: 0.3,
    /**
     * Slopes a throw leaves the water at, rise over run, and the most either is in units a second: a breath rolls the
     * back out low, a porpoise clears the water. Their pace sets the speed, so a slow boat never stands them on end.
     */
    breathSlope: 0.22,
    porpoiseSlope: 0.45,
    breathMost: 1.3,
    porpoiseMost: 3.2,
    /** Seconds a breath takes rolling through the surface: it is a swimmer's undulation, never a thrown arc. */
    breathFor: 1.1,
    /**
     * The spurt a porpoise runs on, in units a second over its lane, for how long, and how far out from the boat it
     * veers on it and how fast: the veer is what shows the arc from the side to a camera astern.
     */
    porpoiseBurst: 3,
    porpoiseBurstFor: 1.4,
    porpoiseVeer: 4,
    porpoiseVeerRate: 4,
    /**
     * How a dolphin swims after its station: its fastest and slowest through the water, in units a second, how hard
     * it accelerates, in units a second a second, its tightest turn, in radians a second, and how closely it chases the
     * station, per second. Nothing in the pod ever moves faster than this, whatever the boat or its lane does.
     */
    swimMost: 7.5,
    swimLeast: 1.2,
    swimAccel: 5,
    turnMost: 1.1,
    chase: 1.3,
    /** How fast the pod's frame comes round when the boat turns, in radians a second: no faster than they can swim it. */
    headTurn: 0.4,
    /** The least room they leave each other, and how close to the planking any of them may come. */
    spacing: 2.2,
    hullClear: 1.2,
    /** The most one banks into a turn, in radians, and how hard it leans per radian a second of turn. */
    bankMost: 0.45,
    bankLean: 0.35,
    /**
     * How much of the path's bend the spine takes, tail against beak, so a diving tail stays at the surface until the
     * body has passed; the most it bends, in radians; and the hardest the water slows a landing, in units a second a second.
     */
    archFollow: 0.85,
    archMost: 0.62,
    diveAccel: 5,
    /**
     * The slowest they are ever shaped as swimming, and the least headway their facing allows for, in units a second:
     * keeping station on a slow boat is still swimming, and sliding back along it is swimming slower, not turning round.
     */
    leastPace: 2.5,
    leastHeadway: 1.5,
    /** How far below breathing depth a rise to the surface may start, and how fast the depth it swims at can change. */
    riseFrom: 1.9,
    depthRate: 1.4,
    /** How fast a dolphin playing a set-piece gathers or sheds speed, in units a second a second. */
    stuntAccel: 5,
    /** How fast a rejoining dolphin lets go of what is left of its set-piece station, per second. */
    rejoinEase: 0.8,
    /** Seconds after the pod starts joining for its first leap; the nudge follows the swim, `nudgeAfter` at the soonest. */
    leapAt: 5,
    leapSpread: 1.5,
    leapRecovery: 1,
    nudgeAfter: 3,
    /** Seconds the leaper takes going out to its mark, and running alongside, before it is asked to throw. */
    leapOutFor: 2.8,
    leapRunFor: 3.2,
    /**
     * Where the leaper runs beside the boat before the throw, along and out from it, the speed through the water it
     * leaves at, how far off the boat's course it turns out through the last dip (so the arc is seen from the side,
     * not end-on from astern), and its steepest take-off in radians.
     */
    leapFrom: -1,
    leapBeside: 4.8,
    leapSpeed: 5.5,
    leapAngle: 0.9,
    /** The width the lens shows beside the boat, in units, below which the leap goes straight ahead and above which it goes fully out. */
    leapRoomLeast: 7,
    leapRoomFull: 13,
    leapSteepest: 0.75,
    arrivalSpacing: 3.5,
    arrivalDepth: 7,
    departureFor: 7,
    nudgeRecovery: 1,
    nudgeApproachAlong: -8,
    nudgeApproachAcross: 5,
    nudgeApproachFor: 2.4,
    nudgeApproachMax: 3,
    nudgeRunFor: 1.8,
    /** The roll onto its side for the nudge, in radians, and the depth it holds it at: the flukes stay in the water. */
    nudgeRoll: 0.8,
    nudgeDepth: -0.22,
    /** The wait before either comes round again, and how much of that is chance. */
    restLeast: 40,
    restSpread: 25,
    /** How fast the leap leaves the water, in units a second: it rises alongside, then slips back into the water. */
    leapLift: 6.3,
    /** What a shove does to the hull: radians of heel away from it, radians a second of yaw, and units of surge. */
    shoveHeel: 0.12,
    shoveYaw: 0.18,
    shoveSurge: 0.8,
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
    /** Camera distances over which a petal shrinks away, so one passing the lens never fills it as a flat disc. */
    nearHide: 1.5,
    nearShow: 5,
  },
  water: {
    /** Seconds for wind ripples to build and to settle after a gust. */
    windAttack: 0.6,
    windRelease: 2.8,
    /** Local air is much slower than the cursor after pressure projection; ordinary sweeps must still ruffle it. */
    windSpeedFrom: 0.25,
    windSpeedFull: 2.5,
    windEnergyFrom: 0.025,
    windEnergyFull: 0.55,
    /** Extra normal slope a gust ruffles into the sea it crosses. */
    ruffle: 0.16,
    /** How far a gust darkens that water, as a share of its colour. */
    darken: 0.07,
    /** Height of the small chop a gust lays over the swell, in world units. */
    chop: 0.12,
    /** How many of the night sky's stars the sea catches, and how brightly they flash when it does. */
    stars: 0.11,
    starLight: 5,
  },
  /**
   * The boat's sail. The cloth fills with whatever wind it has, whoever made it, and hangs dead when it has none;
   * the hull's speed follows the same reading, a few seconds behind it. Wind speeds are world units per second,
   * the wind field's unit, so `drive` is boat speed per unit of wind in the sail.
   */
  sail: {
    /** A controlled turn into the meadow bay keeps gusts from landing far along the beach. */
    meadowArrivalSpeed: 5,
    /** Hull clearance above the terrain; enough for the rendered ground between height samples. */
    hullClearance: 0.06,
    /** Most a beached hull leans with the sand beneath it, in radians. */
    shoreTilt: 0.28,
    /** Wind speed a unit of the player's gust is worth, and the stirring the field never quite loses. */
    gustPress: 4,
    stirs: 0.9,
    /**
     * What the squall presses the cloth with at a full sea, and how much of that the sail can hold: a small boat
     * in a storm is a hard-pressed, shaking sail spilling most of it, not four times the way through the water.
     */
    squallPress: 8,
    squallHolds: 0.16,
    /** How fast the cloth takes wind up, and how slowly it lets it go, per second. */
    fills: 3.2,
    empties: 1.2,
    /** Wind speed the belly is two thirds out at, and how deep a full belly is, in world units. */
    bellyAt: 2.4,
    belly: 0.72,
    /** Below this wind speed the cloth begins to hang, and with none in it at all it hangs dead. */
    hangsBelow: 1.3,
    /** Fully slack within half a percent: eased wind approaches zero without ever reaching it exactly. */
    inviteDroop: 0.995,
    /** Seconds of settled cloth before the first sweep, its duration, and the quiet between repeats. */
    inviteAfter: 0.7,
    inviteSweep: 1.8,
    invitePause: 2.4,
    /** A pale brushstroke across the sail, just in front of the cloth. Distances are world units. */
    inviteAlpha: 0.8,
    inviteWidth: 0.12,
    inviteSpan: 5.4,
    inviteStandOff: 1.1,
    /** Wind speed at which the cloth is at its liveliest: the ripple and the leech's shake full out. */
    livelyAt: 10,
    /** With no wind: how far the leech falls in toward the mast, how far the cloth sags, and the folds it hangs in. */
    gather: 0.22,
    sag: 0.8,
    folds: 3.5,
    fold: 0.3,
    /** How far the ripple and the leech's shake move the cloth, in world units. */
    ripple: 0.18,
    /** Ripple phase speed in radians/s, plus the extra at full flutter. Integrated continuously by the boat. */
    rippleRate: 4.5,
    rippleGustRate: 5.5,
    shake: 0.24,
    /** Gust energy at which a sail starts to luff, and the seconds a luff takes to die away. */
    luffFrom: 0.12,
    luffFade: 0.55,
    /** Boat speed per unit of wind the sail holds, the extra for a following wind, and the most it ever makes. */
    // At the ordinary 2.6-unit breeze: 4.5 through the water, up to 5.5 with a following wind.
    drive: 4.5 / 2.6,
    following: 1 / 2.6,
    topSpeed: 10,
    /** Spill wind in a tight turn; the turning radius must shrink as a missed waypoint gets closer. */
    turnBrake: 0.65,
    turnAligned: 0.85,
    minimumWay: 0.45,
    /** Ease alongside the jetty, sheltered from sideways drift over the final boat lengths. */
    mooringDrive: 0.22,
    mooringShelter: 18,
    /** Maximum sideways wind drift as a share of a passage's speed cap. */
    passageDrift: 0.04,
    /** How much a storm spills and shakes the sail even under a steady prevailing breeze. */
    squallLuff: 0.6,
    /** How fast the hull gathers way, and how slowly it carries it once the wind is out, per second. */
    gathers: 0.5,
    carries: 0.45,
  },
  /** Move the shared key light continuously from the sunset to the moon. */
  sky: {
    moonHandoffFrom: 1.5,
    moonHandoffTo: 1.85,
  },
  drownedCamera: {
    /** Follow the boat into the streets; notice the church from that travelling view. */
    roofFromZ: -1260, roofUntilZ: -1360,
    entryBearing: 0.16, roofBearing: 0.10,
    entryDistance: 23, roofDistance: 16, entryHeight: 5, roofHeight: 2.8,
    /** Let the church pass beside us, then return to the channel instead of looking backwards after it. */
    spireEnter: 110, spireFull: 55, spireLeave: 25, spireGone: -5,
    spireDistance: 20, spireHeight: 3.4, spireWeight: 0.3,
    /** Reserve room for the bow and stern while the church reveal eases into place. */
    spireFrameMargin: 0.7,
    sideResponse: 1.2,
  },
  /** One continuous passage from the last drowned houses to the forest beach. */
  storm: {
    passageSpeed: 5.8,
    startsFromShore: 210,
    gatherFor: 22,
    /** One distant ship call, with its tail clear before the first thunder. */
    foghornAt: 8, foghornLateAllowance: 0.25,
    weatherGatherFor: 14,
    lighthouseLookUntil: 21.5,
    lighthouseLookFrom: 3,
    lighthouseLookRelease: 19.5,
    lighthouseFrameDistance: 23,
    lighthouseFrameHeight: -5,
    lighthouseFrameUp: 10,
    lighthouseComfortFor: 2.6,
    lighthouseStartle: 0.18,
    lighthouseLookOffset: 0.12,
    lighthouseCameraPace: 1.1,
    darkBy: 33,
    lighthouseOutAt: 19,
    lighthouseFadeFor: 2.5,
    lighthouseSweep: 0.38,
    lighthouseSweepStart: 1.7,
    stormVeil: 62,
    stormVeilDensity: 0.045,
    moonThroughCloud: 0.2,
    shadowSoftenFrom: 0.8,
    shadowCovered: 0.98,
    snatchFor: 4,
    shakeAt: 7.5,
    cameraQuarter: 0.16,
    lookAhead: 1.3,
    planeAhead: 2,
    planeLookUp: 1.8,
    planeLookFor: 2,
    /** The storm carries the plane off ahead of the boat, low over the wood, until the rain swallows it (this many
        fog lengths deep) or it leaves the frame; whatever happens, it is gone by the fallback. */
    planeAway: { speed: 15, grip: 2.5, rise: 1.2 },
    planeLostInFog: 2.5,
    planeLostAfter: 14,
    firstLightning: 16,
    lightningStormFrom: 0.85,
    lightningNightFrom: 0.06,
    lightningRainFrom: 0.8,
    lightningAttack: 0.18,
    lightningAmbient: 0.6,
    lightningHorizon: 0.18,
    lightningGap: 8.4,
    lightningFade: 0.9,
    thunderDelay: 1.4,
    thunderGain: 0.52,
    thunderPresence: 0.45,
    rainLean: 10,
  },
  /**
   * The sleeping island: the fog pooled in the hollow, the frost coming in across it, and the bedroom the bed
   * stands in. The story drives `fog`, `frost`, `dawn`, `curtains` and `blanket`; these are what those mean.
   */
  sleeping: {
    /** Keep the glide and waking view on the same side of the bed. */
    cameraSide: 7.1,
    cameraBack: 6.4,
    /** How thick the pooled fog is at full `fog`, and how far out from the hollow it reaches. */
    fogThickness: 0.56,
    fogReach: 34,
    /** The height its top surface lies at, and how softly it gives out there: the hill has to stand out of it. */
    fogTop: 8.2,
    /** And how high it lies once the night has thickened it: over a bird's head on the lower slopes of the hill. */
    fogClimbs: 11.4,
    fogSoft: 2.8,
    /** How far the top surface drifts up and down, and how fast the noise in it moves with the breeze. */
    fogSwell: 0.7,
    fogDrift: 0.02,
    /** How hard a gust cuts a lane in the fog, how wide the cut is, and the seconds a lane takes to close again. */
    carveStrength: 5.5,
    carveWidth: 4.6,
    carveCloses: 11,
    /** Wind speed at which a stroke carves at full strength. */
    carveSpeed: 9,
    /** How far out the frost starts and how near the bed it comes, from `frost` 0 to 1. */
    frostFrom: 30,
    frostTo: -1.4,
    /**
     * The frosted sward. A blade here keeps this much of its height, and rather less of its width, so cropping
     * leaves fine stubble instead of blades wider than they are tall and a bird stays legible in it. The odd
     * tall tuft is cut back; the remaining stems bend into low tufts rather than standing like stakes.
     */
    swardCrop: 0.76,
    swardWidth: 0.12,
    /** Close winter turf needs more stems on the sparse phone tier; fades into the ordinary LOD. */
    swardDensity: 2.6,
    swardDetailFrom: 12,
    swardDetailTo: 22,
    swardTuft: 1.0,
    /** Short blades need their roots at the surface instead of buried like meadow grass. */
    rootDepth: 0.018,
    swardCurve: 2.4,
    /** How much of a blade's colour the rime takes at the root, and at the tip, where it settles thickest. */
    rimeRoot: 0.38,
    rimeTip: 0.72,
    /** The bedside lamp, the one warm thing in the blue, and how far the dawn puts it out of business. */
    lamp: 1.25,
    lampDawn: 0.94,
    /** Camera-near mist clears softly; distant air still conceals the bed during the climb. */
    fogNear: 2.5,
    fogFar: 11,
    fogExtinction: 0.12,
    /** Light travels from the summit across the winter turf before the sky brightens. */
    dawnStrength: 1.2,
    dawnLaneWidth: 5.0,
    sitHigh: 0.68,
    /** Seconds the driven values take to ease to what the story asks for, so a switch never pops. */
    ease: 1.6,
    /** How high a gust lifts the blanket by itself, the wind speed that does it, and the seconds it settles over. */
    blanketGust: 0.35,
    blanketSpeed: 7,
    blanketSettles: 2.2,
    /** How far the blanket is thrown back at `blanket` 1, in bed lengths. */
    blanketLift: 0.46,
    /** How wide the curtains are drawn back at `curtains` 1, as a share of the window, and how much they gather. */
    curtainOpen: 0.78,
    curtainGather: 0.45,
    /** Seconds for the curtains to open after the bird has pulled their ribbon free. */
    curtainsFor: 2.2,
    /** Hold both bird and window while the linen gathers and morning starts down the hill. */
    windowRevealFor: 4.5,
    /** The puff of down off the pillow: how many, how fast they leave it, and how long they hang about. */
    downCount: 34,
    downThrow: 1.6,
    downLife: 9,
    /** How far the blanket stands over the child under it, and how wide that shape is, in bed widths. */
    sleeperHigh: 0.78,
    sleeperWide: 0.65,

    /**
     * The one long white feather. It is the paper plane made slower and floatier: it takes the air's own speed
     * rather than being pushed along by it, sinks at a walking pace, and leans toward wherever the story wants
     * the bird to go, so a player who blows on it once still finds it leading and never has to fetch it.
     */
    featherTakes: 1.6,
    featherSink: 0.3,
    /** Rising air and gust energy turned into climb, in units a second at full. */
    featherLift: 0.5,
    featherGust: 0.5,
    /** How hard it leans toward the goal, in units a second squared: about 0.9 units a second of drift in still air. */
    featherLean: 2.6,
    /** How high off the grass it likes to hang: below this the air holds it up, above it it sinks like a feather. */
    featherHangs: 1.2,
    /** Seconds it will lie on the grass before a breath of its own picks it up again, and how high it may hang. */
    featherRests: 2.5,
    featherCeiling: 3.4,
    /** Share of a stroke's speed a swipe across it on screen gives it. */
    featherBrush: 0.5,
    /** Maximum lead on the walking bird, and how quickly a gust carries it back into sight. */
    featherLead: 3.6,
    featherCatch: 4,
    featherCorridor: 1.1,
    featherEncouragement: 1.6,
    featherBrushRadius: 0.36,

    /**
     * Broad sweeps free the feather and open two passages; circles support the final leap.
     * Walking is assisted, while each encounter waits for real player input.
     */
    /** Bedside choreography: a pause, the bird stepping off, sitting, resisting sleep, reclining and tucking. */
    tiredStroll: 0.68,
    bedPauseFor: 3.8,
    bedBirdFor: 2.4,
    bedBirdPace: .8,
    bedHopFor: .85,
    bedHopHeight: .38,
    blanketOpen: .85,
    bedSitFor: 3.2,
    bedDrowseFor: 4.5,
    climbsIn: 4.8,
    bedTuckFor: 3.2,
    bedSettleFor: 3.8,
    blanketHandLift: 0.45,
    /** Seconds asleep before the bird starts trying, and between its three tries. */
    triesFrom: 1.2,
    triesEvery: 3.2,
    /** Screen travel across the pillow needed to free the feather after the call. */
    featherStroke: 0.16,
    /** Local circling sensitivity: a gentle loop takes about 2–3 seconds. */
    twirlGain: 2.0,
    /** Seconds each look back toward the bed lasts. */
    looksBack: 2.2,
    /** What the wind under it has to do at the hilltop before it goes. */
    liftToFly: 0.9,
    /** The glide down: seconds it takes, and how far it holds above the straight line from the hill to the bed. */
    leapFor: 2.0,
    ribbonReachArc: 0.22,
    ribbonReleaseOpening: 0.28,
    ribbonTugFor: 1.6,
    ribbonPull: 0.85,
    ledgeStudyFor: 6.5,
    selfUnwrapFor: 4.2,
    glideFor: 11,
    glideArc: 2.6,
    /** How far the frost has come in by the time the bird gives up on the child, and by the hilltop. */
    frostAsleep: 0.88,
    frostWorst: 1.0,
    /** Wind travel through the snow and fog; earned clearance stays open while the bird passes. */
    snowBrushRadius: .16,
    mistBrushRadius: .72,
    featherTakeRate: 3.8,
    snowStroke: 0.34,
    mistStroke: 0.46,
    encounterNoticeFor: 2.2,
    climbPace: 0.40,
    climbEncouragement: 0.22,
    routeReach: 0.75,
    snowDepth: 1.65,
    winterLamp: 0.24,
    winterFirstCold: .16,
    winterBedCold: .65,
    winterBeginsAt: 2.1,
    winterArrivesFor: 8.6,
    winterBreeze: 1.05,
    winterGreen: .66,
    winterGust: .8,
    snowCount: 2100,
    snowFall: 0.75,
    hearthX: -171.2, hearthZ: -1913.8,
    hearthGutter: .10, hearthOut: .45, hearthAsh: .62,
    alarmFor: 3.2, alarmRock: .14,
    /** Seconds the waking takes: the light on the face, the sitting up, and the bird gathered into the lap. */
    wakeFor: 12,

    /**
     * The child asleep in it. The coat is a rigid bell, so lying down is not a pose it can hold: they are tipped
     * onto their back with a small side roll, supported by the mattress and propped on the pillow.
     * The coat narrows beneath the blanket; the head and hands retain their normal proportions.
     */
    lieHigh: 0.84,
    lieTip: 0.10,
    lieSquash: 0.72,
    lieDeep: 0.68,
    lieSide: 0.48,
  },
};

/** A number as a GLSL float literal. */
export const glsl = (x: number): string => x.toFixed(4);
