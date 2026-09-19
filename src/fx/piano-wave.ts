import * as THREE from 'three';
import { RibbonBatch, type Ribbon } from './ribbons';
import { surfaceHeight } from '../world/island';
import { tuning } from '../tuning';
import { musicFront } from '../world/music-growth';
import type { LifeField } from '../world/life';

/** Loose, rolling curls carried over the irregular front of returning colour. */
export class PianoWave {
  readonly batch = new RibbonBatch(65 * 5, '#fff3cc', 1, false, 0.6);
  private readonly arcs: Ribbon[] = Array.from({ length: 5 }, () => ({
    points: Array.from({ length: 65 }, () => new THREE.Vector3()), alpha: 0, width: 0,
  }));

  constructor() { this.batch.mesh.visible = false; }

  update(x: number, z: number, radius: number, fade: number, life: LifeField): void {
    this.batch.mesh.visible = fade > 0.005 && radius > 1;
    if (!this.batch.mesh.visible) return;
    const t = tuning.piano;
    for (let band = 0; band < this.arcs.length; band++) {
      const arc = this.arcs[band];
      const bearing = (band - 2) * 0.64;
      const r = musicFront(radius, bearing);
      const cx = x + Math.sin(bearing) * r, cz = z - Math.cos(bearing) * r;
      const curl = Math.min(t.waveCurlRadius, radius * 0.2) * (0.8 + band * 0.07);
      const phase = radius * t.waveCurl + band * 1.7;
      arc.alpha = fade * t.waveAlpha * (0.8 + Math.sin(phase) * 0.15);
      arc.width = t.waveWidth * (0.7 + band * 0.06);
      for (let i = 0; i < arc.points.length; i++) {
        const u = i / (arc.points.length - 1);
        const angle = phase - (1 - u) * 4.8;
        const reach = curl * (0.25 + u * 0.75);
        const px = cx + Math.sin(angle) * reach, pz = cz + Math.cos(angle) * reach;
        arc.points[i].set(px, surfaceHeight(px, pz) + t.waveOver + Math.sin(angle) * 0.55, pz);
      }
      // The loose tip carries a soft patch ahead; the broad front fills in behind it.
      const tip = arc.points[arc.points.length - 1];
      life.bloom(tip.x, tip.z, t.bloomRadius * (0.85 + band * 0.08), t.bloomRate * fade * 0.65);
    }
    this.batch.update(this.arcs);
  }
}
