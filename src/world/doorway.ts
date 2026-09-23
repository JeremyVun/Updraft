import * as THREE from 'three';
import { tuning } from '../tuning';
import { atmo } from './atmosphere';
import { heightAt } from './island';
import { DOOR_SHORE } from './heightfield';
import { door } from './lines';
import type { Terrain } from './terrain';
import type { Water } from './water';

/** Two places joined by one ordinary door. Neither shore is visible around its frame. */
export const DOOR_EXIT = new THREE.Vector3(DOOR_SHORE.x, heightAt(DOOR_SHORE.x, DOOR_SHORE.z + 9) - 0.1, DOOR_SHORE.z + 9);
export const DOOR_SHIFT = DOOR_EXIT.clone().sub(door.group.position);
export const doorway = {
  crossed: false, travelling: false,
  eye: new THREE.Vector3(), look: new THREE.Vector3(),
  fromEye: new THREE.Vector3(), fromLook: new THREE.Vector3(),
  reset(crossed = false) { this.crossed = crossed; this.travelling = false; },
  begin() { this.travelling = true; this.fromEye.copy(this.eye); this.fromLook.copy(this.look); },
};

/** The destination is drawn once, in linear light, before the ordinary scene/bloom/grade. */
export class DoorwayView {
  readonly surface: THREE.Mesh;
  readonly target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: true, samples: 2 });
  private readonly camera = new THREE.PerspectiveCamera();
  private readonly size = new THREE.Vector2();
  private readonly plane = new THREE.Plane();
  private readonly clip = new THREE.Vector4();
  private readonly q = new THREE.Vector4();
  private readonly waterAt = new THREE.Vector3();
  private readonly actorOffsets: { at: THREE.Vector3; offset: THREE.Vector3 }[] = [];
  private readonly clipUniforms = {
    uDoorClip: { value: new THREE.Vector4() },
    uDoorInverse: { value: new THREE.Matrix4() },
    uDoorSize: { value: new THREE.Vector2() },
  };

  constructor(private readonly renderer: THREE.WebGLRenderer, private readonly scene: THREE.Scene,
    private readonly terrain: Terrain, private readonly water: Water,
    private readonly source: Set<THREE.Object3D>, private readonly destination: Set<THREE.Object3D>,
    private readonly shoreObjects: THREE.Object3D[],
    actors: { objects: THREE.Object3D[]; at: THREE.Vector3 }[]) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { tDoor: { value: this.target.texture } },
      vertexShader: `varying vec4 vScreen; void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); vScreen = gl_Position; }`,
      fragmentShader: `uniform sampler2D tDoor; varying vec4 vScreen; void main() { gl_FragColor = texture2D(tDoor, vScreen.xy / vScreen.w * 0.5 + 0.5); }`,
      side: THREE.FrontSide,
    });
    this.surface = new THREE.Mesh(new THREE.PlaneGeometry(1.17 * 1.5, 2.98 * 1.08), mat);
    this.surface.position.copy(door.group.position).add(new THREE.Vector3(0, 1.49 * 1.08, -0.065));
    this.surface.frustumCulled = false;
    scene.add(this.surface); source.add(this.surface);
    // Split every part of a character at the threshold, including the scarf and paper. Offset in clip
    // space also handles meshes whose vertices are already world-space (scarf, shadows and call marks).
    const materials = new Map<THREE.Material, THREE.Vector3>();
    for (const actor of actors) {
      const offset = new THREE.Vector3();
      this.actorOffsets.push({ at: actor.at, offset });
      for (const root of actor.objects) root.traverse(o => {
        if (!(o instanceof THREE.Mesh || o instanceof THREE.Sprite)) return;
        o.frustumCulled = false;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.set(m, offset);
      });
    }
    for (const [material, offset] of materials) {
      const previous = material.onBeforeCompile;
      material.onBeforeCompile = (shader, renderer) => {
        previous.call(material, shader, renderer);
        Object.assign(shader.uniforms, this.clipUniforms, { uDoorOffset: { value: offset } });
        shader.vertexShader = 'uniform vec3 uDoorOffset;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('distance(cameraPosition, world)', 'distance(cameraPosition, world + uDoorOffset)');
        // The bird's depth nudge must measure from the destination camera AFTER translation;
        // nudging towards a camera hundreds of metres away would shift it sideways at the threshold.
        const nudged = shader.vertexShader.includes('nudgedView(vWorld, uNudge)');
        if (nudged) shader.vertexShader = shader.vertexShader.replace('nudgedView(vWorld, uNudge)', 'nudgedView(vWorld + uDoorOffset, uNudge)');
        const end = shader.vertexShader.lastIndexOf('}');
        const world = /(?:out|varying)\s+vec3\s+vWorld\s*;/.test(shader.vertexShader) ? 'vWorld += uDoorOffset;' : '';
        const translate = nudged ? '' : 'gl_Position += projectionMatrix * viewMatrix * vec4(uDoorOffset, 0.0);';
        shader.vertexShader = shader.vertexShader.slice(0, end) + `${translate} ${world}\n` + shader.vertexShader.slice(end);
        const clipPosition = /(?:in|varying)\s+vec3\s+vWorld\s*;/.test(shader.fragmentShader)
          ? 'vec4 w = vec4(vWorld, 1.0);'
          : 'vec4 w = uDoorInverse * vec4(gl_FragCoord.xy / uDoorSize * 2.0 - 1.0, gl_FragCoord.z * 2.0 - 1.0, 1.0);';
        shader.fragmentShader = `uniform vec4 uDoorClip; uniform mat4 uDoorInverse; uniform vec2 uDoorSize;\n` + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(/void\s+main\s*\(\s*\)\s*\{/, `void main() {
          if (uDoorClip.z != 0.0) {
            ${clipPosition}
            if (dot(w.xyz / w.w, uDoorClip.xyz) + uDoorClip.w < 0.0) discard;
          }`);
      };
      material.customProgramCacheKey = () => 'doorway-actors-v3';
      material.needsUpdate = true;
    }
  }

  /** Visibility is scoped to rendering; simulation and other chapters keep their own visibility decisions. */
  private inRoom(objects: Set<THREE.Object3D>, draw: () => void): void {
    const hidden: THREE.Object3D[] = [];
    for (const o of this.scene.children) if (o.visible && !objects.has(o)) { hidden.push(o); o.visible = false; }
    try { draw(); } finally { for (const o of hidden) o.visible = true; }
  }

  render(view: THREE.PerspectiveCamera, active: boolean, concealShore: boolean, draw: () => void): void {
    this.surface.visible = active && !doorway.crossed && door.opened;
    // A full-screen multisampled target is tens of megabytes; it is reallocated if the door is shown again.
    if (!this.surface.visible && (this.target.width > 1 || this.target.height > 1)) this.target.setSize(1, 1);
    doorway.eye.copy(view.position);
    view.getWorldDirection(doorway.look).multiplyScalar(12).add(view.position);
    if (!active) {
      this.clipUniforms.uDoorClip.value.set(0, 0, 0, 0);
      // Outside the doorway and its outgoing crossing, only the secret shore is absent. The occupied
      // boat and other rooms remain visible. The reflection uses the same exclusion; restore state afterward.
      const hidden = concealShore ? this.shoreObjects.filter(o => o.visible) : [];
      for (const o of hidden) o.visible = false;
      atmo.uniforms.uRoom.value.set(DOOR_SHORE.x, DOOR_SHORE.z, concealShore ? -48 : 0);
      try { draw(); } finally {
        for (const o of hidden) o.visible = true;
        atmo.uniforms.uRoom.value.set(0, 0, 0);
      }
      return;
    }
    const r = this.renderer, u = this.clipUniforms;
    r.getDrawingBufferSize(this.size);
    u.uDoorSize.value.copy(this.size);
    u.uDoorInverse.value.multiplyMatrices(view.matrixWorld, view.projectionMatrixInverse);
    u.uDoorClip.value.set(0, 0, doorway.crossed ? 0 : 1, 398);
    if (this.surface.visible) {
      const scale = view.position.distanceTo(this.surface.position) < 5 ? 1 : tuning.linesPassage.portalScale;
      const w = Math.max(1, Math.round(this.size.x * scale)), h = Math.max(1, Math.round(this.size.y * scale));
      if (this.target.width !== w || this.target.height !== h) this.target.setSize(w, h);
      const cam = this.camera;
      cam.copy(view); cam.position.add(DOOR_SHIFT); cam.updateMatrixWorld(true);
      // Oblique near clipping keeps the destination behind its own threshold.
      this.plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, -1), DOOR_EXIT).applyMatrix4(cam.matrixWorldInverse);
      this.clip.set(this.plane.normal.x, this.plane.normal.y, this.plane.normal.z, this.plane.constant);
      const e = cam.projectionMatrix.elements;
      this.q.set((Math.sign(this.clip.x) + e[8]) / e[0], (Math.sign(this.clip.y) + e[9]) / e[5], -1, (1 + e[10]) / e[14]);
      this.clip.multiplyScalar(2 / this.clip.dot(this.q));
      e[2] = this.clip.x; e[6] = this.clip.y; e[10] = this.clip.z + 1; e[14] = this.clip.w;
      cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
      const prev = r.getRenderTarget();
      const waterMat = this.water.mesh.material as THREE.ShaderMaterial;
      const mirror = waterMat.uniforms.uMirrorOn.value;
      this.waterAt.copy(this.water.mesh.position);
      this.water.mesh.position.set(cam.position.x, 0, cam.position.z);
      waterMat.uniforms.uMirrorOn.value = 0;
      atmo.uniforms.uRoom.value.set(DOOR_SHORE.x, DOOR_SHORE.z, 48);
      for (const actor of this.actorOffsets) {
        actor.offset.copy(DOOR_SHIFT);
        // The two shores meet at the sill, but slope differently after it. Keep the feet on the
        // destination ground, rather than carrying the old hillside's downhill slope through the door.
        actor.offset.y = heightAt(actor.at.x + DOOR_SHIFT.x, actor.at.z + DOOR_SHIFT.z) - heightAt(actor.at.x, actor.at.z);
      }
      u.uDoorClip.value.z = 0;
      this.terrain.beginMirror(cam);
      try {
        r.setRenderTarget(this.target);
        this.inRoom(this.destination, () => r.render(this.scene, cam));
      } finally {
        this.terrain.endMirror(); this.water.mesh.position.copy(this.waterAt);
        waterMat.uniforms.uMirrorOn.value = mirror;
        for (const actor of this.actorOffsets) actor.offset.set(0, 0, 0);
        u.uDoorClip.value.z = 1;
        r.setRenderTarget(prev);
      }
    }
    atmo.uniforms.uRoom.value.set(doorway.crossed ? DOOR_SHORE.x : 14, doorway.crossed ? DOOR_SHORE.z : -368.4, doorway.crossed ? 48 : 96);
    try { this.inRoom(doorway.crossed ? this.destination : this.source, draw); }
    finally { atmo.uniforms.uRoom.value.set(0, 0, 0); u.uDoorClip.value.z = 0; }
  }
}
