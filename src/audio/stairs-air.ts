/** What the air is like round the travellers in the stairs in the clouds, as the chapter measures it each frame. */
export interface StairsAir {
  /** 0 under or above the cloud, 1 deep inside the white. */
  cloud: number;
  /** How far up through the cloud the child has climbed: 0 at its underside, 1 at its top. */
  climb: number;
  /** 0 until they come out on top; 1 on the top landing and while they sail over the cloud. */
  open: number;
  /** The fog closing round the boat on the way down: 0 clear, 1 white; it thins again over the village's water. */
  fog: number;
  /** The boat's speed over the cloud, metres a second; 0 on foot. */
  speed: number;
}
