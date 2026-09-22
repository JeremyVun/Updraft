import { HOME_SHIFT } from './geography';

/** The one arrival with somewhere built for the boat; shared by the crossing, landing and timber. */
export const HOME_JETTY = { x: -45 + HOME_SHIFT.x, shoreZ: -1954 + HOME_SHIFT.z,
  endZ: -1927 + HOME_SHIFT.z, halfWidth: 1.2, deck: 0.7 } as const;
export const HOME_MOORING = { x: -45.3 + HOME_SHIFT.x, z: -1926.25 + HOME_SHIFT.z, yaw: Math.PI / 2 } as const;
