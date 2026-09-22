/** Relocations from the original journey layout; also used to migrate saved coordinates. */
/** Revision 3 puts Little Boats north of the door shore, with an open-water approach to the meadow. */
export const BOATS_OFFSHORE_SHIFT = { x: -30, z: 265 } as const;
/** Revision 4 brings both crossings back toward 30/40 seconds. */
export const BOATS_SHORTENING = { x: -70, z: -190 } as const;
export const BOATS_SHIFT = { x: -120 + BOATS_OFFSHORE_SHIFT.x + BOATS_SHORTENING.x, z: 95 + BOATS_OFFSHORE_SHIFT.z + BOATS_SHORTENING.z } as const;
export const SHORE_SHIFT = { x: 0, z: 95 } as const;
/** Move both late islands together: the final crossing retains its exact shape and length. */
export const SEA_SHORTENING = { x: 50, z: 130 } as const;
export const MIRROR_SHIFT = { x: 60 + SEA_SHORTENING.x, z: 90 + SEA_SHORTENING.z } as const;
export const HOME_SHIFT = { x: -105 + SEA_SHORTENING.x, z: -380 + SEA_SHORTENING.z } as const;
export const GEOGRAPHY_VERSION = 4;
