import * as THREE from 'three';
import { tuning } from '../tuning';
import { atmo } from '../world/atmosphere';

/** Sheet lightning inside the cloud bank, followed by thunder travelling across the water. */
export class StormWeather {
  private elapsed = 0;
  private next = tuning.storm.firstLightning;
  private age = Infinity;
  private thunderIn = Infinity;
  private strikes = 0;
  private strength = 0;
  private flashScale = 1;
  private pan = 0;
  private readonly light = new THREE.Color();

  constructor(private readonly thunder: (strength: number, pan: number) => void) {}

  /** Called after the palette, so the flash lights the rain, sail, travellers and reflected sky together. */
  update(dt: number, storm: number, heading: number, lightningScale = 1, woodShade = 0): void {
    this.flashScale += (lightningScale - this.flashScale) * (1 - Math.exp(-dt * 2.5));
    const u = atmo.uniforms;
    u.uStormCover.value = storm;
    if (storm > 0.01) this.elapsed += dt;
    else {
      this.elapsed = 0;
      this.next = tuning.storm.firstLightning;
      this.strikes = 0;
    }
    this.age += dt;
    this.thunderIn -= dt;
    if (this.thunderIn <= 0) {
      this.thunderIn = Infinity;
      this.thunder(this.strength, this.pan);
    }
    if (storm >= tuning.storm.lightningStormFrom && u.uNight.value >= tuning.storm.lightningNightFrom
      && u.uShower.value >= tuning.storm.lightningRainFrom && this.elapsed >= this.next) {
      this.age = 0;
      this.strength = 0.45 + storm * 0.45;
      this.pan = this.strikes % 2 === 0 ? -0.45 : 0.35;
      const bearing = heading + this.pan * 0.7;
      u.uLightning.value.set(Math.sin(bearing), 0.32, Math.cos(bearing), 0);
      this.thunderIn = tuning.storm.thunderDelay + (this.strikes % 2) * 0.4;
      this.strikes++;
      this.next = this.elapsed + (this.strikes < 3 ? tuning.storm.lightningGap : tuning.storm.lightningGap * 2.2);
    }
    const t = this.age / tuning.storm.lightningFade;
    // One soft-edged illumination, never a sequence of full-screen white flashes.
    const flash = t < 1 ? Math.sin(Math.min(1, this.age / tuning.storm.lightningAttack) * Math.PI * 0.5) * Math.pow(1 - t, 2) * this.strength * this.flashScale : 0;
    u.uLightning.value.w = flash;
    // A storm hides the moon as well as the sun. Keep the close figures readable in scattered light.
    u.uSunColor.value.multiplyScalar(1 - storm * (1 - tuning.storm.moonThroughCloud));
    u.uSkyHorizonSun.value.lerp(u.uSkyHorizon.value, storm);
    u.uSkyZenith.value.multiplyScalar(1 - storm * 0.25);
    // Cloud-scattered light keeps the two travellers readable between the lightning strikes.
    this.light.setRGB(0.025, 0.032, 0.046).multiplyScalar(storm);
    u.uSkyAmbient.value.add(this.light);
    // The forest cannot inherit the crossing's fill light: the player makes its light.
    // Dim the sky too, because its reflection and fog otherwise expose the wet floor.
    // Apply before the flash; ember illumination is a separate, unaffected light.
    const fill = THREE.MathUtils.lerp(1, tuning.wood.ambientScale, woodShade);
    const sky = THREE.MathUtils.lerp(1, tuning.wood.skyScale, woodShade);
    u.uSunColor.value.multiplyScalar(fill);
    u.uSkyAmbient.value.multiplyScalar(fill);
    u.uGroundBounce.value.multiplyScalar(fill);
    u.uSkyZenith.value.multiplyScalar(sky);
    u.uSkyHorizon.value.multiplyScalar(sky);
    u.uSkyHorizonSun.value.multiplyScalar(sky);
    this.light.setRGB(0.42, 0.51, 0.7).multiplyScalar(flash * tuning.storm.lightningAmbient);
    u.uSkyAmbient.value.add(this.light);
    u.uSkyHorizon.value.add(this.light.multiplyScalar(tuning.storm.lightningHorizon));
  }
}
