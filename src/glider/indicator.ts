import * as THREE from 'three';
import { tuning } from '../tuning';
import type { Glider } from './glider';

interface Bounds { left: number; top: number; right: number; bottom: number }

/** A bearing in screen pixels. Keep camera-space x/y when behind the camera: projection would reverse them. */
export function planeBearing(view: THREE.Vector3, camera: THREE.PerspectiveCamera, width: number, height: number,
  bounds: Bounds, out: { x: number; y: number; angle: number; strength: number }): void {
  const cx = width / 2, cy = height / 2;
  let dx = view.x * camera.projectionMatrix.elements[0] * cx;
  let dy = -view.y * camera.projectionMatrix.elements[5] * cy;
  const depth = Math.max(Math.abs(view.z), 0.001);
  const beyond = Math.max(Math.abs(dx) / depth - cx, Math.abs(dy) / depth - cy);
  out.strength = view.z >= -camera.near ? 1 : THREE.MathUtils.smoothstep(beyond, 0, tuning.planeIndicator.edgeFade);
  // Directly behind has no unique screen bearing. Retain the last one instead of flickering between edges.
  if (Math.hypot(dx, dy) < 0.001) { dx = Math.cos(out.angle); dy = Math.sin(out.angle); }
  const tx = dx > 0 ? (bounds.right - cx) / dx : dx < 0 ? (bounds.left - cx) / dx : Infinity;
  const ty = dy > 0 ? (bounds.bottom - cy) / dy : dy < 0 ? (bounds.top - cy) / dy : Infinity;
  const t = Math.min(tx, ty);
  out.x = cx + dx * t;
  out.y = cy + dy * t;
  out.angle = Math.atan2(dy, dx);
}

/** A quiet paper silhouette at the edge only while the player's plane is out of view. */
export class PlaneIndicator {
  private readonly region = document.getElementById('plane-guide')!;
  private readonly icon = document.getElementById('plane-indicator')!;
  private readonly view = new THREE.Vector3();
  private readonly bearing = { x: 0, y: 0, angle: -Math.PI / 2, strength: 0 };
  private bounds: Bounds = { left: 0, top: 0, right: 0, bottom: 0 };
  private resized = true;
  private opacity = 0;

  constructor() {
    window.addEventListener('resize', () => { this.resized = true; });
  }

  update(dt: number, camera: THREE.PerspectiveCamera, plane: Glider, playing: boolean): void {
    if (this.resized) {
      this.bounds = this.region.getBoundingClientRect();
      this.resized = false;
    }
    const active = playing && plane.group.visible && !plane.held && !plane.departing;
    if (active) {
      this.view.copy(plane.position).applyMatrix4(camera.matrixWorldInverse);
      planeBearing(this.view, camera, window.innerWidth, window.innerHeight, this.bounds, this.bearing);
      // Fade at the last edge once it returns; a fast pass across the screen must not move the fading icon opposite.
      if (this.bearing.strength > 0) {
        this.icon.style.transform = `translate(${this.bearing.x - this.bounds.left}px, ${this.bearing.y - this.bounds.top}px) translate(-50%, -50%) rotate(${this.bearing.angle}rad)`;
      }
    }
    const target = active ? this.bearing.strength * tuning.planeIndicator.opacity : 0;
    this.opacity += (target - this.opacity) * (1 - Math.exp(-dt * tuning.planeIndicator.fadeRate));
    if (this.opacity < 0.002) this.opacity = 0;
    this.icon.style.opacity = String(this.opacity);
  }
}
