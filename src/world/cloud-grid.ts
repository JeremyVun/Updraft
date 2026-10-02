import * as THREE from 'three';

/**
 * A mesh for a surface that lies out to the horizon round the eye, anchored to the world: nested square grids, each
 * twice as coarse as the one inside it, each moved only in steps of two of its own squares, so its points stay where
 * they are on the world as the eye goes. Toward its outer edge each grid folds every other point onto its neighbour,
 * by how far the eye is, so where it meets the next it has become that coarser grid, with no step between.
 *
 * position.xz is a point's place on its grid in squares from the grid's centre, position.y which grid it is on.
 * Each grid leaves out the middle the finer one covers, except a margin, which it drops pixel by pixel.
 */
export const GRID_LEVELS = 7;
const N = 128;

export function cloudGridGeometry(finest: number): { geometry: THREE.BufferGeometry; levels: THREE.Vector4[] } {
  const pos: number[] = [];
  const index: number[] = [];
  const side = N + 1;
  const half = N / 2;
  // The finer grid is never more than a square and a half of this one off its centre, so it always covers this.
  const hole = N / 4 - 2;
  for (let level = GRID_LEVELS - 1; level >= 0; level--) {
    const base = pos.length / 3;
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) pos.push(i - half, level, j - half);
    // Outer rings first, so the far cloud is drawn before the near and a soft edge falls on what lies behind it.
    const rings: number[][] = Array.from({ length: half }, () => []);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const ring = Math.max(Math.abs(i + 0.5 - half), Math.abs(j + 0.5 - half)) - 0.5;
        if (level > 0 && ring < hole) continue;
        const a = base + j * side + i, b = a + 1, c = a + side, d = c + 1;
        // Split each square along the diagonal that points out from the middle, so the grids fold evenly.
        const flip = (i < half) !== (j < half);
        rings[ring].push(...(flip ? [a, c, b, b, c, d] : [a, c, d, a, d, b]));
      }
    }
    for (let r = half - 1; r >= 0; r--) index.push(...rings[r]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setIndex(index);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  const levels = Array.from({ length: GRID_LEVELS }, (_, l) => new THREE.Vector4(0, 0, finest * 2 ** l, finest * 2 ** l * half));
  return { geometry, levels };
}

const frustum = new THREE.Frustum();
const viewProjection = new THREE.Matrix4();

/** The six planes of what `camera` sees, for gridUnseen. */
export function placeView(planes: THREE.Vector4[], camera: THREE.Camera): void {
  frustum.setFromProjectionMatrix(viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  frustum.planes.forEach((p, i) => planes[i].set(p.normal.x, p.normal.y, p.normal.z, p.constant));
}

/** Moves each grid to the eye, in steps of two of its own squares. */
export function placeCloudGrid(levels: THREE.Vector4[], eye: THREE.Vector3): void {
  for (const l of levels) {
    const step = l.z * 2;
    l.x = Math.round(eye.x / step) * step;
    l.y = Math.round(eye.z / step) * step;
  }
}

/**
 * gridPlace(): where on the world this vertex is (xz), and how far apart the points round it are (for how smooth
 * what it carries must be), both the same whichever grid a point is reckoned on.
 */
export const CLOUD_GRID_VERT = /* glsl */ `
uniform vec4 uGrid[${GRID_LEVELS}];
vec2 gridPlace(out float spacing, out float level) {
  level = position.y;
  vec4 g = uGrid[int(position.y + 0.5)];
  vec2 xz = g.xy + position.xz * g.z;
  vec2 d = abs(xz - cameraPosition.xz);
  float far = max(d.x, d.y);
  float band = g.w * 0.3;
  float fold = clamp((far - (g.w - g.z - band)) / band, 0.0, 1.0);
  xz -= mod(position.xz, 2.0) * g.z * fold;
  spacing = max(uGrid[0].z, far * ${(4 / N).toFixed(6)});
  return xz;
}
uniform vec4 uView[6];
/**
 * Whether every triangle round this point lies wholly outside one side of the view, for a surface whose heights here
 * lie between lo and hi; if so, at is a point outside that side, where the point may be put without being worked out.
 */
bool gridUnseen(float lo, float hi, out vec3 at) {
  vec4 g = uGrid[int(position.y + 0.5)];
  vec2 xz = g.xy + position.xz * g.z;
  vec3 c = vec3(xz.x, 0.5 * (lo + hi), xz.y), e = vec3(2.0 * g.z, 0.5 * (hi - lo), 2.0 * g.z);
  at = vec3(xz.x, lo, xz.y);
  for (int i = 0; i < 6; i++) if (dot(uView[i].xyz, c) + uView[i].w < -dot(abs(uView[i].xyz), e) - 1.0) return true;
  return false;
}`;

/** gridHidden(xz, level): whether a finer grid covers this point. */
export const CLOUD_GRID_FRAG = /* glsl */ `
uniform vec4 uGrid[${GRID_LEVELS}];
bool gridHidden(vec2 xz, float level) {
  if (level < 0.5) return false;
  vec4 g = uGrid[int(level + 0.5) - 1];
  vec2 d = abs(xz - g.xy);
  return max(d.x, d.y) < g.w - g.z * 0.05;
}`;
