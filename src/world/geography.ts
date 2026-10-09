/** Relocations from the original journey layout; also used to migrate saved coordinates. */
/** Revision 3 puts Little Boats north of the door shore, with an open-water approach to the meadow. */
export const BOATS_OFFSHORE_SHIFT = { x: -30, z: 265 } as const;
/** Revision 4 brings both crossings back toward 30/40 seconds. */
export const BOATS_SHORTENING = { x: -70, z: -190 } as const;
export const BOATS_SHIFT = { x: -120 + BOATS_OFFSHORE_SHIFT.x + BOATS_SHORTENING.x, z: 95 + BOATS_OFFSHORE_SHIFT.z + BOATS_SHORTENING.z } as const;
export const SHORE_SHIFT = { x: 0, z: 95 } as const;
/** Move both late islands together: the final crossing retains its exact shape and length. */
export const SEA_SHORTENING = { x: 50, z: 130 } as const;
/** Revision 6 carries both late islands on together, so the mirror lies straight on past the whale on the open sea. */
export const PAST_THE_WHALE = { x: -236, z: -192 } as const;
/** And moves where the whale lies, off the line the boat sails, so it is found rather than seen. */
export const WHALE_MOVE = { x: -108, z: -79 } as const;
export const MIRROR_SHIFT = { x: 60 + SEA_SHORTENING.x + PAST_THE_WHALE.x, z: 90 + SEA_SHORTENING.z + PAST_THE_WHALE.z } as const;
export const HOME_SHIFT = { x: -105 + SEA_SHORTENING.x + PAST_THE_WHALE.x, z: -380 + SEA_SHORTENING.z + PAST_THE_WHALE.z } as const;
/** Revision 5 brings the island of lines 100 m closer to the still island, shortening the first crossing. */
export const LINES_SHIFT = { x: 0, z: 100 } as const;
export const GEOGRAPHY_VERSION = 6;
