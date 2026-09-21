/** Relocations from the original journey layout; also used to migrate saved coordinates. */
export const BOATS_SHIFT = { x: -120, z: 95 } as const;
export const SHORE_SHIFT = { x: 0, z: 95 } as const;
/** Move both late islands together: the final crossing retains its exact shape and length. */
export const SEA_SHORTENING = { x: 50, z: 130 } as const;
export const MIRROR_SHIFT = { x: 60 + SEA_SHORTENING.x, z: 90 + SEA_SHORTENING.z } as const;
export const HOME_SHIFT = { x: -105 + SEA_SHORTENING.x, z: -380 + SEA_SHORTENING.z } as const;
export const GEOGRAPHY_VERSION = 2;
